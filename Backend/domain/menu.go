package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Category struct {
	ID        uuid.UUID `json:"id"`
	TenantID  uuid.UUID `json:"tenant_id"`
	Name      string    `json:"name"`
	SortOrder int32     `json:"sort_order"`
	IsActive  bool      `json:"is_active"`
}

type MenuItem struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	CategoryID  uuid.UUID `json:"category_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Price       float64   `json:"price"`
	ImageUrl    string    `json:"image_url"`
	Tags        []string  `json:"tags"`
	IsAvailable bool      `json:"is_available"`
	IsSoldOut   bool      `json:"is_sold_out"`
	CreatedAt   time.Time `json:"created_at"`
}

type FullMenu struct {
	Tenant     *Tenant     `json:"tenant"`
	Categories []Category  `json:"categories"`
	Items      []MenuItem  `json:"items"`
}

type CreateCategoryInput struct {
	TenantID  uuid.UUID `json:"tenant_id"`
	Name      string    `json:"name"`
	SortOrder int32     `json:"sort_order"`
}

type UpdateCategoryInput struct {
	ID        uuid.UUID `json:"id"`
	TenantID  uuid.UUID `json:"tenant_id"`
	Name      string    `json:"name"`
	SortOrder int32     `json:"sort_order"`
	IsActive  bool      `json:"is_active"`
}

type CreateItemInput struct {
	TenantID    uuid.UUID `json:"tenant_id"`
	CategoryID  uuid.UUID `json:"category_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Price       float64   `json:"price"`
	ImageUrl    string    `json:"image_url"`
	Tags        []string  `json:"tags"`
}

type UpdateItemInput struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	CategoryID  uuid.UUID `json:"category_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Price       float64   `json:"price"`
	ImageUrl    string    `json:"image_url"`
	Tags        []string  `json:"tags"`
	IsAvailable bool      `json:"is_available"`
}

type Modifier struct {
	ID              uuid.UUID `json:"id"`
	ModifierGroupID uuid.UUID `json:"modifier_group_id"`
	TenantID        uuid.UUID `json:"tenant_id"`
	Name            string    `json:"name"`
	PriceAdjustment float64   `json:"price_adjustment"`
}

// MenuRepository defines the persistence contract for categories and items
type MenuRepository interface {
	ListCategories(ctx context.Context, tenantID uuid.UUID) ([]Category, error)
	GetCategoryByID(ctx context.Context, tenantID, categoryID uuid.UUID) (*Category, error)
	CreateCategory(ctx context.Context, cat *Category) error
	UpdateCategory(ctx context.Context, cat *Category) error
	DeleteCategory(ctx context.Context, tenantID, categoryID uuid.UUID) error
	ListMenuItems(ctx context.Context, tenantID uuid.UUID) ([]MenuItem, error)
	ListItemsByCategory(ctx context.Context, tenantID uuid.UUID, categoryID uuid.UUID) ([]MenuItem, error)
	GetItemByID(ctx context.Context, tenantID, itemID uuid.UUID) (*MenuItem, error)
	CreateItem(ctx context.Context, item *MenuItem) error
	UpdateItem(ctx context.Context, item *MenuItem) error
	ToggleSoldOut(ctx context.Context, tenantID, itemID uuid.UUID, isSoldOut bool) error
	DeleteItem(ctx context.Context, tenantID, itemID uuid.UUID) error
	GetModifierByID(ctx context.Context, tenantID, modifierID uuid.UUID) (*Modifier, error)
	GetModifierForMenuItem(ctx context.Context, tenantID, menuItemID, modifierID uuid.UUID) (*Modifier, error)
}

// MenuUsecase defines the business logic contract for menu viewing & management
type MenuUsecase interface {
	GetFullMenu(ctx context.Context, slug string) (*FullMenu, error)
	ListCategories(ctx context.Context, tenantID uuid.UUID) ([]Category, error)
	CreateCategory(ctx context.Context, input CreateCategoryInput) (*Category, error)
	UpdateCategory(ctx context.Context, input UpdateCategoryInput) (*Category, error)
	DeleteCategory(ctx context.Context, tenantID, categoryID uuid.UUID) error
	ToggleItemSoldOut(ctx context.Context, tenantID, itemID uuid.UUID, isSoldOut bool) error
	CreateItem(ctx context.Context, input CreateItemInput) (*MenuItem, error)
	UpdateItem(ctx context.Context, input UpdateItemInput) (*MenuItem, error)
	DeleteItem(ctx context.Context, tenantID, itemID uuid.UUID) error
}
