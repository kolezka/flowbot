"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
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

type Platform = "telegram" | "discord" | null;
type TelegramStep = "name" | "phone" | "code" | "password" | "done";
type DiscordStep = "name" | "token" | "done";

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
// Telegram auth flow
// ---------------------------------------------------------------------------

function TelegramAuthFlow() {
  const router = useRouter();
  const [step, setStep] = useState<TelegramStep>("name");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const steps = ["Name", "Phone", "Code", "Done"];
  const stepIndex: Record<TelegramStep, number> = {
    name: 0,
    phone: 1,
    code: 2,
    password: 2,
    done: 3,
  };

  const handleCreateConnection = async () => {
    setLoading(true);
    setError("");
    try {
      const conn = await api.createConnection({
        platform: "telegram",
        name,
        connectionType: "mtproto",
      });
      setConnectionId(conn.id);
      setStep("phone");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create connection";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAuth = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.startConnectionAuth(connectionId, { phoneNumber: phone });
      if (result.sessionId) setSessionId(result.sessionId);
      setStep("code");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to start auth";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCode = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.submitConnectionAuthStep(connectionId, "code", {
        sessionId,
        code,
      });
      if (result.status === "password_required") {
        setStep("password");
      } else {
        setStep("done");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Invalid code";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPassword = async () => {
    setLoading(true);
    setError("");
    try {
      await api.submitConnectionAuthStep(connectionId, "password", {
        sessionId,
        password,
      });
      setStep("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Invalid password";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <StepIndicator steps={steps} current={stepIndex[step]} />

      {step === "name" && (
        <Card>
          <CardHeader>
            <CardTitle>Connection Name</CardTitle>
            <CardDescription>
              Give this Telegram connection a recognisable name
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="My Telegram Account"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleCreateConnection} disabled={!name || loading}>
              {loading ? "Creating..." : "Continue"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "phone" && (
        <Card>
          <CardHeader>
            <CardTitle>Phone Number</CardTitle>
            <CardDescription>
              Enter the phone number for MTProto authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="+1234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleStartAuth} disabled={!phone || loading}>
              {loading ? "Sending..." : "Send Code"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "code" && (
        <Card>
          <CardHeader>
            <CardTitle>Verification Code</CardTitle>
            <CardDescription>Enter the code sent to {phone}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                placeholder="12345"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleSubmitCode} disabled={!code || loading}>
              {loading ? "Verifying..." : "Verify"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "password" && (
        <Card>
          <CardHeader>
            <CardTitle>Two-Factor Authentication</CardTitle>
            <CardDescription>Enter your 2FA password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleSubmitPassword} disabled={!password || loading}>
              {loading ? "Authenticating..." : "Authenticate"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardHeader>
            <CardTitle>Connection Created</CardTitle>
            <CardDescription>
              Your Telegram connection has been set up successfully
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

// ---------------------------------------------------------------------------
// Discord auth flow
// ---------------------------------------------------------------------------

function DiscordAuthFlow() {
  const router = useRouter();
  const [step, setStep] = useState<DiscordStep>("name");
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const steps = ["Name", "Token", "Done"];
  const stepIndex: Record<DiscordStep, number> = { name: 0, token: 1, done: 2 };

  const handleCreateConnection = async () => {
    setLoading(true);
    setError("");
    try {
      const conn = await api.createConnection({
        platform: "discord",
        name,
        connectionType: "bot_token",
      });
      setConnectionId(conn.id);
      setStep("token");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create connection";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitToken = async () => {
    setLoading(true);
    setError("");
    try {
      await api.startConnectionAuth(connectionId, { botToken: token });
      setStep("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to connect";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <StepIndicator steps={steps} current={stepIndex[step]} />

      {step === "name" && (
        <Card>
          <CardHeader>
            <CardTitle>Connection Name</CardTitle>
            <CardDescription>
              Give this Discord connection a recognisable name
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="discord-name">Name</Label>
              <Input
                id="discord-name"
                placeholder="My Discord Bot"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleCreateConnection} disabled={!name || loading}>
              {loading ? "Creating..." : "Continue"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "token" && (
        <Card>
          <CardHeader>
            <CardTitle>Bot Token</CardTitle>
            <CardDescription>
              Enter your Discord bot token from the Developer Portal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="bot-token">Bot Token</Label>
              <Input
                id="bot-token"
                type="password"
                placeholder="MTxxxxxxx..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleSubmitToken} disabled={!token || loading}>
              {loading ? "Connecting..." : "Connect"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardHeader>
            <CardTitle>Connection Created</CardTitle>
            <CardDescription>
              Your Discord connection has been set up successfully
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

// ---------------------------------------------------------------------------
// Main wizard page
// ---------------------------------------------------------------------------

export default function ConnectionAuthPage() {
  const [platform, setPlatform] = useState<Platform>(null);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Add Connection</h1>

      {platform === null && (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Select the platform you want to connect to.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setPlatform("telegram")}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-border p-6 hover:border-primary hover:bg-accent/50 transition-colors"
            >
              <span className="text-3xl">✈️</span>
              <span className="font-semibold">Telegram</span>
              <span className="text-xs text-muted-foreground text-center">
                MTProto user account or bot token
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPlatform("discord")}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-border p-6 hover:border-primary hover:bg-accent/50 transition-colors"
            >
              <span className="text-3xl">🎮</span>
              <span className="font-semibold">Discord</span>
              <span className="text-xs text-muted-foreground text-center">
                Discord bot token
              </span>
            </button>
          </div>
        </div>
      )}

      {platform === "telegram" && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setPlatform(null)}
            className="text-sm text-muted-foreground underline"
          >
            &larr; Change platform
          </button>
          <TelegramAuthFlow />
        </div>
      )}

      {platform === "discord" && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setPlatform(null)}
            className="text-sm text-muted-foreground underline"
          >
            &larr; Change platform
          </button>
          <DiscordAuthFlow />
        </div>
      )}
    </div>
  );
}
