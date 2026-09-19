package controller

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"menu-backend/db/sqlc"
	"menu-backend/internal/converter"
	"menu-backend/internal/security"
)

type AuthController struct {
	queries   *sqlc.Queries
	jwtSecret string
}

func NewAuthController(queries *sqlc.Queries, jwtSecret string) *AuthController {
	return &AuthController{
		queries:   queries,
		jwtSecret: jwtSecret,
	}
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Login handles POST /api/v1/auth/login
// Authenticates restaurant staff/manager and returns JWT with role and tenant_id
func (ctrl *AuthController) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid email or password format"})
		return
	}

	user, err := ctrl.queries.GetUserByEmail(c.Request.Context(), req.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	if !security.CheckPassword(req.Password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	userID := converter.PgToUUID(user.ID)
	tenantID := converter.PgToUUID(user.TenantID)

	token, err := security.GenerateJWT(userID, tenantID, string(user.Role), ctrl.jwtSecret, 24*time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate session token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":        userID,
			"email":     user.Email,
			"role":      user.Role,
			"tenant_id": tenantID,
		},
	})
}
