package test

import (
	"context"

	"github.com/google/uuid"

	"menu-backend/domain"
)

// --- Shared Mock Implementations for Tests ---

type mockTenantRepo struct {
	tenant *domain.Tenant
	err    error
}

func (m *mockTenantRepo) GetBySlug(ctx context.Context, slug string) (*domain.Tenant, error) {
	return m.tenant, m.err
}
func (m *mockTenantRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Tenant, error) {
	return m.tenant, m.err
}
func (m *mockTenantRepo) Create(ctx context.Context, tenant *domain.Tenant) error {
	return m.err
}
func (m *mockTenantRepo) UpdatePlan(ctx context.Context, id uuid.UUID, plan domain.PlanTier) error {
	return m.err
}
func (m *mockTenantRepo) UpdateTheme(ctx context.Context, id uuid.UUID, themeConfig map[string]interface{}) (*domain.Tenant, error) {
	return m.tenant, m.err
}

type mockTableRepo struct {
	table *domain.RestaurantTable
	err   error
}

func (m *mockTableRepo) GetByNumber(ctx context.Context, tenantID uuid.UUID, tableNumber string) (*domain.RestaurantTable, error) {
	return m.table, m.err
}
func (m *mockTableRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]domain.RestaurantTable, error) {
	if m.table != nil {
		return []domain.RestaurantTable{*m.table}, nil
	}
	return nil, m.err
}
func (m *mockTableRepo) Create(ctx context.Context, table *domain.RestaurantTable) error {
	return m.err
}
func (m *mockTableRepo) UpdateQRSecret(ctx context.Context, id, tenantID uuid.UUID, qrSecret string) error {
	return m.err
}

type mockMenuRepo struct {
	item     *domain.MenuItem
	category *domain.Category
	err      error
}

func (m *mockMenuRepo) ListCategories(ctx context.Context, tenantID uuid.UUID) ([]domain.Category, error) {
	if m.category != nil {
		return []domain.Category{*m.category}, nil
	}
	return nil, m.err
}
func (m *mockMenuRepo) GetCategoryByID(ctx context.Context, tenantID, categoryID uuid.UUID) (*domain.Category, error) {
	return m.category, m.err
}
func (m *mockMenuRepo) CreateCategory(ctx context.Context, cat *domain.Category) error {
	return m.err
}
func (m *mockMenuRepo) UpdateCategory(ctx context.Context, cat *domain.Category) error {
	return m.err
}
func (m *mockMenuRepo) DeleteCategory(ctx context.Context, tenantID, categoryID uuid.UUID) error {
	return m.err
}
func (m *mockMenuRepo) ListMenuItems(ctx context.Context, tenantID uuid.UUID) ([]domain.MenuItem, error) {
	if m.item != nil {
		return []domain.MenuItem{*m.item}, nil
	}
	return nil, m.err
}
func (m *mockMenuRepo) ListItemsByCategory(ctx context.Context, tenantID, categoryID uuid.UUID) ([]domain.MenuItem, error) {
	return nil, nil
}
func (m *mockMenuRepo) GetItemByID(ctx context.Context, tenantID, itemID uuid.UUID) (*domain.MenuItem, error) {
	return m.item, m.err
}
func (m *mockMenuRepo) CreateItem(ctx context.Context, item *domain.MenuItem) error {
	return m.err
}
func (m *mockMenuRepo) UpdateItem(ctx context.Context, item *domain.MenuItem) error {
	return m.err
}
func (m *mockMenuRepo) ToggleSoldOut(ctx context.Context, tenantID, itemID uuid.UUID, isSoldOut bool) error {
	return m.err
}
func (m *mockMenuRepo) DeleteItem(ctx context.Context, tenantID, itemID uuid.UUID) error {
	return m.err
}

type mockOrderRepo struct {
	createdOrder *domain.Order
	err          error
	cancelCalled bool
}

func (m *mockOrderRepo) Create(ctx context.Context, order *domain.Order) error {
	m.createdOrder = order
	order.ID = uuid.New()
	return m.err
}
func (m *mockOrderRepo) GetByID(ctx context.Context, tenantID, orderID uuid.UUID) (*domain.Order, error) {
	return m.createdOrder, m.err
}
func (m *mockOrderRepo) ListActiveByTenant(ctx context.Context, tenantID uuid.UUID) ([]domain.Order, error) {
	if m.createdOrder != nil {
		return []domain.Order{*m.createdOrder}, nil
	}
	return nil, m.err
}
func (m *mockOrderRepo) UpdateStatus(ctx context.Context, tenantID, orderID uuid.UUID, status domain.OrderStatus) error {
	return m.err
}
func (m *mockOrderRepo) CancelInGrace(ctx context.Context, tenantID, orderID uuid.UUID, sessionToken string) error {
	m.cancelCalled = true
	return m.err
}

type mockTenantUsecase struct {
	tenant *domain.Tenant
	hasVIP bool
	err    error
}

func (m *mockTenantUsecase) GetTenantBySlug(ctx context.Context, slug string) (*domain.Tenant, error) {
	return m.tenant, m.err
}
func (m *mockTenantUsecase) GetTenantByID(ctx context.Context, id uuid.UUID) (*domain.Tenant, error) {
	return m.tenant, m.err
}
func (m *mockTenantUsecase) UpdatePlan(ctx context.Context, id uuid.UUID, plan domain.PlanTier) error {
	return m.err
}
func (m *mockTenantUsecase) UpdateTheme(ctx context.Context, id uuid.UUID, themeConfig map[string]interface{}) (*domain.Tenant, error) {
	return m.tenant, m.err
}
func (m *mockTenantUsecase) VerifyVIPAccess(ctx context.Context, tenantID uuid.UUID) (bool, error) {
	return m.hasVIP, m.err
}
