package test

import (
	"os"
	"path/filepath"
	"testing"

	"menu-backend/config"
)

func writeFile(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}

func TestConfig_EnvLocalOverridesEnv(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, dir, ".env", "DB_URL=postgres://remote.example.com/db\nPORT=9000\n")
	writeFile(t, dir, ".env.local", "DB_URL=postgres://azai:azai@localhost:5433/azai\n")

	cfg, err := config.LoadConfig(dir)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DBUrl != "postgres://azai:azai@localhost:5433/azai" {
		t.Fatalf("expected .env.local DB_URL to win, got %q", cfg.DBUrl)
	}
	if cfg.ServerPort != "9000" {
		t.Fatalf("expected values only in .env to be kept, got port %q", cfg.ServerPort)
	}
}

func TestConfig_WithoutEnvLocalUsesEnv(t *testing.T) {
	withLocal := t.TempDir()
	writeFile(t, withLocal, ".env", "DB_URL=postgres://remote.example.com/db\n")
	writeFile(t, withLocal, ".env.local", "DB_URL=postgres://localhost/other\n")
	if _, err := config.LoadConfig(withLocal); err != nil {
		t.Fatal(err)
	}

	// A second load from another folder must not pick up the first folder's .env.local
	dir := t.TempDir()
	writeFile(t, dir, ".env", "DB_URL=postgres://remote.example.com/db\n")
	cfg, err := config.LoadConfig(dir)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DBUrl != "postgres://remote.example.com/db" {
		t.Fatalf("expected .env DB_URL, got %q", cfg.DBUrl)
	}
}

func TestConfig_EnvironmentVariablesWin(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, dir, ".env", "DB_URL=postgres://remote.example.com/db\n")
	writeFile(t, dir, ".env.local", "DB_URL=postgres://localhost/local\n")
	t.Setenv("DB_URL", "postgres://from-env/db")

	cfg, err := config.LoadConfig(dir)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DBUrl != "postgres://from-env/db" {
		t.Fatalf("expected the environment variable to win (as on Render), got %q", cfg.DBUrl)
	}
}
