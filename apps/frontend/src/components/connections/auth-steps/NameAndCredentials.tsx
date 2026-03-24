"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/get-error-message";
import { validateCredential } from "@/lib/token-validation";

interface NameAndCredentialsProps {
  platform: string;
  connectionType: string;
  onBack: () => void;
  onSubmit: (data: { name: string; connectionId: string; sessionId: string; phoneNumber?: string }) => void;
}

function getCredentialConfig(
  platform: string,
  connectionType: string,
): { label: string; placeholder: string; type: "password" | "text" } | null {
  if (platform === "telegram" && connectionType === "bot_token") {
    return {
      label: "Bot Token",
      placeholder: "123456789:AABBccDDee... (from @BotFather)",
      type: "password",
    };
  }
  if (platform === "telegram" && connectionType === "mtproto") {
    return {
      label: "Phone Number",
      placeholder: "+1234567890",
      type: "text",
    };
  }
  if (platform === "discord" && connectionType === "bot_token") {
    return {
      label: "Bot Token",
      placeholder: "Bot token from Developer Portal",
      type: "password",
    };
  }
  // whatsapp baileys — no credential input at this step
  return null;
}

function getPlatformLabel(platform: string, connectionType: string): string {
  if (platform === "telegram" && connectionType === "bot_token") return "Telegram Bot";
  if (platform === "telegram" && connectionType === "mtproto") return "Telegram Account";
  if (platform === "discord") return "Discord Bot";
  if (platform === "whatsapp") return "WhatsApp";
  return platform;
}

export function NameAndCredentials({
  platform,
  connectionType,
  onBack,
  onSubmit,
}: NameAndCredentialsProps) {
  const [name, setName] = useState("");
  const [credential, setCredential] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validationHint, setValidationHint] = useState<string | null>(null);

  const credentialConfig = getCredentialConfig(platform, connectionType);
  const platformLabel = getPlatformLabel(platform, connectionType);
  const isWhatsApp = platform === "whatsapp";

  const canSubmit =
    name.trim().length > 0 &&
    (credentialConfig === null || credential.trim().length > 0) &&
    !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError("");

    try {
      const conn = await api.createConnection({
        platform,
        name: name.trim(),
        connectionType,
      });

      const connectionId = conn.id;
      let sessionId = "";

      if (!isWhatsApp) {
        const authPayload: Record<string, unknown> =
          connectionType === "mtproto"
            ? { phoneNumber: credential.trim() }
            : { botToken: credential.trim() };

        const authResult = await api.startConnectionAuth(connectionId, authPayload);
        sessionId = authResult.sessionId ?? "";
      }

      const phoneNumber =
        connectionType === "mtproto" ? credential.trim() : undefined;
      onSubmit({ name: name.trim(), connectionId, sessionId, phoneNumber });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to start authentication"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="conn-name">Connection name</Label>
        <Input
          id="conn-name"
          placeholder={`My ${platformLabel}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          A memorable name for this {platformLabel} connection.
        </p>
      </div>

      {credentialConfig && (
        <div className="space-y-1.5">
          <Label htmlFor="conn-credential">{credentialConfig.label}</Label>
          <Input
            id="conn-credential"
            type={credentialConfig.type}
            placeholder={credentialConfig.placeholder}
            value={credential}
            onChange={(e) => {
              setCredential(e.target.value);
              setValidationHint(
                validateCredential(platform, connectionType, e.target.value),
              );
            }}
            disabled={loading}
          />
          {validationHint && credential.trim() && (
            <p className="text-xs text-amber-600">{validationHint}</p>
          )}
        </div>
      )}

      {isWhatsApp && (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          You&apos;ll scan a QR code to link your WhatsApp account in the next step.
        </p>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            className="ml-2 text-xs underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={loading}
          className="flex-1"
        >
          Back
        </Button>
        <Button type="submit" disabled={!canSubmit} className="flex-1">
          {loading ? "Connecting…" : "Continue"}
        </Button>
      </div>
    </form>
  );
}
