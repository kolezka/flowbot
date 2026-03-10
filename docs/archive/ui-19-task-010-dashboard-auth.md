# Task: Dashboard Authentication System

## Summary
Implement authentication for the dashboard to protect management actions and restrict access to authorized admins only.

## Problem
The dashboard has zero authentication. Anyone with the URL can access all data (users, products, moderation logs, group configs) and perform actions (edit products, deactivate warnings). Before adding more write operations (config editing, member actions, scheduled messages), authentication is a critical prerequisite.

## Goal
A simple but effective authentication system that restricts dashboard access to authorized administrators.

## Scope
In scope:
- Authentication mechanism (token-based or Telegram Login Widget)
- API middleware to protect endpoints
- Frontend auth guard (redirect to login if not authenticated)
- Login page
- Session persistence (don't require login on every page load)
- Logout functionality

Out of scope:
- Role-based access control (admin vs. moderator permissions in dashboard)
- Multi-tenancy (separate access per group)
- User registration (admins are pre-configured)
- OAuth providers other than Telegram
- Two-factor authentication

## Requirements
- Functional:
  - Admin must authenticate before accessing any dashboard page
  - Session persists across browser refreshes (cookie or localStorage JWT)
  - Logout clears session
  - Unauthenticated API requests return 401
- Technical (Option A — Shared Secret):
  - API env var: `DASHBOARD_SECRET` (long random string)
  - Login page: password input
  - API: POST /api/auth/login (validates secret, returns JWT)
  - API: JWT middleware on all endpoints
  - Frontend: stores JWT, includes in Authorization header
- Technical (Option B — Telegram Login Widget):
  - Uses Telegram Login Widget for authentication
  - API validates the Telegram auth hash using BOT_TOKEN
  - Only allows login from users in BOT_ADMINS list
  - More secure: ties to existing admin identity
- UX:
  - Clean login page
  - Auto-redirect to login on 401
  - Remember me / persistent session

## Dependencies
- None — this is a foundational security task
- Should be completed before tasks that add write operations (002, 003, 004, 008)

## Proposed approach

**Recommended: Option A (Shared Secret) for simplicity, with Option B as future enhancement.**

### Backend
1. Add `DASHBOARD_SECRET` to API environment variables
2. Create `src/auth/` module:
   - `auth.controller.ts` — POST /api/auth/login, POST /api/auth/verify
   - `auth.service.ts` — validate secret, issue JWT, verify JWT
   - `auth.guard.ts` — NestJS guard checking JWT in Authorization header
3. Apply guard globally or to all controllers except auth

### Frontend
1. Create `/login/page.tsx` — password input form
2. Create `lib/auth.ts` — store/retrieve JWT from localStorage
3. Update `lib/api.ts` — include JWT in all requests
4. Create auth middleware/layout guard — redirect to /login if no valid JWT
5. Add logout button to sidebar/header

## Deliverables
- `apps/api/src/auth/` — Auth module with controller, service, guard
- `apps/frontend/src/app/login/page.tsx` — Login page
- `apps/frontend/src/lib/auth.ts` — Auth utilities
- Updated `apps/frontend/src/lib/api.ts` — JWT header injection
- Updated dashboard layout — logout button, auth check

## Acceptance criteria
- [ ] Unauthenticated requests to API return 401
- [ ] Login with correct secret succeeds and returns JWT
- [ ] Login with wrong secret fails with clear error
- [ ] Dashboard redirects to login page when not authenticated
- [ ] JWT persists across page refreshes
- [ ] Logout clears JWT and redirects to login
- [ ] All existing dashboard pages work correctly after auth is added
- [ ] Auth module is documented in CLAUDE.md env vars section

## Risks / Open questions
- **Shared secret vs. Telegram Login**: Shared secret is simpler but less secure (anyone with the secret has full access). Telegram Login ties to specific admin identities but requires more setup.
- JWT expiry duration: 24h? 7d? Should be configurable.
- Should the API protect read-only endpoints too, or only write endpoints? Recommendation: protect everything — the data is sensitive (user info, moderation logs).
- If the API goes down, the frontend should show a connection error, not a login page.
- Should we use HTTP-only cookies instead of localStorage for JWT? More secure against XSS but adds CORS complexity.

## Notes
The existing BOT_ADMINS env var lists admin Telegram IDs. If using Telegram Login Widget (Option B), this list serves as the allowlist. The API currently has no authentication at all — all endpoints are public.

## Implementation Notes
- Chose Option A (Shared Secret) for simplicity
- Created `apps/api/src/auth/` module:
  - `auth.service.ts` — validates DASHBOARD_SECRET, generates/verifies HMAC-signed tokens (7-day expiry, base64url + SHA-256)
  - `auth.controller.ts` — POST /api/auth/login (validates password, returns token), POST /api/auth/verify (checks token)
  - `auth.guard.ts` — global APP_GUARD that checks Authorization: Bearer header on all routes
  - `public.decorator.ts` — @Public() decorator to skip auth on specific endpoints
  - `auth.module.ts` — registers guard globally, exports service
- Registered in `apps/api/src/app.module.ts`
- Auth endpoints marked @Public() so they're accessible without token
- Created `apps/frontend/src/lib/auth.ts` — localStorage-based token management
- Created `apps/frontend/src/app/login/page.tsx` — clean login page with password input
- Created `apps/frontend/src/components/auth-guard.tsx` — client component redirecting to /login if no token
- Updated `apps/frontend/src/lib/api.ts` — auto-attaches Authorization header, auto-redirects on 401
- Updated `apps/frontend/src/app/dashboard/layout.tsx` — wrapped with AuthGuard
- Updated `apps/frontend/src/components/sidebar.tsx` — added LogoutButton at bottom

## Environment Variables
- `DASHBOARD_SECRET` — shared password for login (defaults to 'change-me-in-production')
- `JWT_SECRET` — optional separate HMAC key (defaults to DASHBOARD_SECRET)

## Validation Notes
- `pnpm api build` passes
- `pnpm frontend build` passes with `/login` route
- All dashboard routes protected by AuthGuard

## Status
Completed
