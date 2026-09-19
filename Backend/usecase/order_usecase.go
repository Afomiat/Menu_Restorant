package usecase

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"menu-backend/domain"
	"menu-backend/internal/security"
)

type orderUsecase struct {
	orderRepo        domain.OrderRepository
	tenantRepo       domain.TenantRepository
	tableRepo        domain.TableRepository
	menuRepo         domain.MenuRepository
	tableTokenSecret string
}

func NewOrderUsecase(
	orderRepo domain.OrderRepository,
	tenantRepo domain.TenantRepository,
	tableRepo domain.TableRepository,
	menuRepo domain.MenuRepository,
	tableTokenSecret string,
) domain.OrderUsecase {
	return &orderUsecase{
		orderRepo:        orderRepo,
		tenantRepo:       tenantRepo,
		tableRepo:        tableRepo,
		menuRepo:         menuRepo,
		tableTokenSecret: tableTokenSecret,
	}
}

func (u *orderUsecase) PlaceOrder(ctx context.Context, input domain.CreateOrderInput) (*domain.Order, error) {
	// 1. BUSINESS RULE: Verify VIP License Tier
	tenant, err := u.tenantRepo.GetByID(ctx, input.TenantID)
	if err != nil {
		return nil, fmt.Errorf("tenant not found: %w", err)
	}

	if !tenant.HasVIPFeatures() {
		return nil, errors.New("digital ordering is disabled; this restaurant requires a VIP plan upgrade")
	}

	// 2. SECURITY CHECK: Verify cryptographic table QR token
	if !security.ValidateTableToken(input.TenantID.String(), input.TableNumber, u.tableTokenSecret, input.TableToken) {
		return nil, errors.New("invalid or forged table QR token; please re-scan the table QR code")
	}

	// 3. Validate dining table existence in DB
	table, err := u.tableRepo.GetByNumber(ctx, input.TenantID, input.TableNumber)
	if err != nil || !table.IsActive {
		return nil, fmt.Errorf("invalid or inactive table: %s", input.TableNumber)
	}

	if len(input.Items) == 0 {
		return nil, errors.New("cannot place an order with zero items")
	}

	// 4. SECURITY & FINANCIAL CHECK: Server-side price calculation & stock verification
	var totalAmount float64
	orderItems := make([]domain.OrderItem, len(input.Items))

	for i, itemInput := range input.Items {
		if itemInput.Quantity <= 0 {
			return nil, fmt.Errorf("invalid quantity for item: %s", itemInput.ItemName)
		}

		// Query the database for the item's authentic price and status
		dbItem, err := u.menuRepo.GetItemByID(ctx, input.TenantID, itemInput.MenuItemID)
		if err != nil {
			return nil, fmt.Errorf("item not found or does not belong to this restaurant: %s", itemInput.MenuItemID)
		}

		if !dbItem.IsAvailable {
			return nil, fmt.Errorf("item '%s' is currently unavailable", dbItem.Name)
		}

		if dbItem.IsSoldOut {
			return nil, fmt.Errorf("item '%s' is currently sold out (86'd)", dbItem.Name)
		}

		// Use the server-side price (never trust client-supplied unit_price)
		realUnitPrice := dbItem.Price
		itemTotal := realUnitPrice * float64(itemInput.Quantity)

		var itemModifiers []domain.OrderItemModifier
		for _, mod := range itemInput.Modifiers {
			if mod.PriceApplied < 0 {
				return nil, errors.New("modifier price cannot be negative")
			}
			itemTotal += mod.PriceApplied * float64(itemInput.Quantity)
			itemModifiers = append(itemModifiers, domain.OrderItemModifier{
				ModifierID:   mod.ModifierID,
				ModifierName: mod.ModifierName,
				PriceApplied: mod.PriceApplied,
			})
		}

		totalAmount += itemTotal

		orderItems[i] = domain.OrderItem{
			MenuItemID: dbItem.ID,
			ItemName:   dbItem.Name,
			UnitPrice:  realUnitPrice,
			Quantity:   itemInput.Quantity,
			Notes:      itemInput.Notes,
			Modifiers:  itemModifiers,
		}
	}

	// 5. BUSINESS RULE: 60-second grace period for Undo
	now := time.Now()
	graceEndsAt := now.Add(60 * time.Second)

	order := &domain.Order{
		TenantID:             input.TenantID,
		TableID:              &table.ID,
		TableNumber:          table.TableNumber,
		CustomerSessionToken: input.CustomerSessionToken,
		Status:               domain.StatusPendingGrace,
		TotalAmount:          totalAmount,
		GracePeriodEndsAt:    graceEndsAt,
		CreatedAt:            now,
		UpdatedAt:            now,
		Items:                orderItems,
	}

	// 6. Persist atomically
	if err := u.orderRepo.Create(ctx, order); err != nil {
		return nil, fmt.Errorf("failed to save order: %w", err)
	}

	return order, nil
}

func (u *orderUsecase) UndoOrder(ctx context.Context, tenantID, orderID uuid.UUID, sessionToken string) error {
	err := u.orderRepo.CancelInGrace(ctx, tenantID, orderID, sessionToken)
	if err != nil {
		return fmt.Errorf("cannot undo order; the 60-second cancellation window has expired or order was already processed: %w", err)
	}
	return nil
}

func (u *orderUsecase) UpdateKitchenStatus(ctx context.Context, tenantID, orderID uuid.UUID, status domain.OrderStatus) error {
	return u.orderRepo.UpdateStatus(ctx, tenantID, orderID, status)
}

func (u *orderUsecase) GetOrderByID(ctx context.Context, tenantID, orderID uuid.UUID) (*domain.Order, error) {
	return u.orderRepo.GetByID(ctx, tenantID, orderID)
}

func (u *orderUsecase) GetActiveKitchenOrders(ctx context.Context, tenantID uuid.UUID) ([]domain.Order, error) {
	return u.orderRepo.ListActiveByTenant(ctx, tenantID)
}
