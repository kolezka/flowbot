"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useWebSocket, useSocketEvent } from "@/lib/websocket";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VerificationProps {
  connectionId: string;
  sessionId: string;
  platform: string;
  connectionType: string;
  /** Phone number used for MTProto — needed to resend the code */
  phoneNumber?: string;
  onBack: () => void;
  onComplete: () => void;
}

interface QrAuthEvent {
  type: "qr" | "connected" | "timeout" | "error";
  qr?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// MTProto verification (Telegram account / mtproto)
// ---------------------------------------------------------------------------

const CODE_LENGTH = 5;

function MTProtoVerification({
  connectionId,
  sessionId,
  phoneNumber,
  onBack,
  onComplete,
}: {
  connectionId: string;
  sessionId: string;
  phoneNumber?: string;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join("");
  const codeComplete = code.length === CODE_LENGTH && digits.every((d) => d !== "");

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const updated = digits.map((d, i) => (i === index ? digit : d));
    setDigits(updated);

    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleDigitPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;

    const updated = Array(CODE_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) {
      updated[i] = pasted[i] ?? "";
    }
    setDigits(updated);

    const nextFocus = Math.min(pasted.length, CODE_LENGTH - 1);
    inputRefs.current[nextFocus]?.focus();
  }

  async function handleSubmitCode() {
    if (!codeComplete || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const result = await api.submitConnectionAuthStep(connectionId, "code", {
        sessionId,
        code,
      });

      if (result.status === "password_required") {
        setShowPassword(true);
      } else {
        onComplete();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Invalid code";
      setError(msg);

      const match = /(\d+) attempt/i.exec(msg);
      if (match?.[1]) {
        setAttemptsRemaining(parseInt(match[1], 10));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitPassword() {
    if (!password || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      await api.submitConnectionAuthStep(connectionId, "password", {
        sessionId,
        password,
      });
      onComplete();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Invalid password";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resending || !phoneNumber) return;
    setResending(true);
    setError("");
    setDigits(Array(CODE_LENGTH).fill(""));
    setAttemptsRemaining(null);

    try {
      await api.startConnectionAuth(connectionId, { phoneNumber });
      inputRefs.current[0]?.focus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to resend code";
      setError(msg);
    } finally {
      setResending(false);
    }
  }

  if (showPassword) {
    return (
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="tfa-password">Two-Factor Authentication</Label>
          <p className="text-xs text-muted-foreground">
            Your account has 2FA enabled. Enter your cloud password to continue.
          </p>
          <Input
            id="tfa-password"
            type="password"
            placeholder="Cloud password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && password && !submitting) {
                void handleSubmitPassword();
              }
            }}
            autoFocus
            disabled={submitting}
          />
        </div>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPassword(false)}
            disabled={submitting}
            className="flex-1"
          >
            Back
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmitPassword()}
            disabled={!password || submitting}
            className="flex-1"
          >
            {submitting ? "Verifying…" : "Verify"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Verification Code</Label>
          <p className="text-xs text-muted-foreground">
            Enter the 5-digit code sent to{" "}
            {phoneNumber ? <strong>{phoneNumber}</strong> : "your phone"}.
          </p>
        </div>

        <div className="flex gap-2">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleDigitKeyDown(index, e)}
              onPaste={handleDigitPaste}
              disabled={submitting}
              autoFocus={index === 0}
              aria-label={`Verification code digit ${index + 1}`}
              className="h-[52px] w-[44px] rounded-lg border border-border bg-background text-center text-lg font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          {attemptsRemaining !== null && (
            <span className="ml-1">
              {attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""} remaining.
            </span>
          )}
          {phoneNumber && (
            <span className="ml-1">
              <button
                type="button"
                onClick={() => void handleResend()}
                disabled={resending}
                className="underline hover:no-underline disabled:opacity-50"
              >
                {resending ? "Resending…" : "Resend code"}
              </button>
            </span>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={submitting}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={() => void handleSubmitCode()}
          disabled={!codeComplete || submitting}
          className="flex-1"
        >
          {submitting ? "Verifying…" : "Verify"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WhatsApp QR verification (whatsapp / baileys)
// ---------------------------------------------------------------------------

function WhatsAppVerification({
  connectionId,
  onBack,
  onComplete,
}: {
  connectionId: string;
  onBack: () => void;
  onComplete: () => void;
}) {
  const { joinRoom, leaveRoom } = useWebSocket();

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!connectionId) return;
    const room = `qr-auth:${connectionId}`;
    joinRoom(room);
    // Small delay so the room-join message reaches the server before we trigger auth
    const timer = setTimeout(() => {
      void api.startConnectionAuth(connectionId, {}).catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Failed to start WhatsApp auth";
        setError(msg);
      });
    }, 100);
    return () => {
      clearTimeout(timer);
      leaveRoom(room);
    };
  }, [connectionId, joinRoom, leaveRoom]);

  const handleQrEvent = useCallback(
    (data: QrAuthEvent) => {
      if (data.type === "qr" && data.qr) {
        setQrDataUrl(data.qr);
        setError("");
        setTimedOut(false);
      } else if (data.type === "connected") {
        onComplete();
      } else if (data.type === "timeout" || data.type === "error") {
        setTimedOut(true);
        setError(data.message ?? "QR code expired. Please retry.");
      }
    },
    [onComplete],
  );

  useSocketEvent<QrAuthEvent>("qr-auth", handleQrEvent);

  async function handleRetry() {
    setRetrying(true);
    setError("");
    setTimedOut(false);
    setQrDataUrl(null);

    try {
      await api.startConnectionAuth(connectionId, {});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to retry";
      setError(msg);
      setTimedOut(true);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Scan QR Code</p>
        <p className="text-xs text-muted-foreground">
          Open WhatsApp on your phone, go to <strong>Linked Devices</strong>, and
          scan this QR code.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 py-2">
        {qrDataUrl && !timedOut ? (
          <div className="rounded-lg border border-border bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="WhatsApp QR code — scan with your phone"
              width={200}
              height={200}
              className="block"
            />
          </div>
        ) : timedOut ? (
          <div className="flex h-[226px] w-[226px] items-center justify-center rounded-lg border border-border bg-muted/40">
            <p className="text-center text-xs text-muted-foreground px-4">
              QR code expired
            </p>
          </div>
        ) : (
          <div className="flex h-[226px] w-[226px] items-center justify-center rounded-lg border border-border bg-muted/20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-[#25D366]" />
          </div>
        )}
      </div>

      {(error || timedOut) && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error || "QR code expired."}{" "}
          <button
            type="button"
            onClick={() => void handleRetry()}
            disabled={retrying}
            className="underline hover:no-underline disabled:opacity-50"
          >
            {retrying ? "Retrying…" : "Try again"}
          </button>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={retrying}
          className="flex-1"
        >
          Back
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Verification component — routes to the correct sub-component
// ---------------------------------------------------------------------------

export function Verification({
  connectionId,
  sessionId,
  platform,
  connectionType,
  phoneNumber,
  onBack,
  onComplete,
}: VerificationProps) {
  const isMTProto = platform === "telegram" && connectionType === "mtproto";
  const isWhatsApp = platform === "whatsapp" && connectionType === "baileys";

  if (isMTProto) {
    return (
      <MTProtoVerification
        connectionId={connectionId}
        sessionId={sessionId}
        phoneNumber={phoneNumber}
        onBack={onBack}
        onComplete={onComplete}
      />
    );
  }

  if (isWhatsApp) {
    return (
      <WhatsAppVerification
        connectionId={connectionId}
        onBack={onBack}
        onComplete={onComplete}
      />
    );
  }

  // Bot tokens and discord skip verification entirely — this is a fallback
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        No verification required for this connection type.
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button type="button" onClick={onComplete} className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  );
}
