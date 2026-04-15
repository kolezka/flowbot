"use client";

import { memo } from "react";

const NOTE_COLORS: Record<string, string> = {
  yellow: "bg-yellow-200 dark:bg-yellow-900",
  blue: "bg-blue-200 dark:bg-blue-900",
  green: "bg-green-200 dark:bg-green-900",
  pink: "bg-pink-200 dark:bg-pink-900",
  orange: "bg-orange-200 dark:bg-orange-900",
};

interface StickyNoteData {
  config?: {
    text?: string;
    color?: string;
  };
}

export const StickyNote = memo(({ data }: { data: StickyNoteData }) => {
  const colorName = data.config?.color ?? "yellow";
  const colorClass = NOTE_COLORS[colorName] ?? NOTE_COLORS.yellow;

  return (
    <div
      className={`rounded-md p-3 shadow-sm min-w-[120px] min-h-[80px] max-w-[250px] ${colorClass}`}
    >
      <div className="whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-200">
        {data.config?.text ?? "Note"}
      </div>
    </div>
  );
});
StickyNote.displayName = "StickyNote";
