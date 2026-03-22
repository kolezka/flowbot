"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Search, CheckCircle2, AlertCircle, History, Play, Save, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CanvasToolbarProps {
  flowName: string;
  onNameChange: (name: string) => void;
  version: number;
  saveState: "saved" | "unsaved" | "saving" | "error";
  lastSaved: Date | null;
  onSaveDraft: () => void;
  onPublish: () => void;
  onTestRun: () => void;
  onValidate: () => void;
  onOpenHistory: () => void;
  onOpenCommandPalette: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 5) return "just now";
  if (diffSecs < 60) return `${diffSecs}s ago`;

  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString();
}

// ---------------------------------------------------------------------------
// SaveStateIndicator
// ---------------------------------------------------------------------------

interface SaveStateIndicatorProps {
  saveState: CanvasToolbarProps["saveState"];
  lastSaved: Date | null;
}

function SaveStateIndicator({ saveState, lastSaved }: SaveStateIndicatorProps) {
  const [, forceRender] = useState(0);

  // Re-render every 10s so the relative time stays fresh
  useEffect(() => {
    if (saveState !== "saved" || !lastSaved) return;
    const id = setInterval(() => forceRender((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, [saveState, lastSaved]);

  if (saveState === "unsaved") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-500">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
        Unsaved
      </span>
    );
  }

  if (saveState === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-blue-500">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border border-blue-500 border-t-transparent" />
        Saving...
      </span>
    );
  }

  if (saveState === "saved") {
    const timeLabel = lastSaved ? getRelativeTime(lastSaved) : null;
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3" />
        {timeLabel ? `Saved ${timeLabel}` : "Saved"}
      </span>
    );
  }

  if (saveState === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-500">
        <AlertCircle className="h-3 w-3" />
        Save failed
      </span>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// FlowNameInput — inline editable
// ---------------------------------------------------------------------------

interface FlowNameInputProps {
  value: string;
  onChange: (name: string) => void;
}

function FlowNameInput({ value, onChange }: FlowNameInputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep draft in sync when external value changes (e.g. after save)
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const startEditing = useCallback(() => {
    setDraft(value);
    setEditing(true);
  }, [value]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onChange(trimmed);
    } else {
      setDraft(value);
    }
    setEditing(false);
  }, [draft, value, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        setDraft(value);
        setEditing(false);
      }
    },
    [commit, value],
  );

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="h-7 max-w-[240px] rounded border border-input bg-background px-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label="Flow name"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className="h-7 max-w-[240px] truncate rounded px-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
      title="Click to rename"
      aria-label={`Flow name: ${value}. Click to edit.`}
    >
      {value}
    </button>
  );
}

// ---------------------------------------------------------------------------
// CommandPaletteButton — looks like a search input but is a button
// ---------------------------------------------------------------------------

interface CommandPaletteButtonProps {
  onClick: () => void;
}

function CommandPaletteButton({ onClick }: CommandPaletteButtonProps) {
  // Listen for ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onClick();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClick]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 w-52 items-center gap-2 rounded-md border border-input bg-muted/50",
        "px-3 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        "focus:outline-none focus:ring-1 focus:ring-ring",
      )}
      aria-label="Open command palette (⌘K)"
    >
      <Search className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 text-left">Search actions...</span>
      <kbd className="rounded bg-background px-1 py-0.5 font-mono text-[10px] leading-none text-muted-foreground shadow-sm border border-border">
        ⌘K
      </kbd>
    </button>
  );
}

// ---------------------------------------------------------------------------
// CanvasToolbar
// ---------------------------------------------------------------------------

export function CanvasToolbar({
  flowName,
  onNameChange,
  version,
  saveState,
  lastSaved,
  onSaveDraft,
  onPublish,
  onTestRun,
  onValidate,
  onOpenHistory,
  onOpenCommandPalette,
  onBack,
}: CanvasToolbarProps) {
  return (
    <header
      className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-3"
      role="toolbar"
      aria-label="Flow editor toolbar"
    >
      {/* ── Left section ─────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* Back link */}
        <Link
          href="/dashboard/flows"
          onClick={onBack}
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground",
            "transition-colors hover:bg-accent hover:text-foreground",
          )}
          aria-label="Back to flows list"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        {/* Flow name (inline editable) */}
        <FlowNameInput value={flowName} onChange={onNameChange} />

        {/* Version badge */}
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          v{version}
        </span>

        {/* Save state indicator */}
        <SaveStateIndicator saveState={saveState} lastSaved={lastSaved} />
      </div>

      {/* ── Center / right section ───────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Command palette trigger */}
        <CommandPaletteButton onClick={onOpenCommandPalette} />

        {/* Validate */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onValidate}
          className="h-8 gap-1.5 px-2.5 text-xs"
          title="Validate flow"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Validate
        </Button>

        {/* History */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenHistory}
          className="h-8 gap-1.5 px-2.5 text-xs"
          title="View version history"
        >
          <History className="h-3.5 w-3.5" />
          History
        </Button>

        {/* Divider */}
        <div className="h-5 w-px bg-border" role="separator" />

        {/* Save Draft */}
        <Button
          variant="outline"
          size="sm"
          onClick={onSaveDraft}
          disabled={saveState === "saving"}
          className="h-8 gap-1.5 px-3 text-xs"
        >
          <Save className="h-3.5 w-3.5" />
          Save Draft
        </Button>

        {/* Test Run */}
        <Button
          size="sm"
          onClick={onTestRun}
          className="h-8 gap-1.5 bg-green-600 px-3 text-xs text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          Test Run
        </Button>
      </div>
    </header>
  );
}
