package security

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

// GenerateTableToken signs a tenantID + tableNumber with the secret key using HMAC-SHA256
func GenerateTableToken(tenantID, tableNumber, secretKey string) string {
	payload := fmt.Sprintf("%s:%s", tenantID, tableNumber)
	mac := hmac.New(sha256.New, []byte(secretKey))
	mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

// ValidateTableToken checks if the provided token matches the HMAC signature
func ValidateTableToken(tenantID, tableNumber, secretKey, providedToken string) bool {
	expectedToken := GenerateTableToken(tenantID, tableNumber, secretKey)
	return hmac.Equal([]byte(expectedToken), []byte(providedToken))
}
