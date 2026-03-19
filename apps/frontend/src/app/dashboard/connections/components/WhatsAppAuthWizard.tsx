"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useWebSocket, useSocketEvent } from "@/lib/websocket";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WhatsAppStep = "name" | "qr" | "connected" | "error";

interface QrAuthEvent {
  type: "qr" | "connected" | "timeout" | "error";
  qr?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          {i > 0 && <div className="h-px w-6 bg-border" />}
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
              current === i
                ? "bg-primary text-primary-foreground"
                : current > i
                  ? "bg-green-500 text-white"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}
          </div>
          <span className="hidden sm:inline text-xs text-muted-foreground">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// QR display sub-component
// ---------------------------------------------------------------------------

function QrDisplay({ qrDataUrl }: { qrDataUrl: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="rounded-lg border border-border p-3 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt="WhatsApp QR code — scan with your phone"
          width={200}
          height={200}
          className="block"
        />
      </div>
      <p className="text-sm text-muted-foreground text-center max-w-xs">
        Open WhatsApp on your phone, go to{" "}
        <strong>Linked Devices</strong>, and scan this QR code.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WhatsApp auth flow
// ---------------------------------------------------------------------------

export function WhatsAppAuthWizard() {
  const router = useRouter();
  const { joinRoom, leaveRoom } = useWebSocket();

  const [step, setStep] = useState<WhatsAppStep>("name");
  const [name, setName] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const steps = ["Name", "Scan QR", "Done"];
  const stepIndex: Record<WhatsAppStep, number> = {
    name: 0,
    qr: 1,
    connected: 2,
    error: 1,
  };

  // Join the Socket.IO room for this connection once we have an ID
  useEffect(() => {
    if (!connectionId) return;
    const room = `qr-auth:${connectionId}`;
    joinRoom(room);
    return () => {
      leaveRoom(room);
    };
  }, [connectionId, joinRoom, leaveRoom]);

  // Listen for QR auth events from the server
  const handleQrEvent = useCallback(
    (data: QrAuthEvent) => {
      if (data.type === "qr" && data.qr) {
        setQrDataUrl(data.qr);
        setStep("qr");
        setError("");
      } else if (data.type === "connected") {
        setStep("connected");
        setError("");
      } else if (data.type === "timeout" || data.type === "error") {
        setStep("error");
        setError(data.message ?? "Authentication failed. Please try again.");
      }
    },
    [],
  );

  useSocketEvent<QrAuthEvent>("qr-auth", handleQrEvent);

  const handleCreateAndStart = async () => {
    setLoading(true);
    setError("");
    setQrDataUrl(null);

    try {
      const conn = await api.createConnection({
        platform: "whatsapp",
        name,
        connectionType: "baileys",
      });
      setConnectionId(conn.id);

      await api.startConnectionAuth(conn.id, {});
      // QR will arrive via Socket.IO — step transitions inside handleQrEvent
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Failed to start WhatsApp auth";
      setError(msg);
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    setRetryCount((c) => c + 1);
    setStep("qr");
    setQrDataUrl(null);
    setError("");
    setLoading(true);

    try {
      await api.startConnectionAuth(connectionId, {});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to retry auth";
      setError(msg);
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <StepIndicator steps={steps} current={stepIndex[step]} />

      {/* Step 1 — Name */}
      {step === "name" && (
        <Card>
          <CardHeader>
            <CardTitle>Connection Name</CardTitle>
            <CardDescription>
              Give this WhatsApp connection a recognisable name
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="whatsapp-name">Name</Label>
              <Input
                id="whatsapp-name"
                placeholder="My WhatsApp Account"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name && !loading) {
                    void handleCreateAndStart();
                  }
                }}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              onClick={() => void handleCreateAndStart()}
              disabled={!name || loading}
            >
              {loading ? "Starting..." : "Continue"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — QR code */}
      {step === "qr" && (
        <Card>
          <CardHeader>
            <CardTitle>Scan QR Code</CardTitle>
            <CardDescription>
              Use your WhatsApp app to scan the QR code below
              {retryCount > 0 ? ` (attempt ${retryCount + 1})` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {qrDataUrl ? (
              <QrDisplay qrDataUrl={qrDataUrl} />
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-[#25D366]" />
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}

      {/* Step 2 (error state) — retry */}
      {step === "error" && (
        <Card>
          <CardHeader>
            <CardTitle>Authentication Failed</CardTitle>
            <CardDescription>
              The QR code timed out or an error occurred
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3">
              <Button
                onClick={() => void handleRetry()}
                disabled={loading}
              >
                {loading ? "Retrying..." : "Retry"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("name");
                  setName("");
                  setConnectionId("");
                  setQrDataUrl(null);
                  setError("");
                  setRetryCount(0);
                }}
              >
                Start Over
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Connected */}
      {step === "connected" && (
        <Card>
          <CardHeader>
            <CardTitle>Connected!</CardTitle>
            <CardDescription>
              Your WhatsApp account has been linked successfully
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/dashboard/connections")}>
              View Connections
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
