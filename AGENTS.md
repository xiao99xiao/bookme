# Repository Guidelines

## Project Structure & Module Organization
The Vite + React frontend lives in `src/`, with page routes under `pages/`, shared UI in `components/` and `design-system/`, API clients in `api/`, and cross-cutting utilities in `lib/`, `hooks/`, and `contexts/`. Static assets sit in `public/` and `src/assets/`. The Hono-based API is in `backend/src/`, with deployment scripts in `backend/scripts/`. Scheduled automation is isolated in `backend-cron/src/`. Smart contract work and Foundry tooling are grouped under `contracts/`, while database migrations and Supabase artifacts live in `database/` and `supabase/`.

## Build, Test, and Development Commands
From the repo root run `npm install` once, then `npm run dev` (HTTP) or `npm run dev:ssl` for the frontend. `npm run dev:backend` launches the API, and `npm run dev:all` wires HTTPS frontend + backend after running `npm run setup:ssl`. Use `npm run build` for production bundles and `npm run preview` to smoke-test them locally. Lint with `npm run lint`. Inside `backend/`, install dependencies and use `npm run dev` (HTTP) or `npm run dev:ssl` / `npm run start:ssl` once certificates are configured. The cron worker starts with `npm run dev` from `backend-cron/`.

## Coding Style & Naming Conventions
Write TypeScript-first React components using named exports and PascalCase filenames inside `components/` and route-specific PascalCase under `pages/`. Keep 2-space indentation, trailing commas, and limit default exports to route entry points. Use the `@/` path alias defined in `tsconfig.json` for shared imports. Tailwind classes belong in JSX; extract tokens into `design-system/` when reused. Run `npm run lint` (ESLint extends `next/core-web-vitals`) before pushing and address any autofixable warnings.

## Testing Guidelines
Automated tests are sparse; please backfill unit or integration coverage alongside new features. For UI logic, colocate Vitest/RTL suites in `src/__tests__/` or alongside the component (`Component.test.tsx`). Backend handlers should add Hono integration tests under `backend/src/__tests__/` powered by your chosen harness, and cron logic can piggyback on `backend-cron/test/`. Until coverage improves, confirm critical flows manually with `npm run dev:all` and capture console output or screenshots in the PR.

## Commit & Pull Request Guidelines
Follow the existing `<type>: <summary>` convention (`feat`, `fix`, `chore`, `docs`, etc.) in present tense and scope one change per commit. PRs need a clear summary, linked Linear/GitHub issue when available, reproduction and verification steps, and UI screenshots or clips for visual tweaks. Call out schema or contract migrations explicitly and note any configuration updates reviewers must apply.
