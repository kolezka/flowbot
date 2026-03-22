"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Verification } from "./auth-steps/Verification";
import { HealthCheck } from "./auth-steps/HealthCheck";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "credentials" | "verification" | "health";

export interface ReauthSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  connection: {
    id: string;
    name: string;
    platform: string;
    connectionType: string;
  };
}

interface ReauthState {
  sessionId: string;
  phoneNumber: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STEP_LABELS: Record<Step, string> = {
  credentials: "Credentials",
  verification: "Verify",
  health: "Health Check",
};

function getCredentialConfig(
  platform: string,
  connectionType: string,
): { label: string; placeholder: string; type: "password" | "text" } | null {
  if (platform === "telegram" && connectionType === "bot_token") {
    return {
      label: "Bot Token",
      placeholder: "123456789:AABBccDDee… (from @BotFather)",
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

// ---------------------------------------------------------------------------
// CredentialsStep — inline (no platform select, pre-filled name read-only)
// ---------------------------------------------------------------------------

interface CredentialsStepProps {
  connection: ReauthSheetProps["connection"];
  onSubmit: (data: { sessionId: string; phoneNumber: string }) => void;
}

function CredentialsStep({ connection, onSubmit }: CredentialsStepProps) {
  const [credential, setCredential] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { platform, connectionType, id: connectionId } = connection;

  const credentialConfig = getCredentialConfig(platform, connectionType);
  const platformLabel = getPlatformLabel(platform, connectionType);
  const isWhatsApp = platform === "whatsapp";

  const canSubmit =
    (credentialConfig === null || credential.trim().length > 0) && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError("");

    try {
      let sessionId = "";
      const phoneNumber =
        connectionType === "mtproto" ? credential.trim() : "";

      if (!isWhatsApp) {
        const authPayload: Record<string, unknown> =
          connectionType === "mtproto"
            ? { phoneNumber: credential.trim() }
            : { botToken: credential.trim() };

        const authResult = await api.startConnectionAuth(connectionId, authPayload);
        sessionId = authResult.sessionId ?? "";
      }

      onSubmit({ sessionId, phoneNumber });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Connection name — read-only */}
      <div className="space-y-1.5">
        <Label htmlFor="reauth-name">Connection name</Label>
        <Input
          id="reauth-name"
          value={connection.name}
          readOnly
          disabled
          className="bg-muted/40 text-muted-foreground"
        />
      </div>

      {credentialConfig && (
        <div className="space-y-1.5">
          <Label htmlFor="reauth-credential">{credentialConfig.label}</Label>
          <Input
            id="reauth-credential"
            type={credentialConfig.type}
            placeholder={credentialConfig.placeholder}
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            disabled={loading}
            autoFocus
          />
        </div>
      )}

      {isWhatsApp && (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          You'll scan a QR code to re-link your WhatsApp account in the next step.
        </p>
      )}

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={!canSubmit} className="w-full">
        {loading ? "Connecting…" : `Re-authenticate ${platformLabel}`}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// ReauthSheet
// ---------------------------------------------------------------------------

export function ReauthSheet({
  open,
  onOpenChange,
  onComplete,
  connection,
}: ReauthSheetProps) {
  const [step, setStep] = useState<Step>("credentials");
  const [reauthState, setReauthState] = useState<Partial<ReauthState>>({});

  const steps: Step[] = ["credentials", "verification", "health"];
  const currentIndex = steps.indexOf(step);

  const skipVerification =
    connection.connectionType === "bot_token" ||
    connection.platform === "discord";

  function handleClose(isOpen: boolean) {
    if (!isOpen) {
      setStep("credentials");
      setReauthState({});
    }
    onOpenChange(isOpen);
  }

  function handleCredentialsSubmit(data: { sessionId: string; phoneNumber: string }) {
    setReauthState(data);
    setStep(skipVerification ? "health" : "verification");
  }

  function handleVerificationComplete() {
    setStep("health");
  }

  function handleHealthComplete() {
    handleClose(false);
    onComplete();
  }

  // Visible steps depend on whether verification is needed
  const visibleSteps: Step[] = skipVerification
    ? ["credentials", "health"]
    : ["credentials", "verification", "health"];

  const visibleIndex = visibleSteps.indexOf(step);

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-[440px] overflow-y-auto sm:max-w-[440px]">
        <SheetHeader>
          <SheetTitle>Re-authenticate Connection</SheetTitle>
        </SheetHeader>

        {/* Warning banner */}
        <div className="mb-5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          Your session expired. Re-enter credentials. Settings and scope preserved.
        </div>

        {/* Breadcrumb */}
        <nav className="mb-6 flex gap-1.5 text-xs text-muted-foreground">
          {visibleSteps.map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              {i > 0 && <span>›</span>}
              <span className={i === visibleIndex ? "text-foreground font-medium" : ""}>
                {STEP_LABELS[s]}
              </span>
            </span>
          ))}
        </nav>

        {step === "credentials" && (
          <CredentialsStep
            connection={connection}
            onSubmit={handleCredentialsSubmit}
          />
        )}

        {step === "verification" && (
          <Verification
            connectionId={connection.id}
            sessionId={reauthState.sessionId ?? ""}
            platform={connection.platform}
            connectionType={connection.connectionType}
            phoneNumber={reauthState.phoneNumber}
            onBack={() => setStep("credentials")}
            onComplete={handleVerificationComplete}
          />
        )}

        {step === "health" && (
          <HealthCheck
            connectionId={connection.id}
            onComplete={handleHealthComplete}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
