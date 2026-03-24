"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

const STEP_LABELS: Record<Step, string> = {
  platform: "Platform",
  credentials: "Setup",
  verification: "Verify",
  health: "Health Check",
  scope: "Scope",
};

export function AuthSheet({ open, onOpenChange, onComplete }: AuthSheetProps) {
  const [step, setStep] = useState<Step>("platform");
  const [state, setState] = useState<Partial<AuthState>>({});

  const steps: Step[] = ["platform", "credentials", "verification", "health", "scope"];
  const currentIndex = steps.indexOf(step);

  function handleClose(isOpen: boolean) {
    if (!isOpen) {
      setStep("platform");
      setState({});
    }
    onOpenChange(isOpen);
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-[440px] overflow-y-auto sm:max-w-[440px]">
        <SheetHeader>
          <SheetTitle>New Connection</SheetTitle>
          <SheetDescription className="sr-only">
            Set up a new platform connection
          </SheetDescription>
        </SheetHeader>

        {/* Breadcrumb + Start over */}
        <div className="mb-6 flex items-center justify-between">
          <nav className="flex gap-1.5 text-xs text-muted-foreground">
            {steps.map((s, i) => (
              <span key={s} className="flex items-center gap-1.5">
                {i > 0 && <span>›</span>}
                <span className={i === currentIndex ? "text-foreground" : ""}>
                  {STEP_LABELS[s]}
                </span>
              </span>
            ))}
          </nav>
          {currentIndex > 0 && (
            <button
              type="button"
              onClick={() => {
                setStep("platform");
                setState({});
              }}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Start over
            </button>
          )}
        </div>

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
              setState((prev) => ({ ...prev, name, connectionId, sessionId, phoneNumber }));
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
      </SheetContent>
    </Sheet>
  );
}
