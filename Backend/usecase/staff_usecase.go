package usecase

import (
	"context"
	"errors"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"menu-backend/domain"
	"menu-backend/internal/phone"
	"menu-backend/internal/security"
)

// How long a staff member's on/off state is trusted before it is read again.
// Turning someone off through this server clears it at once.
const activeCacheTTL = 30 * time.Second

type cachedActive struct {
	active    bool
	expiresAt time.Time
}

type staffUsecase struct {
	staffRepo    domain.StaffRepository
	tenantRepo   domain.TenantRepository
	activityRepo domain.ActivityRepository

	activeMu    sync.Mutex
	activeCache map[uuid.UUID]cachedActive
}

func NewStaffUsecase(staffRepo domain.StaffRepository, tenantRepo domain.TenantRepository, activityRepo domain.ActivityRepository) domain.StaffUsecase {
	return &staffUsecase{
		staffRepo:    staffRepo,
		tenantRepo:   tenantRepo,
		activityRepo: activityRepo,
		activeCache:  make(map[uuid.UUID]cachedActive),
	}
}

func (u *staffUsecase) Login(ctx context.Context, input domain.LoginInput) (*domain.Staff, error) {
	var creds *domain.StaffCredentials
	var err error

	switch {
	case strings.TrimSpace(input.Email) != "":
		creds, err = u.staffRepo.GetByEmail(ctx, strings.TrimSpace(input.Email))
	case strings.TrimSpace(input.Phone) != "" && strings.TrimSpace(input.RestaurantSlug) != "":
		normalized, phoneErr := phone.Normalize(input.Phone)
		if phoneErr != nil {
			return nil, domain.ErrInvalidLogin
		}
		tenant, tenantErr := u.tenantRepo.GetBySlug(ctx, strings.ToLower(strings.TrimSpace(input.RestaurantSlug)))
		if tenantErr != nil || tenant == nil {
			return nil, domain.ErrInvalidLogin
		}
		creds, err = u.staffRepo.GetByTenantPhone(ctx, tenant.ID, normalized)
	default:
		return nil, domain.ErrInvalidLogin
	}

	if errors.Is(err, domain.ErrStaffNotFound) {
		return nil, domain.ErrInvalidLogin
	}
	if err != nil {
		return nil, err
	}
	if !security.CheckPassword(input.Password, creds.PasswordHash) {
		return nil, domain.ErrInvalidLogin
	}
	if !creds.IsActive {
		return nil, domain.ErrStaffInactive
	}
	return &creds.Staff, nil
}

func (u *staffUsecase) List(ctx context.Context, tenantID uuid.UUID) ([]domain.Staff, error) {
	return u.staffRepo.List(ctx, tenantID)
}

func (u *staffUsecase) Create(ctx context.Context, actorID, tenantID uuid.UUID, input domain.NewStaffInput) (*domain.Staff, error) {
	input.FullName = strings.TrimSpace(input.FullName)
	input.Email = strings.TrimSpace(input.Email)

	if err := validateFullName(input.FullName); err != nil {
		return nil, err
	}
	if !input.Role.IsStaffRole() {
		return nil, invalidRoleError()
	}
	normalized, err := phone.Normalize(input.Phone)
	if err != nil {
		return nil, &domain.ValidationError{Message: err.Error()}
	}
	input.Phone = normalized
	if input.Email != "" && !strings.Contains(input.Email, "@") {
		return nil, &domain.ValidationError{Message: "enter a valid email, or leave it empty"}
	}
	if err := validatePassword(input.Password); err != nil {
		return nil, err
	}

	hash, err := security.HashPassword(input.Password)
	if err != nil {
		return nil, err
	}
	staff, err := u.staffRepo.Create(ctx, tenantID, input, hash)
	if err != nil {
		return nil, err
	}

	recordActivity(ctx, u.activityRepo, domain.Activity{
		TenantID: tenantID,
		ActorID:  actorID,
		Action:   domain.ActionStaffCreated,
		Details:  map[string]interface{}{"staff_id": staff.ID, "full_name": staff.FullName, "role": staff.Role},
	})
	return staff, nil
}

func (u *staffUsecase) Update(ctx context.Context, actorID, tenantID, staffID uuid.UUID, input domain.UpdateStaffInput) (*domain.Staff, error) {
	current, err := u.staffRepo.GetByID(ctx, tenantID, staffID)
	if err != nil {
		return nil, err
	}

	var changes domain.StaffChanges
	details := map[string]interface{}{"staff_id": staffID}

	if input.FullName != nil {
		name := strings.TrimSpace(*input.FullName)
		if err := validateFullName(name); err != nil {
			return nil, err
		}
		if name != current.FullName {
			changes.FullName = &name
			details["full_name"] = map[string]string{"from": current.FullName, "to": name}
		}
	}
	if input.Role != nil && *input.Role != current.Role {
		if !input.Role.IsStaffRole() {
			return nil, invalidRoleError()
		}
		changes.Role = input.Role
		details["role"] = map[string]domain.Role{"from": current.Role, "to": *input.Role}
	}
	if input.IsActive != nil && *input.IsActive != current.IsActive {
		changes.IsActive = input.IsActive
		details["is_active"] = map[string]bool{"from": current.IsActive, "to": *input.IsActive}
	}
	if input.Password != nil {
		if err := validatePassword(*input.Password); err != nil {
			return nil, err
		}
		hash, err := security.HashPassword(*input.Password)
		if err != nil {
			return nil, err
		}
		changes.PasswordHash = &hash
		details["password"] = "reset"
	}

	if changes == (domain.StaffChanges{}) {
		return current, nil
	}

	turnsOff := changes.IsActive != nil && !*changes.IsActive
	if actorID == staffID && (changes.Role != nil || turnsOff) {
		return nil, domain.ErrChangeOwnStaff
	}
	if current.Role == domain.RoleManager && current.IsActive && (changes.Role != nil || turnsOff) {
		managers, err := u.staffRepo.CountActiveManagers(ctx, tenantID)
		if err != nil {
			return nil, err
		}
		if managers <= 1 {
			return nil, domain.ErrLastManager
		}
	}

	staff, err := u.staffRepo.Update(ctx, tenantID, staffID, changes)
	if err != nil {
		return nil, err
	}
	if changes.IsActive != nil {
		u.forgetActive(staffID)
	}

	recordActivity(ctx, u.activityRepo, domain.Activity{
		TenantID: tenantID,
		ActorID:  actorID,
		Action:   domain.ActionStaffUpdated,
		Details:  details,
	})
	return staff, nil
}

func (u *staffUsecase) IsActive(ctx context.Context, userID uuid.UUID) (bool, error) {
	u.activeMu.Lock()
	cached, ok := u.activeCache[userID]
	u.activeMu.Unlock()
	if ok && time.Now().Before(cached.expiresAt) {
		return cached.active, nil
	}

	active, err := u.staffRepo.IsActive(ctx, userID)
	if errors.Is(err, domain.ErrStaffNotFound) {
		active, err = false, nil
	}
	if err != nil {
		return false, err
	}

	u.activeMu.Lock()
	u.activeCache[userID] = cachedActive{active: active, expiresAt: time.Now().Add(activeCacheTTL)}
	u.activeMu.Unlock()
	return active, nil
}

func (u *staffUsecase) forgetActive(userID uuid.UUID) {
	u.activeMu.Lock()
	delete(u.activeCache, userID)
	u.activeMu.Unlock()
}

// recordActivity writes to the activity log; a failed write is logged but does not undo the action
func recordActivity(ctx context.Context, repo domain.ActivityRepository, activity domain.Activity) {
	if err := repo.Record(ctx, activity); err != nil {
		log.Printf("activity log: failed to record %s for tenant %s: %v", activity.Action, activity.TenantID, err)
	}
}

func validateFullName(name string) error {
	if name == "" {
		return &domain.ValidationError{Message: "full name is required"}
	}
	if len([]rune(name)) > 100 {
		return &domain.ValidationError{Message: "full name must be 100 characters or fewer"}
	}
	return nil
}

func validatePassword(password string) error {
	if len(password) < domain.MinStaffPasswordLength {
		return &domain.ValidationError{Message: "password must be at least 6 characters"}
	}
	return nil
}

func invalidRoleError() error {
	return &domain.ValidationError{Message: "role must be manager, cashier, waiter or chef"}
}
