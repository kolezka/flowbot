import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PLATFORM_CONFIG: Record<string, { label: string; color: string }> = {
  telegram: { label: "Telegram", color: "bg-[#0088cc]/10 text-[#0088cc] border-[#0088cc]/20" },
  discord: { label: "Discord", color: "bg-[#5865F2]/10 text-[#5865F2] border-[#5865F2]/20" },
  slack: { label: "Slack", color: "bg-[#4A154B]/10 text-[#4A154B] border-[#4A154B]/20" },
  whatsapp: { label: "WhatsApp", color: "bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20" },
  custom: { label: "Custom", color: "bg-gray-100 text-gray-600 border-gray-200" },
};

interface PlatformBadgeProps {
  platform: string;
  className?: string;
}

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  const config = PLATFORM_CONFIG[platform] ?? PLATFORM_CONFIG.custom;

  return (
    <Badge variant="outline" className={cn(config?.color, className)}>
      {config?.label}
    </Badge>
  );
}
