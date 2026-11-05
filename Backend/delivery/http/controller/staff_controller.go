package controller

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"menu-backend/delivery/http/middleware"
	"menu-backend/domain"
)

type StaffController struct {
	staffUsecase domain.StaffUsecase
}

func NewStaffController(staffUsecase domain.StaffUsecase) *StaffController {
	return &StaffController{staffUsecase: staffUsecase}
}

type CreateStaffRequest struct {
	FullName string `json:"full_name" binding:"required,max=100"`
	Phone    string `json:"phone" binding:"required,max=32"`
	Email    string `json:"email" binding:"max=255"`
	Password string `json:"password" binding:"required,max=128"`
	Role     string `json:"role" binding:"required"`
}

// UpdateStaffRequest changes only the fields that are sent
type UpdateStaffRequest struct {
	FullName *string `json:"full_name" binding:"omitempty,max=100"`
	Role     *string `json:"role"`
	IsActive *bool   `json:"is_active"`
	Password *string `json:"password" binding:"omitempty,max=128"`
}

// ListStaff handles GET /api/v1/admin/staff
func (ctrl *StaffController) ListStaff(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "restaurant tenant identification missing"})
		return
	}

	staff, err := ctrl.staffUsecase.List(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load staff"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": staff, "roles": domain.StaffRoles})
}

// ListColleagues handles GET /api/v1/admin/colleagues: the active waiters and managers a bill
// can be handed to, with only their name and role
func (ctrl *StaffController) ListColleagues(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "restaurant tenant identification missing"})
		return
	}
	staff, err := ctrl.staffUsecase.List(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load staff"})
		return
	}
	colleagues := []gin.H{}
	for _, s := range staff {
		if s.IsActive && (s.Role == domain.RoleWaiter || s.Role == domain.RoleManager) {
			colleagues = append(colleagues, gin.H{"id": s.ID, "full_name": s.FullName, "role": s.Role})
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": colleagues})
}

// CreateStaff handles POST /api/v1/admin/staff
func (ctrl *StaffController) CreateStaff(c *gin.Context) {
	tenantID, actorID, ok := staffContext(c)
	if !ok {
		return
	}

	var req CreateStaffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "full name, phone, password and role are required"})
		return
	}

	staff, err := ctrl.staffUsecase.Create(c.Request.Context(), actorID, tenantID, domain.NewStaffInput{
		FullName: req.FullName,
		Phone:    req.Phone,
		Email:    req.Email,
		Password: req.Password,
		Role:     domain.Role(req.Role),
	})
	if err != nil {
		writeStaffError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": staff})
}

// UpdateStaff handles PATCH /api/v1/admin/staff/:id
func (ctrl *StaffController) UpdateStaff(c *gin.Context) {
	tenantID, actorID, ok := staffContext(c)
	if !ok {
		return
	}

	staffID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid staff id"})
		return
	}

	var req UpdateStaffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid staff details"})
		return
	}

	input := domain.UpdateStaffInput{FullName: req.FullName, IsActive: req.IsActive, Password: req.Password}
	if req.Role != nil {
		role := domain.Role(*req.Role)
		input.Role = &role
	}

	staff, err := ctrl.staffUsecase.Update(c.Request.Context(), actorID, tenantID, staffID, input)
	if err != nil {
		writeStaffError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": staff})
}

// staffContext returns the restaurant and the acting staff member, or writes a 401
func staffContext(c *gin.Context) (tenantID, actorID uuid.UUID, ok bool) {
	tenantID, hasTenant := middleware.GetTenantIDFromContext(c)
	claims, hasClaims := middleware.GetAuthClaims(c)
	if !hasTenant || !hasClaims {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return uuid.Nil, uuid.Nil, false
	}
	return tenantID, claims.UserID, true
}

func writeStaffError(c *gin.Context, err error) {
	var validation *domain.ValidationError
	switch {
	case errors.As(err, &validation):
		c.JSON(http.StatusBadRequest, gin.H{"error": validation.Message})
	case errors.Is(err, domain.ErrStaffNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, domain.ErrPhoneTaken), errors.Is(err, domain.ErrEmailTaken):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, domain.ErrLastManager), errors.Is(err, domain.ErrChangeOwnStaff):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save staff member"})
	}
}
