"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "phone" | "code" | "password" | "done";

export default function AuthWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [sessionId, setSessionId] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePhone = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.startTgAuth(phone);
      setSessionId(result.sessionId);
      setStep("code");
    } catch (e: any) {
      setError(e.message || "Failed to start auth");
    } finally {
      setLoading(false);
    }
  };

  const handleCode = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.submitTgAuthCode(sessionId, code);
      if (result.status === "password_required") {
        setStep("password");
      } else {
        setStep("done");
      }
    } catch (e: any) {
      setError(e.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handlePassword = async () => {
    setLoading(true);
    setError("");
    try {
      await api.submitTgAuthPassword(sessionId, password);
      setStep("done");
    } catch (e: any) {
      setError(e.message || "Invalid password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold">New Session Authentication</h1>

      <div className="flex items-center gap-2 mb-6">
        {(["phone", "code", "password", "done"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-6 bg-border" />}
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s ? "bg-primary text-primary-foreground" :
              (["phone", "code", "password", "done"].indexOf(step) > i) ? "bg-green-500 text-white" :
              "bg-muted text-muted-foreground"
            }`}>{i + 1}</div>
          </div>
        ))}
      </div>

      {step === "phone" && (
        <Card>
          <CardHeader><CardTitle>Phone Number</CardTitle><CardDescription>Enter the phone number for MTProto authentication</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div><Label htmlFor="phone">Phone</Label><Input id="phone" placeholder="+1234567890" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handlePhone} disabled={!phone || loading}>{loading ? "Sending..." : "Send Code"}</Button>
          </CardContent>
        </Card>
      )}

      {step === "code" && (
        <Card>
          <CardHeader><CardTitle>Verification Code</CardTitle><CardDescription>Enter the code sent to {phone}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div><Label htmlFor="code">Code</Label><Input id="code" placeholder="12345" value={code} onChange={(e) => setCode(e.target.value)} /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleCode} disabled={!code || loading}>{loading ? "Verifying..." : "Verify"}</Button>
          </CardContent>
        </Card>
      )}

      {step === "password" && (
        <Card>
          <CardHeader><CardTitle>Two-Factor Authentication</CardTitle><CardDescription>Enter your 2FA password</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handlePassword} disabled={!password || loading}>{loading ? "Authenticating..." : "Authenticate"}</Button>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardHeader><CardTitle>Authentication Complete</CardTitle><CardDescription>Session has been created successfully</CardDescription></CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/dashboard/tg-client")}>Go to Sessions</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
