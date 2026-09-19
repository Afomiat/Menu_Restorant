package test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"menu-backend/domain"
	"menu-backend/usecase"
)

func TestMenu_CrossTenantCategoryAssignmentPrevented(t *testing.T) {
	tenantA := uuid.New()
	categoryOfTenantB := uuid.New()

	menuRepo := &mockMenuRepo{
		category: nil,
		err:      errors.New("category not found"), // Category belongs to Tenant B, not A!
	}
	tenantRepo := &mockTenantRepo{}

	menuUc := usecase.NewMenuUsecase(tenantRepo, menuRepo)

	// Admin of Tenant A attempts to create an item pointing to Tenant B's category
	input := domain.CreateItemInput{
		TenantID:   tenantA,
		CategoryID: categoryOfTenantB,
		Name:       "Cross-Tenant Item",
		Price:      100.00,
	}

	_, err := menuUc.CreateItem(context.Background(), input)
	if err == nil {
		t.Fatal("SECURITY VULNERABILITY: Created menu item with category belonging to a different restaurant!")
	}
}

func TestMenu_ToggleSoldOutIsolation(t *testing.T) {
	tenantA := uuid.New()
	tenantB := uuid.New()
	itemOfTenantA := uuid.New()

	menuRepo := &mockMenuRepo{
		item: &domain.MenuItem{
			ID:       itemOfTenantA,
			TenantID: tenantA,
			Name:     "Burger",
		},
	}
	tenantRepo := &mockTenantRepo{}

	menuUc := usecase.NewMenuUsecase(tenantRepo, menuRepo)

	// Staff of Tenant A toggles their own item -> SUCCESS
	err := menuUc.ToggleItemSoldOut(context.Background(), tenantA, itemOfTenantA, true)
	if err != nil {
		t.Fatalf("expected success toggling own item, got: %v", err)
	}

	// Staff of Tenant B attempts to toggle Tenant A's item -> BLOCKED
	menuRepoWithMismatch := &mockMenuRepo{
		err: errors.New("item not found"), // Tenant B's query finds no matching item
	}
	menuUcMismatch := usecase.NewMenuUsecase(tenantRepo, menuRepoWithMismatch)
	err = menuUcMismatch.ToggleItemSoldOut(context.Background(), tenantB, itemOfTenantA, true)
	if err == nil {
		t.Fatal("SECURITY VULNERABILITY: Staff of Restaurant B was able to toggle sold-out status of Restaurant A's dish!")
	}
}
