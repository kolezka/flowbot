"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PlatformSelect } from "./auth-steps/PlatformSelect";
import { NameAndCredentials } from "./auth-steps/NameAndCredentials";
import { Verification } from "./auth-steps/Verification";
import { HealthCheck } from "./auth-steps/HealthCheck";
import { ScopeManager } from "./ScopeManager";

type Step = "platform" | "credentials" | "verification" | "health" | "scope";

interface AuthSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

interface AuthState {
  platform: string;
  connectionType: string;
  name: string;
  connectionId: string;
  sessionId: string;
  /** Phone number for MTProto verification — captured from the credentials step */
  phoneNumber?: string;
}

const STEPS: { key: Step; label: string; number: string }[] = [
  { key: "platform", label: "Platform", number: "1" },
  { key: "credentials", label: "Setup", number: "2" },
  { key: "verification", label: "Verify", number: "3" },
  { key: "health", label: "Health", number: "4" },
  { key: "scope", label: "Scope", number: "5" },
];

export function AuthSheet({ open, onOpenChange, onComplete }: AuthSheetProps) {
  const [step, setStep] = useState<Step>("platform");
  const [state, setState] = useState<Partial<AuthState>>({});

  const currentIndex = STEPS.findIndex((s) => s.key === step);

  function handleClose(isOpen: boolean) {
    if (!isOpen && Object.keys(state).length > 0 && step !== "platform") {
      if (!confirm("Discard this connection setup? Your progress will be lost."))
        return;
    }
    if (!isOpen) {
      setStep("platform");
      setState({});
    }
    onOpenChange(isOpen);
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="flex w-[480px] flex-col gap-0 overflow-y-auto bg-popover sm:max-w-[480px]">
        {/* ─── Header ─── */}
        <SheetHeader className="shrink-0 pb-1">
          <SheetTitle className="text-lg font-semibold tracking-tight">
            New Connection
          </SheetTitle>
          <SheetDescription className="sr-only">
            Set up a new platform connection
          </SheetDescription>
        </SheetHeader>

        {/* ─── Step indicator ─── */}
        <div className="shrink-0 pb-6">
          <div className="flex items-center justify-between">
            <nav className="flex items-center gap-1" aria-label="Wizard steps">
              {STEPS.map((s, i) => {
                const isActive = i === currentIndex;
                const isDone = i < currentIndex;
                return (
                  <span key={s.key} className="flex items-center gap-1">
                    {i > 0 && (
                      <span
                        className={`mx-0.5 h-px w-3 ${
                          isDone ? "bg-primary/60" : "bg-border"
                        }`}
                      />
                    )}
                    <span
                      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full text-[10px] font-semibold leading-none transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : isDone
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isDone ? "✓" : s.number}
                    </span>
                    <span
                      className={`text-xs transition-colors ${
                        isActive
                          ? "font-medium text-foreground"
                          : isDone
                            ? "text-primary/70"
                            : "text-muted-foreground"
                      }`}
                    >
                      {s.label}
                    </span>
                  </span>
                );
              })}
            </nav>
            {currentIndex > 0 && (
              <button
                type="button"
                onClick={() => {
                  setStep("platform");
                  setState({});
                }}
                className="ml-2 shrink-0 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Start over
              </button>
            )}
          </div>
        </div>

        {/* ─── Step content ─── */}
        <div className="flex-1 min-h-0">
          {step === "platform" && (
            <PlatformSelect
              onSelect={(platform, connectionType) => {
                setState((prev) => ({ ...prev, platform, connectionType }));
                setStep("credentials");
              }}
            />
          )}
          {step === "credentials" && (
            <NameAndCredentials
              platform={state.platform!}
              connectionType={state.connectionType!}
              onBack={() => setStep("platform")}
              onSubmit={({ name, connectionId, sessionId, phoneNumber }) => {
                setState((prev) => ({
                  ...prev,
                  name,
                  connectionId,
                  sessionId,
                  phoneNumber,
                }));
                const skipVerification =
                  state.connectionType === "bot_token" ||
                  state.platform === "discord";
                setStep(skipVerification ? "health" : "verification");
              }}
            />
          )}
          {step === "verification" && (
            <Verification
              connectionId={state.connectionId!}
              sessionId={state.sessionId!}
              platform={state.platform!}
              connectionType={state.connectionType!}
              phoneNumber={state.phoneNumber}
              onBack={() => setStep("credentials")}
              onComplete={() => setStep("health")}
            />
          )}
          {step === "health" && (
            <HealthCheck
              connectionId={state.connectionId!}
              onComplete={() => setStep("scope")}
            />
          )}
          {step === "scope" && (
            <ScopeManager
              connectionId={state.connectionId!}
              onComplete={onComplete}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
