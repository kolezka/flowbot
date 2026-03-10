# mb-04 — Risks, Open Questions, Assumptions, Constraints

## Assumptions

| # | Assumption | Impact if Wrong |
|---|-----------|----------------|
| A1 | The bot will use its own dedicated bot token (separate from `apps/bot`) | If shared: context collision, feature bleed, complex routing |
| A2 | The bot operates in group/supergroup chats as its primary mode | If also private DMs: need separate session key strategy, more complex routing |
| A3 | New Prisma models can be added to the shared schema without breaking existing apps | If separate DB needed: new Docker service, connection management |
| A4 | The bot manages a small-to-medium number of groups (1–50) simultaneously | If hundreds: admin cache strategy must change, memory pressure from anti-spam tracking |
| A5 | Polling mode for development, webhook for production (same as sales bot) | If webhook-only: dev workflow changes, need tunnel for local development |
| A6 | No CI/CD exists — manual deployment is acceptable for now | If CI needed: add pipeline as a prerequisite task |
| A7 | The bot will be deployed as a single process (not horizontally scaled) | If multi-instance: need distributed locks for job claims, shared cache for admin lists |
| A8 | English is sufficient for MVP moderation messages | If multi-language from day one: i18n is a prerequisite, not Phase 4 |
| A9 | The existing `apps/bot` will not be modified — zero coupling between the two bots | If code sharing needed: extract to a shared package under `packages/` |
| A10 | grammY v1.36+ remains stable and maintained | If breaking changes: pinned version in package.json mitigates |

## Constraints

| # | Constraint | Implication |
|---|-----------|------------|
| C1 | Telegram Bot API rate limits: 20 messages/minute per group, 30 messages/second global | Anti-spam responses must be batched; `deleteMessages` (bulk) preferred over individual `deleteMessage` |
| C2 | Messages older than 48 hours cannot be deleted via Bot API | `/purge` must validate message age; audit log cannot retroactively clean old messages |
| C3 | Bot must be a group admin with specific permissions to moderate | Need onboarding flow that verifies permissions on `my_chat_member` update |
| C4 | `chat_member` updates must be explicitly requested via `allowed_updates` | Must configure this in both polling and webhook setup — easy to miss |
| C5 | Prisma schema is shared — migrations affect all apps | New models must be additive-only; migration tested against existing apps before merging |
| C6 | No existing test infrastructure in the bot workspace | Testing patterns must be established from scratch; Vitest recommended |
| C7 | ESM module system required (matching bot and db packages) | Some grammY plugins may have CJS-only packages — verify compatibility |
| C8 | No Redis or message broker in the stack | Scheduled tasks and rate tracking must use in-memory structures or PostgreSQL |

## Risks

### High Priority

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R1 | **Rate limit exhaustion in busy groups** — Anti-spam detection triggers many delete + reply + restrict calls, exceeding 20 msg/min per group | High | Bot becomes unresponsive, moderation messages dropped | Use `auto-retry` + `transformer-throttler` plugins. Batch deletes via `deleteMessages`. Suppress bot confirmation messages under load (counter, not individual replies). |
| R2 | **Anti-spam false positives** — Legitimate active users flagged as spam, muted or warned incorrectly | Medium | User frustration, admin trust erosion | Conservative default thresholds. All automated actions logged. `/unwarn` and `/unmute` readily available. Warning decay prevents permanent records. |
| R3 | **Admin cache staleness** — Cached admin list doesn't reflect recent promote/demote | Medium | Non-admin executes admin command, or admin blocked from commands | Invalidate on `chat_member` admin status changes. 5-minute TTL as safety net. Force-refresh command (`/refreshadmins`). |
| R4 | **Memory growth from anti-spam tracking** — Per-user-per-group message tracking in memory grows unbounded in busy groups | Medium | Process OOM crash | LRU eviction per group (max 1000 tracked users). Prune entries older than window on every check. Monitor heap usage in health endpoint. |
| R5 | **Prisma migration breaks existing apps** — New models or enums conflict with existing schema | Low | Build failure across all apps | Additive-only migrations. Test `pnpm bot typecheck` and `pnpm api build` after every schema change. |

### Medium Priority

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R6 | **Bot removed from group without notice** — Telegram silently removes bots sometimes | Low | Bot stops functioning in that group, stale data | Handle `my_chat_member` update with `left`/`kicked` status → mark `ManagedGroup.isActive = false`. |
| R7 | **Concurrent moderation conflicts** — Two admins warn same user simultaneously, double-escalation | Medium | User gets double punishment | Use database-level warning count query (not cached count) before escalation. Atomic operations where possible. |
| R8 | **Spam raid** — Coordinated join of many bot accounts flooding the group | Low | Group overwhelmed before anti-spam can react | CAPTCHA verification (Phase 3). Quarantine period for new members. Emergency `/lockdown` command (future). |
| R9 | **Webhook secret token mismatch** — Webhook mode starts but secret doesn't match | Low | Updates rejected, bot silent | Fail-fast validation on startup. Health endpoint reports webhook status. |
| R10 | **Duration parsing edge cases** — Users enter invalid duration formats like `10x` or `999d` | Medium | Confusing error messages or unreasonable mute durations | Strict parsing with max cap (e.g., 30 days). Clear error message listing valid formats. |

### Low Priority

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R11 | **Session storage in-memory (MemorySessionStorage) loses data on restart** | Medium | Group configs re-loaded from DB on next update (self-healing) | Session is a cache layer; DB is source of truth. Acceptable for MVP. |
| R12 | **Link regex false positives** — Legitimate text matched as URLs | Low | Messages incorrectly deleted | Use established URL regex patterns. Whitelist common false positives. Warn before delete (first offense). |
| R13 | **Plugin version conflicts with sales bot** — Different grammY plugin versions needed | Very Low | pnpm handles per-workspace versions | Non-issue with pnpm workspaces — each app has independent node_modules. |

## Open Questions

### Must Resolve Before Implementation

| # | Question | Default Assumption | Impact |
|---|---------|-------------------|--------|
| Q1 | How many groups will the bot manage? | 1–10 groups | Affects caching strategy, memory budgets, DB query patterns |
| Q2 | Should the bot support Telegram forum/topics? | No (defer to future) | Adds significant complexity to message routing and moderation scoping |
| Q3 | What bot token will be used? | New dedicated bot via @BotFather | Must be created before any integration testing |
| Q4 | Is multi-language required for MVP? | No (English only) | Defers i18n infrastructure; add later when needed |

### Can Resolve During Implementation

| # | Question | Default Assumption |
|---|---------|-------------------|
| Q5 | Should moderation log channel be a required or optional setup? | Optional (Phase 2) |
| Q6 | Should the bot respond in the group or via DM to the admin? | In-group (simpler; DM requires user to have started the bot) |
| Q7 | What are the right default anti-spam thresholds? | 10 messages / 10 seconds (tunable via /config) |
| Q8 | Should `/purge` require confirmation for large counts? | Yes, if N > 20 |
| Q9 | How should the bot behave in groups where it lacks required permissions? | Send one warning to group, log error, disable moderation features |
| Q10 | Should automated warnings have a different weight than manual warnings? | Same weight (simplicity) |

### Deferred Questions (Future Phases)

| # | Question | Phase |
|---|---------|-------|
| Q11 | Should the manager-bot integrate with the admin dashboard? | Future (Phase 23 in features doc) |
| Q12 | Should there be cross-bot communication (sales bot triggers manager-bot action)? | Future |
| Q13 | Should the bot support custom commands defined by group admins? | Future |
| Q14 | Should there be a web-based configuration interface? | Future (dashboard integration) |
