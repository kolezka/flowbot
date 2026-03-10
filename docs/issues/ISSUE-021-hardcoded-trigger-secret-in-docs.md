# ISSUE-021 — Trigger.dev secret key hardcoded in committed documentation

**Severity:** medium
**Area:** infra
**Discovered in phase:** Phase 3 — API Testing (Security Scan)

---

## Description

The Trigger.dev development secret key (`tr_dev_pd7r4ISDoUW36jlJSVLH`) is committed to git in multiple documentation and config files. While this is a dev key for a self-hosted instance, committed secrets are a security risk if the repo becomes public or the key is reused.

---

## Steps to Reproduce

1. Search the repository:
   ```bash
   grep -r "tr_dev_" --include="*.md" .
   ```
2. Found in:
   - `CLAUDE.md` line 112
   - `docs/archive/2026-03-09-trigger-dev-integration-design.md` (lines 11, 132, 211, 222)
   - `.ralph/fix-qa-issues-prompt.md` line 19

**Environment:** Source code review

---

## Actual Result

Secret key is committed to multiple documentation files in the repository.

---

## Expected Result

Secret keys should never be committed. Use placeholder values (e.g., `<TRIGGER_SECRET_KEY>`) in documentation and reference `.trigger-secret-key` file or environment variables.

---

## Acceptance Criteria

- [ ] All hardcoded instances of the Trigger.dev secret key are replaced with placeholders in committed files
- [ ] Documentation references the `.trigger-secret-key` file or env var instead
- [ ] The existing secret key is rotated on the self-hosted Trigger.dev instance

---

## Notes

The `.trigger-secret-key` file itself is properly gitignored. Only the documentation files contain the actual key.
