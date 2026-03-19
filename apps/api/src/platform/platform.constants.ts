export const PLATFORMS = {
  TELEGRAM: 'telegram',
  DISCORD: 'discord',
  SLACK: 'slack',
  WHATSAPP: 'whatsapp',
  CUSTOM: 'custom',
} as const;

export type Platform = (typeof PLATFORMS)[keyof typeof PLATFORMS];

export const PLATFORM_LABELS: Record<Platform, string> = {
  telegram: 'Telegram',
  discord: 'Discord',
  slack: 'Slack',
  whatsapp: 'WhatsApp',
  custom: 'Custom',
};
