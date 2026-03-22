"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PlatformSelect } from "./auth-steps/PlatformSelect";
import { NameAndCredentials } from "./auth-steps/NameAndCredentials";

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
        </SheetHeader>

        {/* Breadcrumb */}
        <nav className="mb-6 flex gap-1.5 text-xs text-muted-foreground">
          {steps.map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              {i > 0 && <span>›</span>}
              <span className={i === currentIndex ? "text-foreground" : ""}>
                {STEP_LABELS[s]}
              </span>
            </span>
          ))}
        </nav>

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
            onSubmit={({ name, connectionId, sessionId }) => {
              setState((prev) => ({ ...prev, name, connectionId, sessionId }));
              const skipVerification =
                state.connectionType === "bot_token" ||
                state.platform === "discord";
              setStep(skipVerification ? "health" : "verification");
            }}
          />
        )}
        {/* Verification, HealthCheck, and ScopeManager steps will be added in Tasks 4, 5, and 8 */}
        {step === "verification" && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Verification step — coming in Task 4
          </div>
        )}
        {step === "health" && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Health check — coming in Task 5
          </div>
        )}
        {step === "scope" && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Scope manager — coming in Task 8
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
