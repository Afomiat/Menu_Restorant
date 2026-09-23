package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"menu-backend/delivery/http/middleware"
	"menu-backend/domain"
	"menu-backend/internal/ws"
)

type MenuController struct {
	menuUsecase domain.MenuUsecase
	hub          *ws.Hub
}

func NewMenuController(menuUsecase domain.MenuUsecase, hub *ws.Hub) *MenuController {
	return &MenuController{
		menuUsecase: menuUsecase,
		hub:          hub,
	}
}

// GetFullMenu handles GET /api/v1/menus/:slug
// Returns the complete menu (branding, categories, items) for guest browsing
func (ctrl *MenuController) GetFullMenu(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "restaurant slug is required"})
		return
	}

	menu, err := ctrl.menuUsecase.GetFullMenu(c.Request.Context(), slug)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": menu,
	})
}

// ToggleSoldOut handles PATCH /api/v1/admin/items/:id/sold-out
// Allows staff to immediately mark an 86'd item as sold out or back in stock
func (ctrl *MenuController) ToggleSoldOut(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "restaurant tenant identification missing"})
		return
	}

	itemIDStr := c.Param("id")
	itemID, err := uuid.Parse(itemIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid item ID"})
		return
	}

	var req struct {
		IsSoldOut bool `json:"is_sold_out"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if err := ctrl.menuUsecase.ToggleItemSoldOut(c.Request.Context(), tenantID, itemID, req.IsSoldOut); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update item status"})
		return
	}

	// Broadcast live 86 / Sold-out change to all restaurant screens
	if ctrl.hub != nil {
		ctrl.hub.BroadcastToTenant(tenantID, "item:sold_out_toggled", gin.H{
			"item_id":     itemID,
			"is_sold_out": req.IsSoldOut,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "item availability updated successfully",
		"item_id":     itemID,
		"is_sold_out": req.IsSoldOut,
	})
}

// ListCategories handles GET /api/v1/admin/categories
func (ctrl *MenuController) ListCategories(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "restaurant tenant identification missing"})
		return
	}

	categories, err := ctrl.menuUsecase.ListCategories(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list categories"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": categories,
	})
}

type CreateCategoryRequest struct {
	Name      string `json:"name" binding:"required,max=100"`
	SortOrder int32  `json:"sort_order"`
}

// CreateCategory handles POST /api/v1/admin/categories
func (ctrl *MenuController) CreateCategory(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "restaurant tenant identification missing"})
		return
	}

	var req CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cat, err := ctrl.menuUsecase.CreateCategory(c.Request.Context(), domain.CreateCategoryInput{
		TenantID:  tenantID,
		Name:      req.Name,
		SortOrder: req.SortOrder,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "category created successfully",
		"data":    cat,
	})
}

type UpdateCategoryRequest struct {
	Name      string `json:"name" binding:"required,max=100"`
	SortOrder int32  `json:"sort_order"`
	IsActive  *bool  `json:"is_active"`
}

// UpdateCategory handles PUT /api/v1/admin/categories/:id
func (ctrl *MenuController) UpdateCategory(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "restaurant tenant identification missing"})
		return
	}

	categoryIDStr := c.Param("id")
	categoryID, err := uuid.Parse(categoryIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category ID"})
		return
	}

	var req UpdateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	cat, err := ctrl.menuUsecase.UpdateCategory(c.Request.Context(), domain.UpdateCategoryInput{
		ID:        categoryID,
		TenantID:  tenantID,
		Name:      req.Name,
		SortOrder: req.SortOrder,
		IsActive:  isActive,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "category updated successfully",
		"data":    cat,
	})
}

// DeleteCategory handles DELETE /api/v1/admin/categories/:id
func (ctrl *MenuController) DeleteCategory(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "restaurant tenant identification missing"})
		return
	}

	categoryIDStr := c.Param("id")
	categoryID, err := uuid.Parse(categoryIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category ID"})
		return
	}

	if err := ctrl.menuUsecase.DeleteCategory(c.Request.Context(), tenantID, categoryID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "category deleted successfully",
		"id":      categoryID,
	})
}

type CreateItemRequest struct {
	CategoryID  uuid.UUID `json:"category_id" binding:"required"`
	Name        string    `json:"name" binding:"required,max=150"`
	Description string    `json:"description" binding:"max=1000"`
	Price       float64   `json:"price" binding:"required,gte=0"`
	ImageUrl    string    `json:"image_url" binding:"max=500"`
	Tags        []string  `json:"tags"`
}

// CreateItem handles POST /api/v1/admin/items
func (ctrl *MenuController) CreateItem(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "restaurant tenant identification missing"})
		return
	}

	var req CreateItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := ctrl.menuUsecase.CreateItem(c.Request.Context(), domain.CreateItemInput{
		TenantID:    tenantID,
		CategoryID:  req.CategoryID,
		Name:        req.Name,
		Description: req.Description,
		Price:       req.Price,
		ImageUrl:    req.ImageUrl,
		Tags:        req.Tags,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "item created successfully",
		"data":    item,
	})
}

type UpdateItemRequest struct {
	CategoryID  uuid.UUID `json:"category_id" binding:"required"`
	Name        string    `json:"name" binding:"required,max=150"`
	Description string    `json:"description" binding:"max=1000"`
	Price       float64   `json:"price" binding:"required,gte=0"`
	ImageUrl    string    `json:"image_url" binding:"max=500"`
	Tags        []string  `json:"tags"`
	IsAvailable bool      `json:"is_available"`
}

// UpdateItem handles PUT /api/v1/admin/items/:id
func (ctrl *MenuController) UpdateItem(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "restaurant tenant identification missing"})
		return
	}

	itemIDStr := c.Param("id")
	itemID, err := uuid.Parse(itemIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid item ID"})
		return
	}

	var req UpdateItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := ctrl.menuUsecase.UpdateItem(c.Request.Context(), domain.UpdateItemInput{
		ID:          itemID,
		TenantID:    tenantID,
		CategoryID:  req.CategoryID,
		Name:        req.Name,
		Description: req.Description,
		Price:       req.Price,
		ImageUrl:    req.ImageUrl,
		Tags:        req.Tags,
		IsAvailable: req.IsAvailable,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "item updated successfully",
		"data":    item,
	})
}

// DeleteItem handles DELETE /api/v1/admin/items/:id
func (ctrl *MenuController) DeleteItem(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "restaurant tenant identification missing"})
		return
	}

	itemIDStr := c.Param("id")
	itemID, err := uuid.Parse(itemIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid item ID"})
		return
	}

	if err := ctrl.menuUsecase.DeleteItem(c.Request.Context(), tenantID, itemID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "item deleted successfully",
		"id":      itemID,
	})
}
