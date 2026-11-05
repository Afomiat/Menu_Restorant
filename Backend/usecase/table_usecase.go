package usecase

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"menu-backend/domain"
	"menu-backend/internal/security"
)

type tableUsecase struct {
	tableRepo    domain.TableRepository
	staffRepo    domain.StaffRepository
	activityRepo domain.ActivityRepository
	secretKey    string
}

func NewTableUsecase(tableRepo domain.TableRepository, staffRepo domain.StaffRepository, activityRepo domain.ActivityRepository, secretKey string) domain.TableUsecase {
	return &tableUsecase{
		tableRepo:    tableRepo,
		staffRepo:    staffRepo,
		activityRepo: activityRepo,
		secretKey:    secretKey,
	}
}

func (u *tableUsecase) AssignWaiter(ctx context.Context, actorID, tenantID, tableID uuid.UUID, waiterID *uuid.UUID) (*domain.RestaurantTable, error) {
	waiterName := ""
	if waiterID != nil {
		waiter, err := u.staffRepo.GetByID(ctx, tenantID, *waiterID)
		if errors.Is(err, domain.ErrStaffNotFound) || (err == nil && (waiter.Role != domain.RoleWaiter || !waiter.IsActive)) {
			return nil, domain.ErrNotAWaiter
		}
		if err != nil {
			return nil, err
		}
		waiterName = waiter.FullName
	}

	table, err := u.tableRepo.UpdateWaiter(ctx, tenantID, tableID, waiterID)
	if err != nil {
		return nil, err
	}
	table.AssignedWaiterName = waiterName

	recordActivity(ctx, u.activityRepo, domain.Activity{
		TenantID: tenantID,
		ActorID:  actorID,
		Action:   domain.ActionWaiterAssigned,
		Details:  map[string]interface{}{"table_id": tableID, "table_number": table.TableNumber, "waiter_id": waiterID, "waiter_name": waiterName},
	})
	return table, nil
}

// GenerateTableQR creates a tamper-proof QR code URL with an HMAC token
func (u *tableUsecase) GenerateTableQR(ctx context.Context, tenantSlug string, tenantID uuid.UUID, tableNumber string) (string, error) {
	// 1. Verify the table exists and is active
	table, err := u.tableRepo.GetByNumber(ctx, tenantID, tableNumber)
	if err != nil {
		return "", fmt.Errorf("table %s not found: %w", tableNumber, err)
	}

	// 2. Generate HMAC signature token
	token := security.GenerateTableToken(tenantID.String(), table.TableNumber, u.secretKey)

	// 3. Return the full dine-in QR URL path
	qrURL := fmt.Sprintf("/m/%s?table=%s&token=%s", tenantSlug, table.TableNumber, token)
	return qrURL, nil
}

// ValidateTableToken verifies that a scanned table QR token has not been forged
func (u *tableUsecase) ValidateTableToken(ctx context.Context, tenantID uuid.UUID, tableNumber, token string) (bool, error) {
	// 1. Cryptographic HMAC check
	if !security.ValidateTableToken(tenantID.String(), tableNumber, u.secretKey, token) {
		return false, fmt.Errorf("invalid or forged table token")
	}

	// 2. Database existence check
	table, err := u.tableRepo.GetByNumber(ctx, tenantID, tableNumber)
	if err != nil || !table.IsActive {
		return false, fmt.Errorf("table %s is inactive or does not exist", tableNumber)
	}

	return true, nil
}

func (u *tableUsecase) ListTables(ctx context.Context, tenantID uuid.UUID) ([]domain.RestaurantTable, error) {
	return u.tableRepo.ListByTenant(ctx, tenantID)
}

func (u *tableUsecase) CreateTable(ctx context.Context, input domain.CreateTableInput) (*domain.RestaurantTable, error) {
	table := &domain.RestaurantTable{
		TenantID:    input.TenantID,
		TableNumber: input.TableNumber,
		QrSecret:    u.secretKey,
		IsActive:    true,
	}
	if err := u.tableRepo.Create(ctx, table); err != nil {
		return nil, err
	}
	return table, nil
}
