package repository

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"menu-backend/config"
	"menu-backend/domain"
)

type cloudinaryUploadRepository struct {
	cfg *config.Config
}

// NewCloudinaryUploadRepository implements domain.UploadRepository for Cloudinary media storage
func NewCloudinaryUploadRepository(cfg *config.Config) domain.UploadRepository {
	return &cloudinaryUploadRepository{cfg: cfg}
}

func (r *cloudinaryUploadRepository) SignUpload(ctx context.Context, folder string, timestamp int64) (*domain.SignedUploadParams, error) {
	cloudName := strings.TrimSpace(r.cfg.CloudinaryCloudName)
	apiKey := strings.TrimSpace(r.cfg.CloudinaryAPIKey)
	apiSecret := strings.TrimSpace(r.cfg.CloudinaryAPISecret)

	if cloudName == "" || apiKey == "" || apiSecret == "" {
		return nil, errors.New("cloudinary storage credentials are not configured on the server")
	}

	// Cloudinary signature algorithm:
	// 1. Sort all parameters alphabetically by key (folder=...&timestamp=...)
	// 2. Append api_secret directly at the end (no &)
	// 3. Compute SHA-1 hex digest
	stringToSign := fmt.Sprintf("folder=%s&timestamp=%d%s", folder, timestamp, apiSecret)

	h := sha1.New()
	h.Write([]byte(stringToSign))
	signature := hex.EncodeToString(h.Sum(nil))

	return &domain.SignedUploadParams{
		Signature: signature,
		Timestamp: timestamp,
		APIKey:    apiKey,
		CloudName: cloudName,
		Folder:    folder,
	}, nil
}
