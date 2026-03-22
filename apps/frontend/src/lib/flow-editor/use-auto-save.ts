import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "saved" | "unsaved" | "saving" | "error";

interface UseAutoSaveOptions {
  flowId: string;
  nodesJson: unknown;
  edgesJson: unknown;
  onSave: (data: { nodesJson: unknown; edgesJson: unknown }) => Promise<void>;
  debounceMs?: number;
}

export function useAutoSave({
  flowId,
  nodesJson,
  edgesJson,
  onSave,
  debounceMs = 10000,
}: UseAutoSaveOptions) {
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestRef = useRef({ nodesJson, edgesJson });
  const lastJsonRef = useRef<string>("");

  // Keep latest values in ref to avoid stale closure
  latestRef.current = { nodesJson, edgesJson };

  const currentJson = JSON.stringify({ nodesJson, edgesJson });

  useEffect(() => {
    if (currentJson !== lastJsonRef.current) {
      if (lastJsonRef.current !== "") {
        // Only mark unsaved if we had a previous value (not initial load)
        setSaveState("unsaved");
      }

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        setSaveState("saving");
        try {
          await onSave(latestRef.current);
          lastJsonRef.current = JSON.stringify(latestRef.current);
          setSaveState("saved");
          setLastSaved(new Date());
        } catch {
          setSaveState("error");
        }
      }, debounceMs);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentJson, debounceMs, onSave]);

  const saveNow = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState("saving");
    try {
      await onSave(latestRef.current);
      lastJsonRef.current = JSON.stringify(latestRef.current);
      setSaveState("saved");
      setLastSaved(new Date());
    } catch {
      setSaveState("error");
    }
  }, [onSave]);

  return { saveState, lastSaved, saveNow };
}
