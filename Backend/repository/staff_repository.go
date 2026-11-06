package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"menu-backend/db/sqlc"
	"menu-backend/domain"
	"menu-backend/internal/converter"
)

type staffRepository struct {
	q *sqlc.Queries
}

func NewStaffRepository(q *sqlc.Queries) domain.StaffRepository {
	return &staffRepository{q: q}
}

func (r *staffRepository) GetByEmail(ctx context.Context, email string) (*domain.StaffCredentials, error) {
	u, err := r.q.GetUserByEmail(ctx, converter.StringToText(email))
	if err != nil {
		return nil, staffError(err)
	}
	return toStaffCredentials(u), nil
}

func (r *staffRepository) GetByTenantPhone(ctx context.Context, tenantID uuid.UUID, phone string) (*domain.StaffCredentials, error) {
	u, err := r.q.GetUserByTenantPhone(ctx, sqlc.GetUserByTenantPhoneParams{
		TenantID: converter.UUIDToPg(tenantID),
		Phone:    converter.StringToText(phone),
	})
	if err != nil {
		return nil, staffError(err)
	}
	return toStaffCredentials(u), nil
}

func (r *staffRepository) GetByID(ctx context.Context, tenantID, id uuid.UUID) (*domain.Staff, error) {
	u, err := r.q.GetStaffByID(ctx, sqlc.GetStaffByIDParams{
		TenantID: converter.UUIDToPg(tenantID),
		ID:       converter.UUIDToPg(id),
	})
	if err != nil {
		return nil, staffError(err)
	}
	return &toStaffCredentials(u).Staff, nil
}

func (r *staffRepository) List(ctx context.Context, tenantID uuid.UUID) ([]domain.Staff, error) {
	users, err := r.q.ListStaff(ctx, converter.UUIDToPg(tenantID))
	if err != nil {
		return nil, err
	}
	staff := make([]domain.Staff, 0, len(users))
	for _, u := range users {
		staff = append(staff, toStaffCredentials(u).Staff)
	}
	return staff, nil
}

func (r *staffRepository) Create(ctx context.Context, tenantID uuid.UUID, input domain.NewStaffInput, passwordHash string) (*domain.Staff, error) {
	u, err := r.q.CreateUser(ctx, sqlc.CreateUserParams{
		TenantID:     converter.UUIDToPg(tenantID),
		Email:        converter.StringToText(input.Email),
		Phone:        converter.StringToText(input.Phone),
		FullName:     input.FullName,
		PasswordHash: passwordHash,
		Role:         sqlc.UserRole(input.Role),
	})
	if err != nil {
		return nil, staffError(err)
	}
	return &toStaffCredentials(u).Staff, nil
}

func (r *staffRepository) Update(ctx context.Context, tenantID, id uuid.UUID, changes domain.StaffChanges) (*domain.Staff, error) {
	params := sqlc.UpdateStaffParams{
		TenantID: converter.UUIDToPg(tenantID),
		ID:       converter.UUIDToPg(id),
	}
	if changes.FullName != nil {
		params.FullName = pgtype.Text{String: *changes.FullName, Valid: true}
	}
	if changes.Role != nil {
		params.Role = sqlc.NullUserRole{UserRole: sqlc.UserRole(*changes.Role), Valid: true}
	}
	if changes.IsActive != nil {
		params.IsActive = pgtype.Bool{Bool: *changes.IsActive, Valid: true}
	}
	if changes.PasswordHash != nil {
		params.PasswordHash = pgtype.Text{String: *changes.PasswordHash, Valid: true}
	}

	u, err := r.q.UpdateStaff(ctx, params)
	if err != nil {
		return nil, staffError(err)
	}
	return &toStaffCredentials(u).Staff, nil
}

func (r *staffRepository) IsActive(ctx context.Context, id uuid.UUID) (bool, error) {
	active, err := r.q.IsUserActive(ctx, converter.UUIDToPg(id))
	if err != nil {
		return false, staffError(err)
	}
	return active, nil
}

func (r *staffRepository) CountActiveManagers(ctx context.Context, tenantID uuid.UUID) (int, error) {
	n, err := r.q.CountActiveManagers(ctx, converter.UUIDToPg(tenantID))
	return int(n), err
}

// staffError turns database errors into the staff errors the usecase understands
func staffError(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrStaffNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		switch pgErr.ConstraintName {
		case "users_tenant_phone_key":
			return domain.ErrPhoneTaken
		case "users_email_key":
			return domain.ErrEmailTaken
		}
	}
	return err
}

func toStaffCredentials(u sqlc.User) *domain.StaffCredentials {
	return &domain.StaffCredentials{
		Staff: domain.Staff{
			ID:        converter.PgToUUID(u.ID),
			TenantID:  converter.PgToUUID(u.TenantID),
			FullName:  u.FullName,
			Phone:     converter.TextToString(u.Phone),
			Email:     converter.TextToString(u.Email),
			Role:      domain.NormalizeRole(string(u.Role)),
			IsActive:  u.IsActive,
			CreatedAt: converter.PgToTime(u.CreatedAt),
		},
		PasswordHash: u.PasswordHash,
	}
}
