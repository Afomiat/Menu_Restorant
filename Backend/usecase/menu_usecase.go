package usecase

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"menu-backend/domain"
)

type menuUsecase struct {
	tenantRepo domain.TenantRepository
	menuRepo   domain.MenuRepository
}

func NewMenuUsecase(tenantRepo domain.TenantRepository, menuRepo domain.MenuRepository) domain.MenuUsecase {
	return &menuUsecase{
		tenantRepo: tenantRepo,
		menuRepo:   menuRepo,
	}
}

// GetFullMenu aggregates branding, categories, and items for the public restaurant menu
func (u *menuUsecase) GetFullMenu(ctx context.Context, slug string) (*domain.FullMenu, error) {
	if slug == "" {
		return nil, errors.New("restaurant slug cannot be empty")
	}

	tenant, err := u.tenantRepo.GetBySlug(ctx, slug)
	if err != nil || tenant == nil {
		return nil, fmt.Errorf("restaurant '%s' not found", slug)
	}

	if !tenant.IsActive {
		return nil, errors.New("this restaurant menu is currently inactive or suspended")
	}

	categories, err := u.menuRepo.ListCategories(ctx, tenant.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to load categories: %w", err)
	}

	items, err := u.menuRepo.ListMenuItems(ctx, tenant.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to load menu items: %w", err)
	}

	return &domain.FullMenu{
		Tenant:     tenant,
		Categories: categories,
		Items:      items,
	}, nil
}

func (u *menuUsecase) ListCategories(ctx context.Context, tenantID uuid.UUID) ([]domain.Category, error) {
	return u.menuRepo.ListCategories(ctx, tenantID)
}

func (u *menuUsecase) CreateCategory(ctx context.Context, input domain.CreateCategoryInput) (*domain.Category, error) {
	if input.Name == "" {
		return nil, errors.New("category name cannot be empty")
	}

	cat := &domain.Category{
		TenantID:  input.TenantID,
		Name:      input.Name,
		SortOrder: input.SortOrder,
		IsActive:  true,
	}

	if err := u.menuRepo.CreateCategory(ctx, cat); err != nil {
		return nil, fmt.Errorf("failed to create category: %w", err)
	}

	return cat, nil
}

func (u *menuUsecase) UpdateCategory(ctx context.Context, input domain.UpdateCategoryInput) (*domain.Category, error) {
	if input.Name == "" {
		return nil, errors.New("category name cannot be empty")
	}

	// Verify category exists and belongs to this tenant
	existing, err := u.menuRepo.GetCategoryByID(ctx, input.TenantID, input.ID)
	if err != nil {
		return nil, fmt.Errorf("category not found or does not belong to this restaurant: %w", err)
	}

	existing.Name = input.Name
	existing.SortOrder = input.SortOrder
	existing.IsActive = input.IsActive

	if err := u.menuRepo.UpdateCategory(ctx, existing); err != nil {
		return nil, fmt.Errorf("failed to update category: %w", err)
	}

	return existing, nil
}

func (u *menuUsecase) DeleteCategory(ctx context.Context, tenantID, categoryID uuid.UUID) error {
	// Verify category exists and belongs to this tenant
	_, err := u.menuRepo.GetCategoryByID(ctx, tenantID, categoryID)
	if err != nil {
		return fmt.Errorf("category not found or does not belong to this restaurant: %w", err)
	}

	return u.menuRepo.DeleteCategory(ctx, tenantID, categoryID)
}

// ToggleItemSoldOut toggles the 86'd status of an item (with restaurant isolation check)
func (u *menuUsecase) ToggleItemSoldOut(ctx context.Context, tenantID, itemID uuid.UUID, isSoldOut bool) error {
	// Verify item exists and belongs to this tenant
	_, err := u.menuRepo.GetItemByID(ctx, tenantID, itemID)
	if err != nil {
		return fmt.Errorf("item not found or does not belong to this restaurant: %w", err)
	}

	return u.menuRepo.ToggleSoldOut(ctx, tenantID, itemID, isSoldOut)
}

// CreateItem adds a new dish to the restaurant menu
func (u *menuUsecase) CreateItem(ctx context.Context, input domain.CreateItemInput) (*domain.MenuItem, error) {
	if input.Name == "" {
		return nil, errors.New("item name cannot be empty")
	}
	if input.Price < 0 {
		return nil, errors.New("item price cannot be negative")
	}
	if input.CategoryID == uuid.Nil {
		return nil, errors.New("category ID is required")
	}

	// Verify category exists and belongs to this tenant to prevent cross-tenant data leakage
	_, err := u.menuRepo.GetCategoryByID(ctx, input.TenantID, input.CategoryID)
	if err != nil {
		return nil, fmt.Errorf("category not found or does not belong to this restaurant: %w", err)
	}

	item := &domain.MenuItem{
		TenantID:    input.TenantID,
		CategoryID:  input.CategoryID,
		Name:        input.Name,
		Description: input.Description,
		Price:       input.Price,
		ImageUrl:    input.ImageUrl,
		Tags:        input.Tags,
		IsAvailable: true,
		IsSoldOut:   false,
	}

	if err := u.menuRepo.CreateItem(ctx, item); err != nil {
		return nil, fmt.Errorf("failed to create menu item: %w", err)
	}

	return item, nil
}

// UpdateItem updates an existing dish (price, description, category, tags, availability)
func (u *menuUsecase) UpdateItem(ctx context.Context, input domain.UpdateItemInput) (*domain.MenuItem, error) {
	if input.Name == "" {
		return nil, errors.New("item name cannot be empty")
	}
	if input.Price < 0 {
		return nil, errors.New("item price cannot be negative")
	}

	// Verify item exists and belongs to this tenant
	existing, err := u.menuRepo.GetItemByID(ctx, input.TenantID, input.ID)
	if err != nil {
		return nil, fmt.Errorf("item not found or does not belong to this restaurant: %w", err)
	}

	// Verify target category exists and belongs to this tenant to prevent cross-tenant data leakage
	_, err = u.menuRepo.GetCategoryByID(ctx, input.TenantID, input.CategoryID)
	if err != nil {
		return nil, fmt.Errorf("target category not found or does not belong to this restaurant: %w", err)
	}

	existing.CategoryID = input.CategoryID
	existing.Name = input.Name
	existing.Description = input.Description
	existing.Price = input.Price
	existing.ImageUrl = input.ImageUrl
	existing.Tags = input.Tags
	existing.IsAvailable = input.IsAvailable

	if err := u.menuRepo.UpdateItem(ctx, existing); err != nil {
		return nil, fmt.Errorf("failed to update menu item: %w", err)
	}

	return existing, nil
}

// DeleteItem removes a dish from the menu
func (u *menuUsecase) DeleteItem(ctx context.Context, tenantID, itemID uuid.UUID) error {
	// Verify item exists and belongs to this tenant
	_, err := u.menuRepo.GetItemByID(ctx, tenantID, itemID)
	if err != nil {
		return fmt.Errorf("item not found or does not belong to this restaurant: %w", err)
	}

	return u.menuRepo.DeleteItem(ctx, tenantID, itemID)
}
