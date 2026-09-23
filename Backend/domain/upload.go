package domain

import (
	"context"

	"github.com/google/uuid"
)

type SignedUploadParams struct {
	Signature string `json:"signature"`
	Timestamp int64  `json:"timestamp"`
	APIKey    string `json:"api_key"`
	CloudName string `json:"cloud_name"`
	Folder    string `json:"folder"`
}

// UploadRepository defines the storage adapter contract for signing and managing media assets
type UploadRepository interface {
	SignUpload(ctx context.Context, folder string, timestamp int64) (*SignedUploadParams, error)
}

type UploadUsecase interface {
	GenerateUploadSignature(ctx context.Context, tenantID uuid.UUID, subfolder string) (*SignedUploadParams, error)
}

