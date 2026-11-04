# Azai Menu

## Local development

Runs everything on your machine with a local database in Docker, so Supabase and Render are not touched.

1. Create `Backend/.env.local` (not committed; it overrides `Backend/.env`):

   ```
   DB_URL=postgres://azai:azai@localhost:5433/azai?sslmode=disable
   ENVIRONMENT=development
   FRONTEND_URL=http://localhost:5173
   ```

2. Create `Frontend/.env.local` (not committed; it overrides `Frontend/.env`):

   ```
   VITE_API_URL=http://localhost:8080/api/v1
   VITE_WS_URL=ws://localhost:8080/ws/kitchen
   ```

3. In `Backend/`, build the database with sample data, then start the API:

   ```
   make db-reset
   make run
   ```

4. In `Frontend/`: `npm run dev`, then open http://localhost:5173

Sample restaurants, one per plan: `demo-basic`, `demo-plus`, `demo-pro` (admin at `/<slug>/admin`).
Staff logins, all with password `password123`:

| Login | Role |
|---|---|
| `superadmin@azai.local` | Azai team: only the `/api/v1/superadmin` endpoints (plans); not linked to a restaurant, so it cannot open a restaurant dashboard |
| `owner@basic.azai.local` | Owner of Demo Basic Cafe |
| `owner@plus.azai.local`, `kitchen@plus.azai.local`, `waiter@plus.azai.local` | Demo Plus Bistro |
| `owner@pro.azai.local`, `kitchen@pro.azai.local`, `waiter@pro.azai.local` | Demo Pro Restaurant |

Other commands in `Backend/`: `make db-up` / `make db-down` start and stop the database (data is kept),
`make seed` reloads the sample data, `make migrate-up` applies new migrations.

Remove the two `.env.local` files to go back to Supabase and Render.

---

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
