package test

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"menu-backend/internal/security"
)

func TestSecurity_PasswordHashing(t *testing.T) {
	password := "SecretP@ssw0rd!123"

	hash, err := security.HashPassword(password)
	if err != nil {
		t.Fatalf("expected no error hashing password, got: %v", err)
	}

	if hash == password {
		t.Fatal("password hash must not match plaintext password")
	}

	// 1. Correct password should verify
	if !security.CheckPassword(password, hash) {
		t.Fatal("expected correct password to match hash")
	}

	// 2. Wrong password should fail
	if security.CheckPassword("WrongPassword!123", hash) {
		t.Fatal("expected wrong password to fail verification")
	}

	// 3. Empty password should fail
	if security.CheckPassword("", hash) {
		t.Fatal("expected empty password to fail verification")
	}
}

func TestSecurity_TableQRHMAC(t *testing.T) {
	secretKey := "super-secure-qr-secret-key-32-chars-long"
	tenantID := uuid.New().String()
	tableNumber := "12"

	// 1. Generate valid token
	token := security.GenerateTableToken(tenantID, tableNumber, secretKey)
	if token == "" {
		t.Fatal("expected non-empty table token")
	}

	// 2. Positive validation
	if !security.ValidateTableToken(tenantID, tableNumber, secretKey, token) {
		t.Fatal("expected valid table token to pass HMAC verification")
	}

	// 3. Table spoofing attack: Attacker tries token from Table 12 on Table 15
	if security.ValidateTableToken(tenantID, "15", secretKey, token) {
		t.Fatal("SECURITY VULNERABILITY: Table spoofing succeeded! Token for Table 12 worked on Table 15")
	}

	// 4. Cross-tenant spoofing attack: Attacker tries token on Restaurant B
	otherTenantID := uuid.New().String()
	if security.ValidateTableToken(otherTenantID, tableNumber, secretKey, token) {
		t.Fatal("SECURITY VULNERABILITY: Cross-tenant table token reuse succeeded!")
	}

	// 5. Tampered signature attack
	tamperedToken := token[:len(token)-4] + "abcd"
	if security.ValidateTableToken(tenantID, tableNumber, secretKey, tamperedToken) {
		t.Fatal("SECURITY VULNERABILITY: Tampered token was accepted!")
	}

	// 6. Wrong secret key
	if security.ValidateTableToken(tenantID, tableNumber, "wrong-secret-key", token) {
		t.Fatal("SECURITY VULNERABILITY: Token verified with wrong secret key!")
	}
}

func TestSecurity_JWT_LifecycleAndRoleClaims(t *testing.T) {
	secretKey := "my-jwt-production-secret-key-32-bytes"
	userID := uuid.New()
	tenantID := uuid.New()
	role := "kitchen"

	// 1. Valid Token Generation & Parsing
	token, err := security.GenerateJWT(userID, tenantID, role, secretKey, 1*time.Hour)
	if err != nil {
		t.Fatalf("failed to generate JWT: %v", err)
	}

	claims, err := security.ValidateJWT(token, secretKey)
	if err != nil {
		t.Fatalf("expected valid JWT, got error: %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("expected UserID %s, got %s", userID, claims.UserID)
	}
	if claims.TenantID != tenantID {
		t.Errorf("expected TenantID %s, got %s", tenantID, claims.TenantID)
	}
	if claims.Role != role {
		t.Errorf("expected Role %s, got %s", role, claims.Role)
	}

	// 2. Expired Token
	expiredToken, err := security.GenerateJWT(userID, tenantID, role, secretKey, -1*time.Second)
	if err != nil {
		t.Fatalf("failed to generate expired JWT: %v", err)
	}

	_, err = security.ValidateJWT(expiredToken, secretKey)
	if err == nil {
		t.Fatal("expected expired token to fail validation, but it succeeded")
	}

	// 3. Forged Secret Signature
	_, err = security.ValidateJWT(token, "attacker-secret-key")
	if err == nil {
		t.Fatal("expected token signed with different key to fail validation")
	}
}
