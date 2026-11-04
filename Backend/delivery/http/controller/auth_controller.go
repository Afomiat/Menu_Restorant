package controller

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"menu-backend/domain"
	"menu-backend/internal/security"
)

type AuthController struct {
	staffUsecase domain.StaffUsecase
	jwtSecret    string
}

func NewAuthController(staffUsecase domain.StaffUsecase, jwtSecret string) *AuthController {
	return &AuthController{
		staffUsecase: staffUsecase,
		jwtSecret:    jwtSecret,
	}
}

// LoginRequest signs in with an email, or with a phone number at a restaurant (its slug)
type LoginRequest struct {
	Email      string `json:"email" binding:"omitempty,email,max=255"`
	Phone      string `json:"phone" binding:"omitempty,max=32"`
	Restaurant string `json:"restaurant" binding:"omitempty,max=64"`
	Password   string `json:"password" binding:"required,max=128"`
}

// Login handles POST /api/v1/auth/login
// Authenticates restaurant staff and returns a JWT with their role and tenant_id
func (ctrl *AuthController) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil || (req.Email == "" && req.Phone == "") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "enter your phone number or email, and your password"})
		return
	}

	staff, err := ctrl.staffUsecase.Login(c.Request.Context(), domain.LoginInput{
		Email:          req.Email,
		Phone:          req.Phone,
		RestaurantSlug: req.Restaurant,
		Password:       req.Password,
	})
	switch {
	case errors.Is(err, domain.ErrInvalidLogin):
		c.JSON(http.StatusUnauthorized, gin.H{"error": domain.ErrInvalidLogin.Error()})
		return
	case errors.Is(err, domain.ErrStaffInactive):
		c.JSON(http.StatusForbidden, gin.H{"error": "STAFF_INACTIVE", "message": domain.ErrStaffInactive.Error()})
		return
	case err != nil:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sign in"})
		return
	}

	token, err := security.GenerateJWT(staff.ID, staff.TenantID, string(staff.Role), ctrl.jwtSecret, 24*time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate session token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":        staff.ID,
			"email":     staff.Email,
			"phone":     staff.Phone,
			"full_name": staff.FullName,
			"role":      staff.Role,
			"tenant_id": staff.TenantID,
		},
	})
}
