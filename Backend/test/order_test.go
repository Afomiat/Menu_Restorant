package test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"menu-backend/domain"
	"menu-backend/internal/security"
	"menu-backend/usecase"
)

func TestOrder_VIPPlanRequired(t *testing.T) {
	tenantID := uuid.New()
	qrSecret := "test-secret-key-32-chars-abcdef"

	tenantRepo := &mockTenantRepo{
		tenant: &domain.Tenant{
			ID:   tenantID,
			Name: "Standard Bistro",
			Plan: domain.PlanStandard, // Standard plan does NOT have smart ordering
		},
	}
	orderRepo := &mockOrderRepo{}
	tableRepo := &mockTableRepo{}
	menuRepo := &mockMenuRepo{}

	orderUc := usecase.NewOrderUsecase(orderRepo, tenantRepo, tableRepo, menuRepo, qrSecret)

	input := domain.CreateOrderInput{
		TenantID:    tenantID,
		TableNumber: "1",
		TableToken:  "any-token",
		Items: []domain.CreateOrderItemInput{
			{MenuItemID: uuid.New(), Quantity: 1},
		},
	}

	_, err := orderUc.PlaceOrder(context.Background(), input)
	if err == nil {
		t.Fatal("expected error when placing order on Standard tier restaurant, got nil")
	}

	expectedMsg := "digital ordering is disabled; this restaurant requires a VIP plan upgrade"
	if err.Error() != expectedMsg {
		t.Fatalf("expected '%s', got '%s'", expectedMsg, err.Error())
	}
}

func TestOrder_TableSpoofingProtection(t *testing.T) {
	tenantID := uuid.New()
	qrSecret := "test-secret-key-32-chars-abcdef"

	tenantRepo := &mockTenantRepo{
		tenant: &domain.Tenant{ID: tenantID, Plan: domain.PlanVIP},
	}
	orderRepo := &mockOrderRepo{}
	tableRepo := &mockTableRepo{}
	menuRepo := &mockMenuRepo{}

	orderUc := usecase.NewOrderUsecase(orderRepo, tenantRepo, tableRepo, menuRepo, qrSecret)

	// Attacker sends forged token
	input := domain.CreateOrderInput{
		TenantID:    tenantID,
		TableNumber: "1",
		TableToken:  "forged-table-token",
		Items: []domain.CreateOrderItemInput{
			{MenuItemID: uuid.New(), Quantity: 1},
		},
	}

	_, err := orderUc.PlaceOrder(context.Background(), input)
	if err == nil {
		t.Fatal("SECURITY VULNERABILITY: Order succeeded with forged table QR token!")
	}
}

func TestOrder_MissingTableTokenRejected(t *testing.T) {
	tenantID := uuid.New()
	qrSecret := "test-secret-key-32-chars-abcdef"

	tenantRepo := &mockTenantRepo{
		tenant: &domain.Tenant{ID: tenantID, Plan: domain.PlanVIP},
	}
	orderRepo := &mockOrderRepo{}
	tableRepo := &mockTableRepo{}
	menuRepo := &mockMenuRepo{}

	orderUc := usecase.NewOrderUsecase(orderRepo, tenantRepo, tableRepo, menuRepo, qrSecret)

	// Attacker sends empty token
	input := domain.CreateOrderInput{
		TenantID:    tenantID,
		TableNumber: "1",
		TableToken:  "",
		Items: []domain.CreateOrderItemInput{
			{MenuItemID: uuid.New(), Quantity: 1},
		},
	}

	_, err := orderUc.PlaceOrder(context.Background(), input)
	if err == nil {
		t.Fatal("SECURITY VULNERABILITY: Order succeeded with empty table QR token!")
	}
}

func TestOrder_ServerSidePriceLookupAndTamperProofing(t *testing.T) {
	tenantID := uuid.New()
	tableID := uuid.New()
	qrSecret := "test-secret-key-32-chars-abcdef"
	tableNumber := "5"
	validToken := security.GenerateTableToken(tenantID.String(), tableNumber, qrSecret)

	tenantRepo := &mockTenantRepo{
		tenant: &domain.Tenant{ID: tenantID, Plan: domain.PlanVIP},
	}
	tableRepo := &mockTableRepo{
		table: &domain.RestaurantTable{
			ID:          tableID,
			TenantID:    tenantID,
			TableNumber: tableNumber,
			IsActive:    true,
		},
	}

	itemID := uuid.New()
	menuRepo := &mockMenuRepo{
		item: &domain.MenuItem{
			ID:          itemID,
			TenantID:    tenantID,
			Name:        "The Truffle Prime",
			Price:       480.00, // Authentic server price
			IsAvailable: true,
			IsSoldOut:   false,
		},
	}
	orderRepo := &mockOrderRepo{}

	orderUc := usecase.NewOrderUsecase(orderRepo, tenantRepo, tableRepo, menuRepo, qrSecret)

	// Malicious client tries to buy the 480 ETB burger for 1 ETB
	input := domain.CreateOrderInput{
		TenantID:             tenantID,
		TableNumber:          tableNumber,
		TableToken:           validToken,
		CustomerSessionToken: "session-xyz",
		Items: []domain.CreateOrderItemInput{
			{
				MenuItemID: itemID,
				ItemName:   "The Truffle Prime",
				UnitPrice:  1.00, // Spoofed client price!
				Quantity:   2,
			},
		},
	}

	order, err := orderUc.PlaceOrder(context.Background(), input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Server MUST have overridden the price with 480.00 * 2 = 960.00
	expectedTotal := 960.00
	if order.TotalAmount != expectedTotal {
		t.Fatalf("FINANCIAL VULNERABILITY: Client spoofed price accepted! Expected total %.2f, got %.2f", expectedTotal, order.TotalAmount)
	}

	// Order status must be pending_grace
	if order.Status != domain.StatusPendingGrace {
		t.Errorf("expected status %s, got %s", domain.StatusPendingGrace, order.Status)
	}

	// Grace period must be between 55 and 65 seconds in the future
	now := time.Now()
	diff := order.GracePeriodEndsAt.Sub(now).Seconds()
	if diff < 55 || diff > 65 {
		t.Errorf("expected ~60s grace period, got %f seconds", diff)
	}
}

func TestOrder_SoldOutRejection(t *testing.T) {
	tenantID := uuid.New()
	tableID := uuid.New()
	qrSecret := "test-secret-key-32-chars-abcdef"
	tableNumber := "5"
	validToken := security.GenerateTableToken(tenantID.String(), tableNumber, qrSecret)

	tenantRepo := &mockTenantRepo{
		tenant: &domain.Tenant{ID: tenantID, Plan: domain.PlanVIP},
	}
	tableRepo := &mockTableRepo{
		table: &domain.RestaurantTable{
			ID:          tableID,
			TenantID:    tenantID,
			TableNumber: tableNumber,
			IsActive:    true,
		},
	}

	itemID := uuid.New()
	menuRepo := &mockMenuRepo{
		item: &domain.MenuItem{
			ID:          itemID,
			TenantID:    tenantID,
			Name:        "The Truffle Prime",
			Price:       480.00,
			IsAvailable: true,
			IsSoldOut:   true, // Kitchen 86'd this item!
		},
	}
	orderRepo := &mockOrderRepo{}

	orderUc := usecase.NewOrderUsecase(orderRepo, tenantRepo, tableRepo, menuRepo, qrSecret)

	input := domain.CreateOrderInput{
		TenantID:    tenantID,
		TableNumber: tableNumber,
		TableToken:  validToken,
		Items: []domain.CreateOrderItemInput{
			{MenuItemID: itemID, Quantity: 1},
		},
	}

	_, err := orderUc.PlaceOrder(context.Background(), input)
	if err == nil {
		t.Fatal("expected order placement to fail for sold-out item, but it succeeded")
	}
}

func TestOrder_NegativeModifierPriceRejection(t *testing.T) {
	tenantID := uuid.New()
	tableID := uuid.New()
	qrSecret := "test-secret-key-32-chars-abcdef"
	tableNumber := "5"
	validToken := security.GenerateTableToken(tenantID.String(), tableNumber, qrSecret)

	tenantRepo := &mockTenantRepo{tenant: &domain.Tenant{ID: tenantID, Plan: domain.PlanVIP}}
	tableRepo := &mockTableRepo{
		table: &domain.RestaurantTable{ID: tableID, TenantID: tenantID, TableNumber: tableNumber, IsActive: true},
	}
	itemID := uuid.New()
	menuRepo := &mockMenuRepo{
		item: &domain.MenuItem{ID: itemID, TenantID: tenantID, Price: 480.00, IsAvailable: true},
	}
	orderRepo := &mockOrderRepo{}

	orderUc := usecase.NewOrderUsecase(orderRepo, tenantRepo, tableRepo, menuRepo, qrSecret)

	input := domain.CreateOrderInput{
		TenantID:    tenantID,
		TableNumber: tableNumber,
		TableToken:  validToken,
		Items: []domain.CreateOrderItemInput{
			{
				MenuItemID: itemID,
				Quantity:   1,
				Modifiers: []domain.OrderItemModifier{
					{ModifierID: uuid.New(), ModifierName: "Hack", PriceApplied: -500.00},
				},
			},
		},
	}

	_, err := orderUc.PlaceOrder(context.Background(), input)
	if err == nil {
		t.Fatal("FINANCIAL VULNERABILITY: Negative modifier price was accepted!")
	}
}

func TestOrder_UndoSuccessAndTimeout(t *testing.T) {
	tenantID := uuid.New()
	orderID := uuid.New()
	sessionToken := "customer-secret-session"

	// 1. Success case
	orderRepo := &mockOrderRepo{}
	orderUc := usecase.NewOrderUsecase(orderRepo, nil, nil, nil, "")

	err := orderUc.UndoOrder(context.Background(), tenantID, orderID, sessionToken)
	if err != nil {
		t.Fatalf("expected successful undo, got: %v", err)
	}
	if !orderRepo.cancelCalled {
		t.Fatal("expected CancelInGrace to be called on repo")
	}

	// 2. Timeout case (repo returns error because grace_period_ends_at < NOW())
	expiredRepo := &mockOrderRepo{err: errors.New("no rows updated")}
	expiredUc := usecase.NewOrderUsecase(expiredRepo, nil, nil, nil, "")

	err = expiredUc.UndoOrder(context.Background(), tenantID, orderID, sessionToken)
	if err == nil {
		t.Fatal("expected error when 60s grace window expired, got nil")
	}
}
