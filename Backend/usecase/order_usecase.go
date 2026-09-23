package usecase

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"menu-backend/domain"
	"menu-backend/internal/security"
)

type cachedTenant struct {
	tenant    *domain.Tenant
	expiresAt time.Time
}

type cachedTable struct {
	table     *domain.RestaurantTable
	expiresAt time.Time
}

type cachedItem struct {
	item      *domain.MenuItem
	expiresAt time.Time
}

type cachedModifier struct {
	modifier  *domain.Modifier
	expiresAt time.Time
}

type orderUsecase struct {
	orderRepo        domain.OrderRepository
	tenantRepo       domain.TenantRepository
	tableRepo        domain.TableRepository
	menuRepo         domain.MenuRepository
	tableTokenSecret string

	tenantCache   map[uuid.UUID]cachedTenant
	tableCache    map[string]cachedTable
	itemCache     map[uuid.UUID]cachedItem
	modifierCache map[uuid.UUID]cachedModifier
	cacheMu       sync.RWMutex
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
		tenantCache:      make(map[uuid.UUID]cachedTenant),
		tableCache:       make(map[string]cachedTable),
		itemCache:        make(map[uuid.UUID]cachedItem),
		modifierCache:    make(map[uuid.UUID]cachedModifier),
	}
}

func (u *orderUsecase) PlaceOrder(ctx context.Context, input domain.CreateOrderInput) (*domain.Order, error) {
	// 1. BUSINESS RULE: Verify VIP License Tier (with in-memory cache)
	var tenant *domain.Tenant
	u.cacheMu.RLock()
	if c, ok := u.tenantCache[input.TenantID]; ok && time.Now().Before(c.expiresAt) {
		tenant = c.tenant
	}
	u.cacheMu.RUnlock()

	if tenant == nil {
		var err error
		tenant, err = u.tenantRepo.GetByID(ctx, input.TenantID)
		if err != nil {
			return nil, fmt.Errorf("tenant not found: %w", err)
		}
		u.cacheMu.Lock()
		u.tenantCache[input.TenantID] = cachedTenant{
			tenant:    tenant,
			expiresAt: time.Now().Add(30 * time.Second),
		}
		u.cacheMu.Unlock()
	}

	if !tenant.HasVIPFeatures() {
		return nil, errors.New("digital ordering is disabled; this restaurant requires a VIP plan upgrade")
	}

	// 2. SECURITY CHECK: Verify cryptographic HMAC signature for table orders
	if strings.TrimSpace(input.TableToken) == "" {
		return nil, errors.New("table token is required; please scan the QR code on your dining table to order")
	}
	if !security.ValidateTableToken(input.TenantID.String(), input.TableNumber, u.tableTokenSecret, input.TableToken) {
		return nil, errors.New("invalid or expired table QR token; please re-scan the table QR code")
	}

	// 3. Validate dining table existence in DB (with in-memory cache)
	tableKey := input.TenantID.String() + ":" + strings.TrimSpace(input.TableNumber)
	var table *domain.RestaurantTable
	u.cacheMu.RLock()
	if c, ok := u.tableCache[tableKey]; ok && time.Now().Before(c.expiresAt) {
		table = c.table
	}
	u.cacheMu.RUnlock()

	if table == nil {
		var err error
		table, err = u.tableRepo.GetByNumber(ctx, input.TenantID, input.TableNumber)
		if err != nil || !table.IsActive {
			return nil, fmt.Errorf("table '%s' is not registered or active for this restaurant", input.TableNumber)
		}
		u.cacheMu.Lock()
		u.tableCache[tableKey] = cachedTable{
			table:     table,
			expiresAt: time.Now().Add(5 * time.Minute),
		}
		u.cacheMu.Unlock()
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
		if itemInput.Quantity > 50 {
			return nil, fmt.Errorf("quantity exceeds maximum allowed limit (50) for item: %s", itemInput.ItemName)
		}

		// Query cache/DB for the authentic price and status
		var dbItem *domain.MenuItem
		u.cacheMu.RLock()
		if c, ok := u.itemCache[itemInput.MenuItemID]; ok && time.Now().Before(c.expiresAt) {
			dbItem = c.item
		}
		u.cacheMu.RUnlock()

		if dbItem == nil {
			var err error
			dbItem, err = u.menuRepo.GetItemByID(ctx, input.TenantID, itemInput.MenuItemID)
			if err != nil {
				return nil, fmt.Errorf("item not found or does not belong to this restaurant: %s", itemInput.MenuItemID)
			}
			u.cacheMu.Lock()
			u.itemCache[itemInput.MenuItemID] = cachedItem{
				item:      dbItem,
				expiresAt: time.Now().Add(2 * time.Minute),
			}
			u.cacheMu.Unlock()
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
			if mod.ModifierID == uuid.Nil {
				continue
			}

			if mod.PriceApplied < 0 {
				return nil, errors.New("modifier price cannot be negative")
			}

			// Financial Security: Lookup modifier ground truth with cache
			var dbMod *domain.Modifier
			u.cacheMu.RLock()
			if c, ok := u.modifierCache[mod.ModifierID]; ok && time.Now().Before(c.expiresAt) {
				dbMod = c.modifier
			}
			u.cacheMu.RUnlock()

			if dbMod == nil {
				var err error
				dbMod, err = u.menuRepo.GetModifierByID(ctx, input.TenantID, mod.ModifierID)
				if err != nil || dbMod == nil {
					return nil, fmt.Errorf("modifier not found or does not belong to this restaurant: %s", mod.ModifierID)
				}
				u.cacheMu.Lock()
				u.modifierCache[mod.ModifierID] = cachedModifier{
					modifier:  dbMod,
					expiresAt: time.Now().Add(5 * time.Minute),
				}
				u.cacheMu.Unlock()
			}

			realModPrice := dbMod.PriceAdjustment
			if realModPrice < 0 {
				realModPrice = 0
			}

			itemTotal += realModPrice * float64(itemInput.Quantity)
			itemModifiers = append(itemModifiers, domain.OrderItemModifier{
				ModifierID:   dbMod.ID,
				ModifierName: dbMod.Name,
				PriceApplied: realModPrice,
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

func (u *orderUsecase) BulkCancelTableOrders(ctx context.Context, tenantID uuid.UUID, tableNumber string) error {
	return u.orderRepo.BulkCancelTableOrders(ctx, tenantID, tableNumber)
}

func (u *orderUsecase) BulkCancelAllActive(ctx context.Context, tenantID uuid.UUID) error {
	return u.orderRepo.BulkCancelAllActive(ctx, tenantID)
}
