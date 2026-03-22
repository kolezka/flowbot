"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

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
    description: "Receive updates via @BotFather token",
  },
  {
    connectionType: "mtproto",
    label: "User Account (MTProto)",
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
          className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
        <p className="text-sm font-medium">Choose Telegram connection type</p>
        {TELEGRAM_SUBTYPES.map((sub) => (
          <button
            key={sub.connectionType}
            onClick={() => onSelect("telegram", sub.connectionType)}
            className="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-[#2AABEE]/60 hover:bg-[#2AABEE]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white text-base"
                style={{ backgroundColor: "#2AABEE" }}
              >
                ✈
              </div>
              <div>
                <p className="text-sm font-medium">{sub.label}</p>
                <p className="text-xs text-muted-foreground">{sub.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Choose a platform</p>
      {PLATFORMS.map((platform) => (
        <button
          key={platform.id}
          onClick={() => handlePlatformClick(platform)}
          className="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={
            {
              "--hover-border": platform.bg,
            } as React.CSSProperties
          }
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white text-base"
              style={{ backgroundColor: platform.bg }}
            >
              {platform.icon}
            </div>
            <div>
              <p className="text-sm font-medium">{platform.label}</p>
              <p className="text-xs text-muted-foreground">{platform.description}</p>
            </div>
            <span className="ml-auto text-muted-foreground">›</span>
          </div>
        </button>
      ))}
    </div>
  );
}
