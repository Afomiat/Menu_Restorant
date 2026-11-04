package test

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"

	"menu-backend/domain"
	"menu-backend/internal/security"
)

// mockActivityRepo remembers every recorded activity
type mockActivityRepo struct {
	mu      sync.Mutex
	records []domain.Activity
	err     error
}

func (m *mockActivityRepo) Record(ctx context.Context, a domain.Activity) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.err != nil {
		return m.err
	}
	m.records = append(m.records, a)
	return nil
}

func (m *mockActivityRepo) List(ctx context.Context, tenantID uuid.UUID, limit int) ([]domain.Activity, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []domain.Activity
	for i := len(m.records) - 1; i >= 0 && len(out) < limit; i-- {
		if m.records[i].TenantID == tenantID {
			out = append(out, m.records[i])
		}
	}
	return out, nil
}

func (m *mockActivityRepo) actions() []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	actions := make([]string, len(m.records))
	for i, r := range m.records {
		actions[i] = r.Action
	}
	return actions
}

// memStaffRepo keeps staff in memory with the same uniqueness rules as the database
type memStaffRepo struct {
	mu          sync.Mutex
	staff       map[uuid.UUID]*domain.StaffCredentials
	activeReads int
}

func newMemStaffRepo() *memStaffRepo {
	return &memStaffRepo{staff: make(map[uuid.UUID]*domain.StaffCredentials)}
}

// add stores a staff member directly with a hashed password and returns them
func (m *memStaffRepo) add(tenantID uuid.UUID, fullName, phone, email, password string, role domain.Role) domain.Staff {
	hash, _ := security.HashPassword(password)
	creds := &domain.StaffCredentials{
		Staff: domain.Staff{
			ID: uuid.New(), TenantID: tenantID, FullName: fullName, Phone: phone, Email: email,
			Role: role, IsActive: true, CreatedAt: time.Now(),
		},
		PasswordHash: hash,
	}
	m.mu.Lock()
	m.staff[creds.ID] = creds
	m.mu.Unlock()
	return creds.Staff
}

func (m *memStaffRepo) GetByEmail(ctx context.Context, email string) (*domain.StaffCredentials, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, s := range m.staff {
		if s.Email != "" && s.Email == email {
			c := *s
			return &c, nil
		}
	}
	return nil, domain.ErrStaffNotFound
}

func (m *memStaffRepo) GetByTenantPhone(ctx context.Context, tenantID uuid.UUID, phone string) (*domain.StaffCredentials, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, s := range m.staff {
		if s.TenantID == tenantID && s.Phone == phone {
			c := *s
			return &c, nil
		}
	}
	return nil, domain.ErrStaffNotFound
}

func (m *memStaffRepo) GetByID(ctx context.Context, tenantID, id uuid.UUID) (*domain.Staff, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.staff[id]
	if !ok || s.TenantID != tenantID {
		return nil, domain.ErrStaffNotFound
	}
	c := s.Staff
	return &c, nil
}

func (m *memStaffRepo) List(ctx context.Context, tenantID uuid.UUID) ([]domain.Staff, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []domain.Staff{}
	for _, s := range m.staff {
		if s.TenantID == tenantID {
			out = append(out, s.Staff)
		}
	}
	return out, nil
}

func (m *memStaffRepo) Create(ctx context.Context, tenantID uuid.UUID, input domain.NewStaffInput, passwordHash string) (*domain.Staff, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, s := range m.staff {
		if s.TenantID == tenantID && s.Phone == input.Phone {
			return nil, domain.ErrPhoneTaken
		}
		if input.Email != "" && s.Email == input.Email {
			return nil, domain.ErrEmailTaken
		}
	}
	creds := &domain.StaffCredentials{
		Staff: domain.Staff{
			ID: uuid.New(), TenantID: tenantID, FullName: input.FullName, Phone: input.Phone, Email: input.Email,
			Role: input.Role, IsActive: true, CreatedAt: time.Now(),
		},
		PasswordHash: passwordHash,
	}
	m.staff[creds.ID] = creds
	c := creds.Staff
	return &c, nil
}

func (m *memStaffRepo) Update(ctx context.Context, tenantID, id uuid.UUID, changes domain.StaffChanges) (*domain.Staff, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.staff[id]
	if !ok || s.TenantID != tenantID {
		return nil, domain.ErrStaffNotFound
	}
	if changes.FullName != nil {
		s.FullName = *changes.FullName
	}
	if changes.Role != nil {
		s.Role = *changes.Role
	}
	if changes.IsActive != nil {
		s.IsActive = *changes.IsActive
	}
	if changes.PasswordHash != nil {
		s.PasswordHash = *changes.PasswordHash
	}
	c := s.Staff
	return &c, nil
}

func (m *memStaffRepo) IsActive(ctx context.Context, id uuid.UUID) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.activeReads++
	s, ok := m.staff[id]
	if !ok {
		return false, domain.ErrStaffNotFound
	}
	return s.IsActive, nil
}

func (m *memStaffRepo) CountActiveManagers(ctx context.Context, tenantID uuid.UUID) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	n := 0
	for _, s := range m.staff {
		if s.TenantID == tenantID && s.Role == domain.RoleManager && s.IsActive {
			n++
		}
	}
	return n, nil
}

func (m *memStaffRepo) passwordHash(id uuid.UUID) string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.staff[id].PasswordHash
}

// allActiveStaff treats every login as an active staff account, for tests about other features
type allActiveStaff struct{}

func (allActiveStaff) Login(ctx context.Context, input domain.LoginInput) (*domain.Staff, error) {
	return nil, domain.ErrInvalidLogin
}
func (allActiveStaff) List(ctx context.Context, tenantID uuid.UUID) ([]domain.Staff, error) {
	return []domain.Staff{}, nil
}
func (allActiveStaff) Create(ctx context.Context, actorID, tenantID uuid.UUID, input domain.NewStaffInput) (*domain.Staff, error) {
	return nil, domain.ErrStaffNotFound
}
func (allActiveStaff) Update(ctx context.Context, actorID, tenantID, staffID uuid.UUID, input domain.UpdateStaffInput) (*domain.Staff, error) {
	return nil, domain.ErrStaffNotFound
}
func (allActiveStaff) IsActive(ctx context.Context, userID uuid.UUID) (bool, error) {
	return true, nil
}
