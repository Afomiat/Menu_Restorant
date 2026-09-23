package usecase

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"menu-backend/domain"
)

type uploadUsecase struct {
	tenantRepo domain.TenantRepository
	uploadRepo domain.UploadRepository
}

func NewUploadUsecase(tenantRepo domain.TenantRepository, uploadRepo domain.UploadRepository) domain.UploadUsecase {
	return &uploadUsecase{
		tenantRepo: tenantRepo,
		uploadRepo: uploadRepo,
	}
}

func (u *uploadUsecase) GenerateUploadSignature(ctx context.Context, tenantID uuid.UUID, subfolder string) (*domain.SignedUploadParams, error) {
	// 1. Verify tenant exists in database via TenantRepository
	tenant, err := u.tenantRepo.GetByID(ctx, tenantID)
	if err != nil || tenant == nil {
		return nil, errors.New("restaurant tenant not found")
	}

	cleanSubfolder := strings.TrimSpace(subfolder)
	if cleanSubfolder == "" {
		cleanSubfolder = "dishes"
	}
	cleanSubfolder = strings.ReplaceAll(cleanSubfolder, "..", "")
	cleanSubfolder = strings.Trim(cleanSubfolder, "/")

	// Multi-tenant folder scoping: azai/tenants/{tenant_slug}/{subfolder}
	folder := fmt.Sprintf("azai/tenants/%s/%s", tenant.Slug, cleanSubfolder)
	timestamp := time.Now().Unix()

	// 2. Delegate cryptographic signature generation to the UploadRepository adapter
	return u.uploadRepo.SignUpload(ctx, folder, timestamp)
}
