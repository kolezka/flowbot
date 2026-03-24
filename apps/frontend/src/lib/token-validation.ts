/** Platform-specific token/credential format patterns with advisory hints. */
const TOKEN_PATTERNS: Record<string, { regex: RegExp; hint: string }> = {
  "telegram:bot_token": {
    regex: /^\d{8,10}:[A-Za-z0-9_-]{35,}$/,
    hint: "Format: 123456789:AABBccDDee… (from @BotFather)",
  },
  "telegram:mtproto": {
    regex: /^\+\d{7,15}$/,
    hint: "International format: +1234567890",
  },
  "discord:bot_token": {
    regex: /^[\w-]{24,}\.[\w-]{6,}\.[\w-]{27,}$/,
    hint: "Paste the full token from Discord Developer Portal",
  },
};

/**
 * Validate a credential value against the expected format for the given
 * platform and connection type.
 *
 * @returns A human-readable hint string when the format looks wrong,
 *          or `null` when the value is empty or matches the expected pattern.
 */
export function validateCredential(
  platform: string,
  connectionType: string,
  value: string,
): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const pattern = TOKEN_PATTERNS[`${platform}:${connectionType}`];
  if (!pattern) return null;

  return pattern.regex.test(trimmed) ? null : pattern.hint;
}

/**
 * Shorthand for bot token validation (used by bot-config dialog which
 * only deals with `bot_token` connection types).
 */
export function validateBotToken(
  platform: string,
  token: string,
): string | null {
  return validateCredential(platform, "bot_token", token);
}
