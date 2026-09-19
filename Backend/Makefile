# Load variables from .env if it exists
-include .env
export

# Default fallback if not in .env
DB_URL ?= postgresql://postgres:yourpassword@db.yourref.supabase.co:5432/postgres?sslmode=require

# Auto-generate sequentially numbered migration: make migrate-create name=init_schema
migrate-create:
	migrate create -ext sql -dir db/migrations -seq $(name)

# Apply migrations to Supabase: make migrate-up
migrate-up:
	migrate -path db/migrations -database "$(DB_URL)" -verbose up

# Rollback 1 migration step on Supabase: make migrate-down
migrate-down:
	migrate -path db/migrations -database "$(DB_URL)" -verbose down 1

# Force dirty migration state if needed: make migrate-force version=1
migrate-force:
	migrate -path db/migrations -database "$(DB_URL)" force $(version)

# Generate Go code using sqlc: make sqlc
sqlc:
	sqlc generate

# Run the Go API server
run:
	go run cmd/api/main.go

.PHONY: migrate-create migrate-up migrate-down migrate-force sqlc run
