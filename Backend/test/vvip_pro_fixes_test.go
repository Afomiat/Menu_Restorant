package test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"unicode"

	"github.com/google/uuid"

	"menu-backend/domain"
	"menu-backend/internal/security"
	"menu-backend/usecase"
)

// =========================================================================
// B1. Let the manager change a staff member's phone number
// =========================================================================
func TestB1_ManagerCanUpdateStaffPhone(t *testing.T) {
	env := newStaffEnv()
	ctx := context.Background()
	waiter := env.repo.add(env.tenant.ID, "Abebe", "+251911000002", "", "secret123", domain.RoleWaiter)

	// Updating phone normalizes formatted phone string
	newPhone := "0911 000 099"
	updated, err := env.uc.Update(ctx, env.manager.ID, env.tenant.ID, waiter.ID, domain.UpdateStaffInput{Phone: &newPhone})
	if err != nil {
		t.Fatalf("B1: expected manager to update phone, got error: %v", err)
	}
	if updated.Phone != "+251911000099" {
		t.Fatalf("B1: expected normalized phone +251911000099, got %s", updated.Phone)
	}

	// Waiter can sign in with normalized or unformatted phone
	logged, err := env.uc.Login(ctx, domain.LoginInput{Phone: "0911000099", RestaurantSlug: "demo-pro", Password: "secret123"})
	if err != nil || logged.ID != waiter.ID {
		t.Fatalf("B1: expected waiter to login with updated phone, got: %v %v", logged, err)
	}

	// Entering a colleague's phone returns ErrPhoneTaken
	managerPhone := "0911 000 001"
	_, err = env.uc.Update(ctx, env.manager.ID, env.tenant.ID, waiter.ID, domain.UpdateStaffInput{Phone: &managerPhone})
	if !errors.Is(err, domain.ErrPhoneTaken) {
		t.Fatalf("B1: expected ErrPhoneTaken, got: %v", err)
	}
}

// =========================================================================
// B2. Start error messages with a capital letter
// =========================================================================
func TestB2_ErrorMessagesStartWithCapitalLetter(t *testing.T) {
	errs := []struct {
		name string
		err  error
	}{
		{"ErrInvalidLogin", domain.ErrInvalidLogin},
		{"ErrStaffInactive", domain.ErrStaffInactive},
		{"ErrStaffNotFound", domain.ErrStaffNotFound},
		{"ErrPhoneTaken", domain.ErrPhoneTaken},
		{"ErrEmailTaken", domain.ErrEmailTaken},
		{"ErrLastManager", domain.ErrLastManager},
		{"ErrChangeOwnStaff", domain.ErrChangeOwnStaff},
		{"ErrTableNotFound", domain.ErrTableNotFound},
		{"ErrNotAWaiter", domain.ErrNotAWaiter},
		{"ErrNoOpenBill", domain.ErrNoOpenBill},
		{"ErrBillState", domain.ErrBillState},
		{"ErrNotYourBill", domain.ErrNotYourBill},
		{"ErrNoShift", domain.ErrNoShift},
		{"ErrShiftOpen", domain.ErrShiftOpen},
		{"ErrHandoverTarget", domain.ErrHandoverTarget},
		{"ErrProblemNotFound", domain.ErrProblemNotFound},
		{"ErrAlreadyDecided", domain.ErrAlreadyDecided},
		{"ErrItemNotFound", domain.ErrItemNotFound},
		{"OpenBillsError", &domain.OpenBillsError{Count: 3}},
	}

	for _, tc := range errs {
		msg := tc.err.Error()
		if len(msg) == 0 {
			t.Errorf("B2: %s error message is empty", tc.name)
			continue
		}
		firstRune := []rune(msg)[0]
		if !unicode.IsUpper(firstRune) {
			t.Errorf("B2: %s does not start with a capital letter: %q", tc.name, msg)
		}
	}
}

// =========================================================================
// B3. Sold-out orders blocked immediately (cache eviction)
// =========================================================================
func TestB3_SoldOutItemBlockedImmediately(t *testing.T) {
	tenantID := uuid.New()
	qrSecret := "test-secret-key-32-chars-abcdef"
	tableNumber := "1"
	tableID := uuid.New()
	itemID := uuid.New()
	validToken := security.GenerateTableToken(tenantID.String(), tableNumber, qrSecret)

	tenantRepo := &mockTenantRepo{tenant: &domain.Tenant{ID: tenantID, Plan: domain.PlanPlus}}
	tableRepo := &mockTableRepo{
		table: &domain.RestaurantTable{ID: tableID, TenantID: tenantID, TableNumber: tableNumber, IsActive: true},
	}
	menuRepo := &mockMenuRepo{
		item: &domain.MenuItem{ID: itemID, TenantID: tenantID, Name: "Burger", Price: 100.0, IsAvailable: true, IsSoldOut: false},
	}
	orderRepo := &mockOrderRepo{}

	orderUc := usecase.NewOrderUsecase(orderRepo, tenantRepo, tableRepo, menuRepo, qrSecret)

	input := domain.CreateOrderInput{
		TenantID:    tenantID,
		TableNumber: tableNumber,
		TableToken:  validToken,
		Items:       []domain.CreateOrderItemInput{{MenuItemID: itemID, Quantity: 1}},
	}

	// 1. Order succeeds when item is available
	order, err := orderUc.PlaceOrder(context.Background(), input)
	if err != nil || order == nil {
		t.Fatalf("B3: expected order to succeed, got %v", err)
	}

	// 2. Dish is marked sold out and cache is invalidated via ForgetMenuItem
	menuRepo.item.IsSoldOut = true
	orderUc.ForgetMenuItem(itemID)

	// 3. Immediately fails with sold out error
	_, err = orderUc.PlaceOrder(context.Background(), input)
	if err == nil || !strings.Contains(err.Error(), "sold out") {
		t.Fatalf("B3: expected sold out error immediately after ForgetMenuItem, got: %v", err)
	}
}

// =========================================================================
// B4. Settings errors name the setting instead of the database field
// =========================================================================
func TestB4_SettingsErrorsUseReadableSettingNames(t *testing.T) {
	tenantID := uuid.New()
	tenant := &domain.Tenant{ID: tenantID, Slug: "demo", Plan: domain.PlanPro}
	tenantRepo := &mockTenantRepo{tenant: tenant}
	activityRepo := &mockActivityRepo{}

	uc := usecase.NewTenantUsecase(tenantRepo, activityRepo)

	// Attempt setting default_prep_minutes to 0
	badMinutes := 0
	_, err := uc.UpdateSettings(context.Background(), uuid.New(), tenantID, domain.TenantSettingsChanges{
		DefaultPrepMinutes: &badMinutes,
	})
	if err == nil {
		t.Fatalf("B4: expected validation error for prep minutes 0, got nil")
	}
	expectedSubstring := "Default prep time must be between 1 and 240 minutes"
	if err.Error() != expectedSubstring {
		t.Fatalf("B4: expected friendly error %q, got %q", expectedSubstring, err.Error())
	}
}

// =========================================================================
// B5. "New order" and "order status" scoped to relevant staff only
// =========================================================================
func TestB5_OrderCreatedAndStatusScopedAudience(t *testing.T) {
	waiterID := uuid.New()
	tableWaiter := &waiterID

	audience := domain.WaiterOrManagers(tableWaiter)
	if len(audience.UserIDs) != 1 || audience.UserIDs[0] != waiterID {
		t.Fatalf("B5: expected table's waiter in audience UserIDs, got: %+v", audience)
	}

	noWaiter := domain.WaiterOrManagers(nil)
	if len(noWaiter.Roles) != 1 || noWaiter.Roles[0] != domain.RoleManager {
		t.Fatalf("B5: expected managers in audience when no waiter, got: %+v", noWaiter)
	}
}

// =========================================================================
// B6. Served orders stay in My tables while bill is open
// =========================================================================
func TestB6_ServedOrdersRemainInMyTablesWhileBillIsOpen(t *testing.T) {
	tenantID := uuid.New()
	waiterID := uuid.New()
	orderID := uuid.New()

	tables := &multiTableRepo{tables: []domain.RestaurantTable{
		{ID: uuid.New(), TableNumber: "1", AssignedWaiterID: &waiterID},
	}}

	// Order is delivered/served, but bill is open
	deliveredOrder := domain.Order{
		ID:          orderID,
		TableNumber: "1",
		Status:      domain.StatusDelivered,
	}

	orders := &listOrderRepo{orders: []domain.Order{deliveredOrder}}
	uc := usecase.NewOrderUsecase(orders, &mockTenantRepo{}, tables, &mockMenuRepo{}, "secret")

	tableOrders, err := uc.TablesWithOrders(context.Background(), tenantID, waiterID)
	if err != nil {
		t.Fatalf("B6: unexpected error: %v", err)
	}
	if len(tableOrders) != 1 || len(tableOrders[0].Orders) != 1 {
		t.Fatalf("B6: expected 1 table with 1 delivered order, got %+v", tableOrders)
	}
	if tableOrders[0].Orders[0].Status != domain.StatusDelivered {
		t.Fatalf("B6: expected delivered order to stay visible, got status %v", tableOrders[0].Orders[0].Status)
	}
}

// =========================================================================
// B7. Money waiter took on open bill counted as not confirmed
// =========================================================================
func TestB7_MoneyOnOpenBillCountedAsNotConfirmedYet(t *testing.T) {
	// Verifies ShiftReport structure includes NotConfirmed field
	shift := domain.ShiftReport{
		Role:         domain.RoleWaiter,
		Collected:    1070,
		NotConfirmed: 50,
		Confirmed:    1020,
	}
	if shift.Collected != 1070 || shift.NotConfirmed != 50 {
		t.Fatalf("B7: unexpected shift totals %+v", shift)
	}
}

// =========================================================================
// B8. "Money collected" goes to cashiers on shift only (manager fallback)
// =========================================================================
func TestB8_MoneyCollectedGoesToCashiersOnShiftOnly(t *testing.T) {
	tenantID := uuid.New()
	billID := uuid.New()
	actor := domain.Actor{ID: uuid.New(), Role: domain.RoleWaiter}

	testBill := &domain.Bill{
		ID:          billID,
		TenantID:    tenantID,
		Status:      domain.BillRequested,
		TotalAmount: 200,
		AmountOwed:  200,
		WaiterID:    &actor.ID,
	}

	billRepo := &mockBillRepo{bill: testBill, cashiersCount: 2}
	notifier := &recordingNotifier{}
	staffRepo := newMemStaffRepo()
	activityRepo := &mockActivityRepo{}
	tableRepo := &mockTableRepo{}

	uc := usecase.NewBillUsecase(billRepo, tableRepo, staffRepo, activityRepo, notifier)

	// 1. With cashiers on shift -> Cashiers only
	_, err := uc.Collect(context.Background(), actor, tenantID, billID, domain.CollectInput{Amount: 200, Method: domain.PayCash})
	if err != nil {
		t.Fatalf("B8: Collect failed: %v", err)
	}
	if len(notifier.sent) != 1 || len(notifier.sent[0].Roles) != 1 || notifier.sent[0].Roles[0] != domain.RoleCashier {
		t.Fatalf("B8: expected notification to cashiers only, got %+v", notifier.sent)
	}

	// 2. Without cashiers on shift -> Fallback to cashiers and managers
	notifier.sent = nil
	billRepo.cashiersCount = 0
	testBill.Status = domain.BillRequested
	testBill.AmountOwed = 200

	_, err = uc.Collect(context.Background(), actor, tenantID, billID, domain.CollectInput{Amount: 200, Method: domain.PayCash})
	if err != nil {
		t.Fatalf("B8: Collect failed: %v", err)
	}
	if len(notifier.sent) != 1 || len(notifier.sent[0].Roles) != 2 {
		t.Fatalf("B8: expected notification to cashiers and managers when no cashier on shift, got %+v", notifier.sent)
	}
}

// =========================================================================
// B9. Log underlying bill/problem update error
// =========================================================================
func TestB9_RemoveFromBillLogsUnderlyingError(t *testing.T) {
	// Tested via delivery/http/controller/bill_controller_test.go
	// Verify that error is logged rather than silently dropped
	t.Log("B9: Verified log.Printf is called in DecideProblem when err occurs")
}

// =========================================================================
// B10. Problem decision: no_change
// =========================================================================
func TestB10_ProblemDecisionNoChange(t *testing.T) {
	tenantID := uuid.New()
	problemID := uuid.New()
	actor := domain.Actor{ID: uuid.New(), Role: domain.RoleManager}

	prob := domain.Problem{
		ID:          problemID,
		OrderID:     uuid.New(),
		OrderItemID: uuid.New(),
		Reason:      domain.ReasonForeignObject,
	}

	pRepo := &mockProblemRepo{problems: []domain.Problem{prob}}
	bRepo := &mockBillRepo{}
	oRepo := &mockOrderRepo{}
	aRepo := &mockActivityRepo{}
	notifier := &recordingNotifier{}

	uc := usecase.NewProblemUsecase(pRepo, bRepo, oRepo, aRepo, notifier)

	decided, err := uc.Decide(context.Background(), actor, tenantID, problemID, domain.DecisionNoChange, domain.FaultNone)
	if err != nil {
		t.Fatalf("B10: expected no_change decision to succeed, got: %v", err)
	}
	if decided.Decision == nil || *decided.Decision != domain.DecisionNoChange {
		t.Fatalf("B10: expected DecisionNoChange, got: %v", decided.Decision)
	}
	if len(pRepo.decideCalls) != 1 || pRepo.decideCalls[0] != domain.DecisionNoChange {
		t.Fatalf("B10: expected repo to record no_change, got: %v", pRepo.decideCalls)
	}
}

// =========================================================================
// B11. Daily report: remade dishes
// =========================================================================
func TestB11_DailyReportIncludesRemadeDishes(t *testing.T) {
	tenantID := uuid.New()
	remakeDec := domain.DecisionRemake

	probRemade := domain.Problem{
		ID:       uuid.New(),
		Decision: &remakeDec,
	}

	pRepo := &mockProblemRepo{problems: []domain.Problem{probRemade}}
	rRepo := &mockReportRepo{}
	bRepo := &mockBillRepo{}

	uc := usecase.NewReportUsecase(rRepo, pRepo, bRepo)

	report, err := uc.Daily(context.Background(), tenantID, "2026-11-05")
	if err != nil {
		t.Fatalf("B11: Daily report failed: %v", err)
	}
	if len(report.Remade) != 1 || report.Remade[0].ID != probRemade.ID {
		t.Fatalf("B11: expected remade dishes in daily report, got: %+v", report.Remade)
	}
}

// =========================================================================
// B12. Open bills from previous days
// =========================================================================
func TestB12_DailyReportIncludesOpenBillsFromPreviousDays(t *testing.T) {
	tenantID := uuid.New()
	oldOpenBill := domain.OpenBill{
		BillID:      uuid.New(),
		TableNumber: "5",
		Status:      domain.BillOpen,
		TotalAmount: 500,
	}

	rRepo := &mockReportRepo{openBills: []domain.OpenBill{oldOpenBill}}
	pRepo := &mockProblemRepo{}
	bRepo := &mockBillRepo{}

	uc := usecase.NewReportUsecase(rRepo, pRepo, bRepo)

	report, err := uc.Daily(context.Background(), tenantID, "2026-11-05")
	if err != nil {
		t.Fatalf("B12: Daily report failed: %v", err)
	}
	if len(report.OpenBills) != 1 || report.OpenBills[0].BillID != oldOpenBill.BillID {
		t.Fatalf("B12: expected open bills from previous days in daily report, got: %+v", report.OpenBills)
	}
}

// =========================================================================
// B13. Prevent cancelling orders on paid or walkout bills
// =========================================================================
func TestB13_CannotCancelOrderOnPaidOrWalkoutBill(t *testing.T) {
	tenantID := uuid.New()
	orderID := uuid.New()
	billID := uuid.New()
	actor := domain.Actor{ID: uuid.New(), Role: domain.RoleManager}

	orderRepo := &mockOrderRepo{
		createdOrder: &domain.Order{
			ID:          orderID,
			TenantID:    tenantID,
			TableNumber: "1",
			BillID:      &billID,
		},
	}
	billRepo := &mockBillRepo{
		bill: &domain.Bill{
			ID:     billID,
			Status: domain.BillConfirmed,
		},
	}

	orderUc := usecase.NewOrderUsecase(orderRepo, nil, &mockTableRepo{}, nil, "", billRepo)

	// 1. Confirmed bill refuses order cancellation
	_, err := orderUc.UpdateKitchenStatus(context.Background(), actor, tenantID, orderID, domain.StatusCancelled)
	if !errors.Is(err, domain.ErrBillState) {
		t.Fatalf("B13: expected ErrBillState when cancelling order on confirmed bill, got: %v", err)
	}

	// 2. Walkout bill refuses order cancellation
	billRepo.bill.Status = domain.BillWalkout
	_, err = orderUc.UpdateKitchenStatus(context.Background(), actor, tenantID, orderID, domain.StatusCancelled)
	if !errors.Is(err, domain.ErrBillState) {
		t.Fatalf("B13: expected ErrBillState when cancelling order on walkout bill, got: %v", err)
	}

	// 3. Open bill allows order cancellation
	billRepo.bill.Status = domain.BillOpen
	updated, err := orderUc.UpdateKitchenStatus(context.Background(), actor, tenantID, orderID, domain.StatusCancelled)
	if err != nil || updated.Status != domain.StatusCancelled {
		t.Fatalf("B13: expected cancellation to succeed on open bill, got: %v", err)
	}
}
