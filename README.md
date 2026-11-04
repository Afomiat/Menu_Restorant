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
Staff sign in on their restaurant's admin page with their phone number (or their email).
All passwords are `password123`:

| Restaurant | Name | Role | Phone | Email |
|---|---|---|---|---|
| `demo-basic` | Meron Tadesse | Manager | 0911 300 001 | `manager@basic.azai.local` |
| `demo-plus` | Dawit Bekele | Manager | 0911 100 001 | `manager@plus.azai.local` |
| `demo-plus` | Selam Girma | Chef | 0911 100 002 | `chef@plus.azai.local` |
| `demo-plus` | Yonas Haile | Waiter | 0911 100 003 | `waiter@plus.azai.local` |
| `demo-pro` | Hana Alemu | Manager | 0911 200 001 | `manager@pro.azai.local` |
| `demo-pro` | Liya Mekonnen | Cashier | 0911 200 002 | `cashier@pro.azai.local` |
| `demo-pro` | Abebe Kebede | Waiter | 0911 200 003 | `waiter@pro.azai.local` |
| `demo-pro` | Tigist Worku | Chef | 0911 200 004 | `chef@pro.azai.local` |
| `demo-pro` | Bereket Assefa | Waiter | 0911 200 005 | `waiter2@pro.azai.local` |
| (none) | Azai Team | Super admin | | `superadmin@azai.local` (only the `/api/v1/superadmin` endpoints; it cannot open a restaurant dashboard) |

Other commands in `Backend/`: `make db-up` / `make db-down` start and stop the database (data is kept),
`make seed` reloads the sample data, `make migrate-up` applies new migrations,
`make test-db` runs all tests including the ones that use the local database.

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
