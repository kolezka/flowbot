"use client";

import { useState } from "react";

interface PlatformSelectProps {
  onSelect: (platform: string, connectionType: string) => void;
}

interface PlatformCard {
  id: string;
  label: string;
  icon: string;
  bg: string;
  description: string;
  connectionType?: string;
}

const PLATFORMS: PlatformCard[] = [
  {
    id: "telegram",
    label: "Telegram",
    icon: "✈",
    bg: "#2AABEE",
    description: "Bot token or user account (MTProto)",
  },
  {
    id: "discord",
    label: "Discord",
    icon: "🎮",
    bg: "#5865F2",
    description: "Bot token from Developer Portal",
    connectionType: "bot_token",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: "💬",
    bg: "#25D366",
    description: "Link via QR code (Baileys)",
    connectionType: "baileys",
  },
];

const TELEGRAM_SUBTYPES = [
  {
    connectionType: "bot_token",
    label: "Bot Token",
    icon: "🤖",
    description: "Receive updates via @BotFather token",
  },
  {
    connectionType: "mtproto",
    label: "User Account (MTProto)",
    icon: "👤",
    description: "Full account access via phone number",
  },
];

export function PlatformSelect({ onSelect }: PlatformSelectProps) {
  const [showTelegramSub, setShowTelegramSub] = useState(false);

  function handlePlatformClick(platform: PlatformCard) {
    if (platform.id === "telegram") {
      setShowTelegramSub(true);
      return;
    }
    onSelect(platform.id, platform.connectionType!);
  }

  if (showTelegramSub) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setShowTelegramSub(false)}
          className="group mb-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="transition-transform group-hover:-translate-x-0.5">
            ←
          </span>{" "}
          Back to platforms
        </button>
        <p className="text-sm font-medium text-foreground">
          Choose Telegram connection type
        </p>
        {TELEGRAM_SUBTYPES.map((sub) => (
          <button
            key={sub.connectionType}
            onClick={() => onSelect("telegram", sub.connectionType)}
            className="group w-full rounded-xl border border-border/60 bg-card p-4 text-left transition-all duration-150 hover:border-[#2AABEE]/40 hover:bg-[#2AABEE]/[0.04] hover:shadow-[0_0_0_1px_rgba(42,171,238,0.1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2AABEE]/10 text-base transition-colors group-hover:bg-[#2AABEE]/20">
                {sub.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {sub.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sub.description}
                </p>
              </div>
              <span className="text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground">
                ›
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Choose a platform</p>
      {PLATFORMS.map((platform) => (
        <button
          key={platform.id}
          onClick={() => handlePlatformClick(platform)}
          autoFocus={platform.id === "telegram"}
          className="group w-full rounded-xl border border-border/60 bg-card p-4 text-left transition-all duration-150 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={
            {
              "--platform-color": platform.bg,
            } as React.CSSProperties
          }
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = `${platform.bg}33`;
            e.currentTarget.style.backgroundColor = `${platform.bg}08`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "";
            e.currentTarget.style.backgroundColor = "";
          }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white text-base shadow-sm"
              style={{ backgroundColor: platform.bg }}
            >
              {platform.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {platform.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {platform.description}
              </p>
            </div>
            <span className="text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground">
              ›
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
