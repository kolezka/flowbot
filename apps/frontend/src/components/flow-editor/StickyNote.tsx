"use client";

import { memo } from "react";

const NOTE_COLORS: Record<string, string> = {
  yellow: "#fef08a",
  blue: "#bfdbfe",
  green: "#bbf7d0",
  pink: "#fbcfe8",
  orange: "#fed7aa",
};

interface StickyNoteData {
  config?: {
    text?: string;
    color?: string;
  };
}

export const StickyNote = memo(({ data }: { data: StickyNoteData }) => {
  const colorName = data.config?.color ?? "yellow";
  const bgColor = NOTE_COLORS[colorName] ?? NOTE_COLORS.yellow;

  return (
    <div
      className="rounded-md p-3 shadow-sm min-w-[120px] min-h-[80px] max-w-[250px]"
      style={{ backgroundColor: bgColor }}
    >
      <div className="whitespace-pre-wrap text-xs text-gray-700">
        {data.config?.text ?? "Note"}
      </div>
    </div>
  );
});
StickyNote.displayName = "StickyNote";
