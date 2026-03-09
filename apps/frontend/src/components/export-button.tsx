"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ExportButtonProps {
  endpoint: string;
  filename: string;
  filters?: Record<string, string | undefined>;
}

export function ExportButton({ endpoint, filename, filters }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<"csv" | "json">("csv");

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("format", format);
      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          if (value) {
            params.set(key, value);
          }
        }
      }
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
      const url = `${baseUrl}${endpoint}?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${filename}.${format}`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <select
        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
        value={format}
        onChange={(e) => setFormat(e.target.value as "csv" | "json")}
      >
        <option value="csv">CSV</option>
        <option value="json">JSON</option>
      </select>
      <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
        {loading ? "Exporting..." : "Export"}
      </Button>
    </div>
  );
}
