package domain

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

type Role string

const (
	RoleSuperAdmin Role = "super_admin"
	RoleManager    Role = "manager"
	RoleCashier    Role = "cashier"
	RoleWaiter     Role = "waiter"
	RoleChef       Role = "chef"
)

// StaffRoles are the roles a manager can give a staff member, in display order
var StaffRoles = []Role{RoleManager, RoleCashier, RoleWaiter, RoleChef}

var roleLabels = map[Role]string{
	RoleSuperAdmin: "Azai team",
	RoleManager:    "Manager",
	RoleCashier:    "Cashier",
	RoleWaiter:     "Waiter",
	RoleChef:       "Chef",
}

// NormalizeRole maps the role names used before the Pro roles (owner, kitchen) onto the
// new ones, so logins issued before the change keep working until they expire.
func NormalizeRole(role string) Role {
	switch role {
	case "owner":
		return RoleManager
	case "kitchen":
		return RoleChef
	}
	return Role(role)
}

// IsStaffRole reports whether a manager may give this role to a staff member
func (r Role) IsStaffRole() bool {
	for _, role := range StaffRoles {
		if role == r {
			return true
		}
	}
	return false
}

func (r Role) Label() string {
	if label, ok := roleLabels[r]; ok {
		return label
	}
	return string(r)
}

// Staff is a person who logs in to a restaurant's staff screens
type Staff struct {
	ID        uuid.UUID `json:"id"`
	TenantID  uuid.UUID `json:"tenant_id"`
	FullName  string    `json:"full_name"`
	Phone     string    `json:"phone"`
	Email     string    `json:"email"`
	Role      Role      `json:"role"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

// StaffCredentials is a staff member together with their password hash, for login only
type StaffCredentials struct {
	Staff
	PasswordHash string
}

var (
	ErrInvalidLogin   = errors.New("wrong phone, email or password")
	ErrStaffInactive  = errors.New("this account has been turned off; ask your manager")
	ErrStaffNotFound  = errors.New("staff member not found")
	ErrPhoneTaken     = errors.New("another staff member already uses this phone number")
	ErrEmailTaken     = errors.New("another account already uses this email")
	ErrLastManager    = errors.New("the restaurant needs at least one active manager")
	ErrChangeOwnStaff = errors.New("you cannot change your own role or turn off your own account; ask another manager")
)

// ValidationError explains which input is wrong; controllers return its message as a 400
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

const MinStaffPasswordLength = 6

// LoginInput signs in with an email, or with a phone at the restaurant whose page is open
type LoginInput struct {
	Email          string
	Phone          string
	RestaurantSlug string
	Password       string
}

type NewStaffInput struct {
	FullName string
	Phone    string
	Email    string
	Password string
	Role     Role
}

// UpdateStaffInput changes only the fields that are set
type UpdateStaffInput struct {
	FullName *string
	Role     *Role
	IsActive *bool
	Password *string
}

// StaffChanges is what the repository writes; PasswordHash replaces the password when set
type StaffChanges struct {
	FullName     *string
	Role         *Role
	IsActive     *bool
	PasswordHash *string
}

type StaffRepository interface {
	GetByEmail(ctx context.Context, email string) (*StaffCredentials, error)
	GetByTenantPhone(ctx context.Context, tenantID uuid.UUID, phone string) (*StaffCredentials, error)
	GetByID(ctx context.Context, tenantID, id uuid.UUID) (*Staff, error)
	List(ctx context.Context, tenantID uuid.UUID) ([]Staff, error)
	Create(ctx context.Context, tenantID uuid.UUID, input NewStaffInput, passwordHash string) (*Staff, error)
	Update(ctx context.Context, tenantID, id uuid.UUID, changes StaffChanges) (*Staff, error)
	IsActive(ctx context.Context, id uuid.UUID) (bool, error)
	CountActiveManagers(ctx context.Context, tenantID uuid.UUID) (int, error)
}

type StaffUsecase interface {
	Login(ctx context.Context, input LoginInput) (*Staff, error)
	List(ctx context.Context, tenantID uuid.UUID) ([]Staff, error)
	Create(ctx context.Context, actorID, tenantID uuid.UUID, input NewStaffInput) (*Staff, error)
	Update(ctx context.Context, actorID, tenantID, staffID uuid.UUID, input UpdateStaffInput) (*Staff, error)
	// IsActive reports whether the account may still use the staff screens
	IsActive(ctx context.Context, userID uuid.UUID) (bool, error)
}
