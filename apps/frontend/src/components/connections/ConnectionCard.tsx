"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Connection {
  id: string;
  name: string;
  platform: string;
  connectionType: string;
  status: string;
  lastActiveAt?: string;
  errorCount?: number;
  error?: string;
  botInstanceId?: string;
}

interface ConnectionCardProps {
  connection: Connection;
  onReauth: (id: string) => void;
  onConfigureScope: (id: string) => void;
  onDelete: (id: string) => void;
  onRestart: (id: string) => void;
  onEditName: (id: string) => void;
  onViewLogs: (id: string) => void;
}

const PLATFORM_ICONS: Record<string, { bg: string; icon: string }> = {
  telegram: { bg: "#2AABEE", icon: "✈" },
  discord: { bg: "#5865F2", icon: "🎮" },
  whatsapp: { bg: "#25D366", icon: "💬" },
};

const STATUS_CONFIG: Record<string, { color: string; dotColor: string; label: string }> = {
  active: { color: "rgba(16,185,129,0.1)", dotColor: "#10b981", label: "Healthy" },
  error: { color: "rgba(239,68,68,0.1)", dotColor: "#ef4444", label: "Auth Error" },
  inactive: { color: "rgba(255,255,255,0.06)", dotColor: "rgba(255,255,255,0.3)", label: "Inactive" },
  authenticating: { color: "rgba(245,158,11,0.1)", dotColor: "#f59e0b", label: "Authenticating" },
};

function formatLastActive(dateStr?: string): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ConnectionCard({
  connection,
  onReauth,
  onConfigureScope,
  onDelete,
  onRestart,
  onEditName,
  onViewLogs,
}: ConnectionCardProps) {
  const platform = PLATFORM_ICONS[connection.platform] ?? { bg: "#666", icon: "?" };
  const status = STATUS_CONFIG[connection.status] ?? STATUS_CONFIG.inactive;
  const isError = connection.status === "error";

  return (
    <div
      className={`flex items-center gap-3.5 rounded-lg border px-4 py-3.5 transition-colors ${
        isError
          ? "border-red-500/20 bg-red-500/[0.03]"
          : "border-white/[0.06] hover:border-white/[0.1]"
      }`}
    >
      <div
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: status.dotColor }}
      />
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-base"
        style={{ backgroundColor: platform.bg }}
      >
        {platform.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{connection.name}</div>
        <div className="text-xs text-muted-foreground">
          {connection.platform} · {connection.connectionType}
          {connection.error ? ` · ${connection.error}` : ""}
        </div>
      </div>
      <div className="shrink-0 text-xs text-muted-foreground">
        {formatLastActive(connection.lastActiveAt)}
      </div>
      <Badge
        variant={isError ? "destructive" : "secondary"}
        className="shrink-0 text-xs"
      >
        {status.label}
      </Badge>
      {isError && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 border-red-500/30 text-xs text-red-400 hover:bg-red-500/10"
          onClick={() => onReauth(connection.id)}
        >
          Re-auth
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
            ⋯
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEditName(connection.id)}>
            Edit name
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onConfigureScope(connection.id)}>
            Configure scope
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onViewLogs(connection.id)}>
            View logs
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRestart(connection.id)}>
            Restart
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => onDelete(connection.id)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
