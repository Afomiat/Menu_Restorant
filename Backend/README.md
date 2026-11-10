# Menu backend - local setup for the front team

You only need **Docker Desktop**. No Go, no Postgres, no make.

## Start

```
docker compose up --build
```

The first run takes a few minutes. It starts Postgres, creates the tables, loads demo data and starts the API.
When you see `Azai Restaurant API listening on port 8080`, it is ready.

- API: http://localhost:8080 (check: http://localhost:8080/health)
- WebSockets: `ws://localhost:8080/ws/menu/<slug>` and `ws://localhost:8080/ws/kitchen?token=<jwt>`
- Your front end should run on http://localhost:5173 or http://localhost:3000 (other ports are blocked by CORS).

## Demo restaurants and logins

Slugs: `demo-basic`, `demo-plus`, `demo-pro`. Every account uses the password `password123`.

| Role | Login |
|---|---|
| Super admin | superadmin@azai.local |
| Pro manager | manager@pro.azai.local |
| Pro cashier / waiter / chef | cashier@pro.azai.local, waiter@pro.azai.local, chef@pro.azai.local |
| Plus manager / chef / waiter | manager@plus.azai.local, chef@plus.azai.local, waiter@plus.azai.local |
| Basic manager | manager@basic.azai.local |

Login: `POST /api/v1/auth/login` with `{"email": "...", "password": "password123"}`.

## Everyday commands

```
docker compose up -d --build   # start in the background
docker compose logs -f api     # watch API logs
docker compose down            # stop (data is kept)
docker compose down -v         # stop and delete all local data; the next up starts fresh
```

After pulling new backend code, run `docker compose up --build` again. New database migrations are applied automatically.

## Notes

- Image upload needs real Cloudinary keys in `docker-compose.yml`. Without them, only upload signing fails; everything else works.
- Do not put real secrets in `docker-compose.yml` or commit `.env` files.