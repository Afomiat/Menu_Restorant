package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"menu-backend/delivery/http/middleware"
	"menu-backend/domain"
)

type UploadController struct {
	uploadUsecase domain.UploadUsecase
}

func NewUploadController(uploadUsecase domain.UploadUsecase) *UploadController {
	return &UploadController{uploadUsecase: uploadUsecase}
}

type CloudinarySignRequest struct {
	Folder string `json:"folder"` // e.g. "dishes", "branding"
}

// SignCloudinaryUpload handles POST /api/v1/admin/uploads/cloudinary-sign
func (ctrl *UploadController) SignCloudinaryUpload(c *gin.Context) {
	tenantID, ok := middleware.GetTenantIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "restaurant tenant identification missing"})
		return
	}

	var req CloudinarySignRequest
	_ = c.ShouldBindJSON(&req)

	params, err := ctrl.uploadUsecase.GenerateUploadSignature(c.Request.Context(), tenantID, req.Folder)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": params,
	})
}
