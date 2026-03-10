# Issue #016: Trigger.dev SDK vs CLI Version Mismatch

**Date:** 2026-03-10
**Severity:** Medium
**Status:** Fixed
**Component:** Trigger.dev Worker

## Description

The installed `@trigger.dev/sdk` and `@trigger.dev/build` packages are version `3.3.17`, but `npx trigger.dev@latest` installs CLI version `4.4.3`. Running with `latest` fails with a version mismatch error in CI mode.

## Error Message

```
ERROR: Version mismatch detected while running in CI. This won't end well. Aborting.

CLI version: 4.4.3

Current package versions that don't match the CLI:
- @trigger.dev/sdk@3.3.17
- @trigger.dev/build@3.3.17
```

## Workaround

Use the matching CLI version explicitly:
```bash
npx trigger.dev@3.3.17 dev --api-url https://trigger.raqz.link
```

## Fix

Either:
1. **Pin CLI version** in `package.json` scripts: change `"dev": "npx trigger.dev@latest dev"` to `"dev": "npx trigger.dev@3.3.17 dev"`
2. **Upgrade SDK packages** to match the latest CLI version
