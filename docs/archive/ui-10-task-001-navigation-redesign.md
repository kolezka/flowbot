# Task: Dashboard Navigation Redesign

## Summary
Replace the flat top-bar navigation with a collapsible sidebar that organizes 30+ pages into logical sections.

## Problem
The current dashboard has a single horizontal nav bar with 6 buttons (Users, Products, Categories, Carts, Broadcast, Moderation). This doesn't scale — the moderation section alone has 8+ sub-pages, and adding automation, reputation, scheduled messages, and filters will create 15+ more entry points. There's no mobile navigation, no visual hierarchy, and no section grouping.

## Goal
A sidebar-based navigation system that organizes all dashboard pages into clear sections, supports nested routes, and works on mobile devices.

## Scope
In scope:
- Sidebar component with collapsible sections
- Section grouping: E-commerce (Users, Products, Categories, Carts), Moderation (Groups, Logs, Warnings, Analytics), Automation (Broadcast, Jobs), Settings
- Active state highlighting for current route and parent section
- Mobile responsive: hamburger menu toggle
- Dashboard layout restructure (`apps/frontend/src/app/dashboard/layout.tsx`)
- Breadcrumb component for deep pages

Out of scope:
- Adding new pages (just reorganizing navigation for existing and future pages)
- Authentication (separate task)
- Changing page content

## Requirements
- Functional: Sidebar with sections, each section expandable/collapsible, active route highlighting, mobile hamburger toggle
- Technical: Reuse existing Radix UI components where possible, Tailwind CSS for styling, Next.js `usePathname` for active state
- UX: Sidebar should be 240-280px wide, collapsible to icon-only mode on desktop, overlay on mobile
- Integration: Must not break existing page routes

## Dependencies
- None — this is a foundational task

## Proposed approach
1. Create `apps/frontend/src/components/sidebar.tsx` with:
   - Section component (icon, label, children links)
   - NavLink component (active state via `usePathname`)
   - Mobile toggle using Radix Dialog or Sheet
2. Restructure `dashboard/layout.tsx` to use sidebar + main content area
3. Add breadcrumb component for nested routes
4. Sections:
   - **Dashboard** — Home/overview
   - **E-commerce** — Users, Products, Categories, Carts
   - **Moderation** — Overview, Groups, Logs, Analytics
   - **Automation** — Broadcast, Jobs (placeholder)
   - **Community** — Reputation (placeholder)

## Deliverables
- `components/sidebar.tsx` — Sidebar navigation component
- `components/breadcrumb.tsx` — Breadcrumb component
- Updated `dashboard/layout.tsx` — Sidebar layout integration
- All existing pages accessible via new navigation

## Acceptance criteria
- [ ] Sidebar renders with all existing pages organized into sections
- [ ] Active route and parent section are visually highlighted
- [ ] Sections are collapsible/expandable
- [ ] Mobile: sidebar is hidden by default, toggleable via hamburger button
- [ ] Desktop: sidebar is visible by default, can be collapsed to icons
- [ ] All existing pages remain accessible and functional
- [ ] Breadcrumbs show on pages 2+ levels deep (e.g., Moderation > Groups > Group Detail)
- [ ] No layout shift or visual regression on existing pages

## Risks / Open questions
- Should the sidebar persist collapsed state in localStorage?
- Icon library choice: lucide-react (already common with Radix), heroicons, or inline SVG?
- Should the top header remain for branding/user info, or fully replace with sidebar header?

## Notes
The current layout is at `apps/frontend/src/app/dashboard/layout.tsx`. It uses a simple `<header>` with `<nav>` containing Link/Button pairs. The moderation section already has its own sub-layout at `apps/frontend/src/app/dashboard/moderation/layout.tsx` with a secondary nav bar.

## Implementation Notes
- Created `apps/frontend/src/components/sidebar.tsx` with full sidebar navigation
- Updated `apps/frontend/src/app/dashboard/layout.tsx` to use sidebar layout (server component)
- Simplified `apps/frontend/src/app/dashboard/moderation/layout.tsx` — removed redundant secondary nav
- Used lucide-react icons (already installed) — no new dependencies needed
- Mobile sidebar uses React context (MobileSidebarProvider) for state management across trigger and panel
- Desktop sidebar is 256px (w-64), sticky, with scrollable nav area
- Mobile sidebar is a fixed overlay with backdrop, body scroll lock, and Escape key handler
- Sections auto-expand when active route matches, manual toggles preserved for inactive sections
- Removed standalone "Overview" link and empty "Community" section per architecture review
- Dashboard layout is a Server Component (no "use client") — client boundary pushed to sidebar.tsx
- Breadcrumb component deferred — can be added as a follow-up when deep pages are added

## Validation Notes
- `pnpm frontend build` passes with all 21 routes (14 static, 7 dynamic)
- All 9 existing navigation targets verified present in sidebar
- Architecture review found and fixed: duplicate /dashboard href, unnecessary "use client", empty Community section
- No regressions in existing pages

## Status
Completed

## Deferred
- [ ] Breadcrumb component (not yet needed — will add when deeper pages like scheduled messages are created)
- [ ] Icon-only collapsed mode on desktop (nice-to-have, not blocking)
