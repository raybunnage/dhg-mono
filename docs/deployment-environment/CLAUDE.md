# CLAUDE.md - Development Guidelines

## Commands
- **Build:** `pnpm build` - Build all apps
- **Development:** `pnpm dev` - Start dev servers for all apps
- **Lint:** `pnpm lint` - Lint all apps
- **Test:** `pnpm test` - Run tests in watch mode
  - Single test: `pnpm test ComponentName` - Run tests matching name
  - Run once: `pnpm test:run`
  - With UI: `pnpm test:ui`
- **Database:**
  - Migrations: `pnpm db:migrate` (up), `pnpm db:rollback` (down)
  - Check state: `pnpm db:check`
  - Create migration: `pnpm migration:new`
- **Google Drive:**
  - List roots: `npx ts-node scripts/google-drive-manager-simple.ts list-roots`
  - Verify auth: `npx ts-node scripts/google-drive-manager-simple.ts verify`

## Code Style Guidelines
- **Components:** Functional components with hooks (React)
- **Naming:**
  - Components: PascalCase
  - Directories: lowercase-with-dashes
  - Files: PascalCase for components, kebab-case for utilities
- **Styling:** Tailwind CSS with utility-first approach
- **Imports:** Use path aliases (`@/components/`) over relative paths
- **Types:** TypeScript with strict mode, explicit prop interfaces
- **State:** Prefer hooks (useState, useEffect, useContext)
- **Monorepo:** Use package filters (`pnpm add -D pkg --filter app-name`)
- **Archives:** Date-suffix archived files (`Component.YYYY-MM-DD.tsx`)

## Architecture
- Use Vite for bundling
- React Router for navigation (not Next.js)
- Supabase for database and backend
- Preserve existing functionality when making changes