package repository

import (
	"context"

	"github.com/google/uuid"

	"menu-backend/db/sqlc"
	"menu-backend/domain"
	"menu-backend/internal/converter"
)

type menuRepository struct {
	q *sqlc.Queries
}

func NewMenuRepository(q *sqlc.Queries) domain.MenuRepository {
	return &menuRepository{q: q}
}

func (r *menuRepository) ListCategories(ctx context.Context, tenantID uuid.UUID) ([]domain.Category, error) {
	rows, err := r.q.ListCategoriesByTenant(ctx, converter.UUIDToPg(tenantID))
	if err != nil {
		return nil, err
	}
	categories := make([]domain.Category, len(rows))
	for i, c := range rows {
		categories[i] = domain.Category{
			ID:        converter.PgToUUID(c.ID),
			TenantID:  converter.PgToUUID(c.TenantID),
			Name:      c.Name,
			SortOrder: c.SortOrder,
			IsActive:  c.IsActive,
		}
	}
	return categories, nil
}

func (r *menuRepository) GetCategoryByID(ctx context.Context, tenantID, categoryID uuid.UUID) (*domain.Category, error) {
	c, err := r.q.GetCategoryByID(ctx, sqlc.GetCategoryByIDParams{
		ID:       converter.UUIDToPg(categoryID),
		TenantID: converter.UUIDToPg(tenantID),
	})
	if err != nil {
		return nil, err
	}
	return &domain.Category{
		ID:        converter.PgToUUID(c.ID),
		TenantID:  converter.PgToUUID(c.TenantID),
		Name:      c.Name,
		SortOrder: c.SortOrder,
		IsActive:  c.IsActive,
	}, nil
}

func (r *menuRepository) CreateCategory(ctx context.Context, cat *domain.Category) error {
	c, err := r.q.CreateCategory(ctx, sqlc.CreateCategoryParams{
		TenantID:  converter.UUIDToPg(cat.TenantID),
		Name:      cat.Name,
		SortOrder: cat.SortOrder,
		IsActive:  cat.IsActive,
	})
	if err != nil {
		return err
	}
	cat.ID = converter.PgToUUID(c.ID)
	return nil
}

func (r *menuRepository) UpdateCategory(ctx context.Context, cat *domain.Category) error {
	c, err := r.q.UpdateCategory(ctx, sqlc.UpdateCategoryParams{
		ID:        converter.UUIDToPg(cat.ID),
		TenantID:  converter.UUIDToPg(cat.TenantID),
		Name:      cat.Name,
		SortOrder: cat.SortOrder,
		IsActive:  cat.IsActive,
	})
	if err != nil {
		return err
	}
	cat.Name = c.Name
	cat.SortOrder = c.SortOrder
	cat.IsActive = c.IsActive
	return nil
}

func (r *menuRepository) DeleteCategory(ctx context.Context, tenantID, categoryID uuid.UUID) error {
	return r.q.DeleteCategory(ctx, sqlc.DeleteCategoryParams{
		ID:       converter.UUIDToPg(categoryID),
		TenantID: converter.UUIDToPg(tenantID),
	})
}

func (r *menuRepository) ListMenuItems(ctx context.Context, tenantID uuid.UUID) ([]domain.MenuItem, error) {
	rows, err := r.q.ListMenuItemsByTenant(ctx, converter.UUIDToPg(tenantID))
	if err != nil {
		return nil, err
	}
	items := make([]domain.MenuItem, len(rows))
	for i, m := range rows {
		items[i] = toDomainMenuItem(m)
	}
	return items, nil
}

func (r *menuRepository) ListItemsByCategory(ctx context.Context, tenantID, categoryID uuid.UUID) ([]domain.MenuItem, error) {
	rows, err := r.q.ListMenuItemsByCategory(ctx, sqlc.ListMenuItemsByCategoryParams{
		TenantID:   converter.UUIDToPg(tenantID),
		CategoryID: converter.UUIDToPg(categoryID),
	})
	if err != nil {
		return nil, err
	}
	items := make([]domain.MenuItem, len(rows))
	for i, m := range rows {
		items[i] = toDomainMenuItem(m)
	}
	return items, nil
}

func (r *menuRepository) GetItemByID(ctx context.Context, tenantID, itemID uuid.UUID) (*domain.MenuItem, error) {
	m, err := r.q.GetMenuItemByID(ctx, sqlc.GetMenuItemByIDParams{
		ID:       converter.UUIDToPg(itemID),
		TenantID: converter.UUIDToPg(tenantID),
	})
	if err != nil {
		return nil, err
	}
	item := toDomainMenuItem(m)
	return &item, nil
}

func (r *menuRepository) CreateItem(ctx context.Context, item *domain.MenuItem) error {
	m, err := r.q.CreateMenuItem(ctx, sqlc.CreateMenuItemParams{
		TenantID:    converter.UUIDToPg(item.TenantID),
		CategoryID:  converter.UUIDToPg(item.CategoryID),
		Name:        item.Name,
		Description: item.Description,
		Price:       converter.FloatToNumeric(item.Price),
		ImageUrl:    item.ImageUrl,
		Tags:        item.Tags,
		IsAvailable: item.IsAvailable,
		IsSoldOut:   item.IsSoldOut,
	})
	if err != nil {
		return err
	}
	item.ID = converter.PgToUUID(m.ID)
	return nil
}

func (r *menuRepository) UpdateItem(ctx context.Context, item *domain.MenuItem) error {
	_, err := r.q.UpdateMenuItem(ctx, sqlc.UpdateMenuItemParams{
		ID:          converter.UUIDToPg(item.ID),
		TenantID:    converter.UUIDToPg(item.TenantID),
		CategoryID:  converter.UUIDToPg(item.CategoryID),
		Name:        item.Name,
		Description: item.Description,
		Price:       converter.FloatToNumeric(item.Price),
		ImageUrl:    item.ImageUrl,
		Tags:        item.Tags,
		IsAvailable: item.IsAvailable,
	})
	return err
}

func (r *menuRepository) ToggleSoldOut(ctx context.Context, tenantID, itemID uuid.UUID, isSoldOut bool) error {
	_, err := r.q.ToggleMenuItemSoldOut(ctx, sqlc.ToggleMenuItemSoldOutParams{
		ID:        converter.UUIDToPg(itemID),
		TenantID:  converter.UUIDToPg(tenantID),
		IsSoldOut: isSoldOut,
	})
	return err
}

func (r *menuRepository) DeleteItem(ctx context.Context, tenantID, itemID uuid.UUID) error {
	return r.q.DeleteMenuItem(ctx, sqlc.DeleteMenuItemParams{
		ID:       converter.UUIDToPg(itemID),
		TenantID: converter.UUIDToPg(tenantID),
	})
}

func (r *menuRepository) GetModifierByID(ctx context.Context, tenantID, modifierID uuid.UUID) (*domain.Modifier, error) {
	row, err := r.q.GetModifierByID(ctx, sqlc.GetModifierByIDParams{
		ID:       converter.UUIDToPg(modifierID),
		TenantID: converter.UUIDToPg(tenantID),
	})
	if err != nil {
		return nil, err
	}
	return &domain.Modifier{
		ID:              converter.PgToUUID(row.ID),
		ModifierGroupID: converter.PgToUUID(row.ModifierGroupID),
		TenantID:        converter.PgToUUID(row.TenantID),
		Name:            row.Name,
		PriceAdjustment: converter.NumericToFloat(row.PriceAdjustment),
	}, nil
}

func (r *menuRepository) GetModifierForMenuItem(ctx context.Context, tenantID, menuItemID, modifierID uuid.UUID) (*domain.Modifier, error) {
	row, err := r.q.GetModifierByIDAndMenuItemID(ctx, sqlc.GetModifierByIDAndMenuItemIDParams{
		ID:         converter.UUIDToPg(modifierID),
		MenuItemID: converter.UUIDToPg(menuItemID),
		TenantID:   converter.UUIDToPg(tenantID),
	})
	if err != nil {
		return nil, err
	}
	return &domain.Modifier{
		ID:              converter.PgToUUID(row.ID),
		ModifierGroupID: converter.PgToUUID(row.ModifierGroupID),
		TenantID:        converter.PgToUUID(row.TenantID),
		Name:            row.Name,
		PriceAdjustment: converter.NumericToFloat(row.PriceAdjustment),
	}, nil
}

func toDomainMenuItem(m sqlc.MenuItem) domain.MenuItem {
	return domain.MenuItem{
		ID:          converter.PgToUUID(m.ID),
		TenantID:    converter.PgToUUID(m.TenantID),
		CategoryID:  converter.PgToUUID(m.CategoryID),
		Name:        m.Name,
		Description: m.Description,
		Price:       converter.NumericToFloat(m.Price),
		ImageUrl:    m.ImageUrl,
		Tags:        m.Tags,
		IsAvailable: m.IsAvailable,
		IsSoldOut:   m.IsSoldOut,
	}
}

