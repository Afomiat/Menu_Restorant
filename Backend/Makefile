# Load variables from .env if it exists, then .env.local (not committed) on top of it
-include .env
-include .env.local
export

# Default fallback if not in .env
DB_URL ?= postgresql://postgres:yourpassword@db.yourref.supabase.co:5432/postgres?sslmode=require

# Local database in Docker (port 5433). Point DB_URL at it in .env.local.
LOCAL_DB_URL = postgres://azai:azai@localhost:5433/azai?sslmode=disable

# Start the local database: make db-up
db-up:
	docker compose up -d --wait db

# Stop the local database (data is kept): make db-down
db-down:
	docker compose down

# Delete the local database and build it again with sample data: make db-reset
db-reset:
	docker compose down -v
	docker compose up -d --wait db
	migrate -path db/migrations -database "$(LOCAL_DB_URL)" -verbose up
	docker compose exec -T db psql -U azai -d azai -v ON_ERROR_STOP=1 -q < db/seed/local_seed.sql

# Load sample restaurants, staff and dishes into the local database: make seed
seed:
	docker compose exec -T db psql -U azai -d azai -v ON_ERROR_STOP=1 -q < db/seed/local_seed.sql

# Auto-generate sequentially numbered migration: make migrate-create name=init_schema
migrate-create:
	migrate create -ext sql -dir db/migrations -seq $(name)

# Apply migrations to DB_URL (local database when .env.local sets it): make migrate-up
migrate-up:
	migrate -path db/migrations -database "$(DB_URL)" -verbose up

# Rollback 1 migration step on DB_URL: make migrate-down
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
	go run .

.PHONY: db-up db-down db-reset seed migrate-create migrate-up migrate-down migrate-force sqlc run
