"use client";

import { useEffect, useState } from "react";
import { api, Broadcast } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function BroadcastPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Create form state
  const [text, setText] = useState("");
  const [targetChatIds, setTargetChatIds] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editTargetChatIds, setEditTargetChatIds] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const pageSize = 10;

  useEffect(() => {
    loadBroadcasts();
  }, [page]);

  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => setActionFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionFeedback]);

  const loadBroadcasts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getBroadcasts(page, pageSize);
      setBroadcasts(data.data);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || "Failed to load broadcasts");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !targetChatIds.trim()) return;

    setSubmitting(true);
    try {
      const chatIds = targetChatIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      await api.createBroadcast({ text: text.trim(), targetChatIds: chatIds });
      setText("");
      setTargetChatIds("");
      setActionFeedback("Broadcast created successfully");
      loadBroadcasts();
    } catch (err: any) {
      alert(err.message || "Failed to create broadcast");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (broadcast: Broadcast) => {
    setEditingId(broadcast.id);
    setEditText(broadcast.text);
    setEditTargetChatIds(broadcast.targetChatIds.join(", "));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
    setEditTargetChatIds("");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editText.trim() || !editTargetChatIds.trim()) return;

    setEditSubmitting(true);
    try {
      const chatIds = editTargetChatIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      await api.updateBroadcast(editingId, {
        text: editText.trim(),
        targetChatIds: chatIds,
      });
      cancelEdit();
      setActionFeedback("Broadcast updated successfully");
      loadBroadcasts();
    } catch (err: any) {
      alert(err.message || "Failed to update broadcast");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this broadcast?")) return;

    try {
      await api.deleteBroadcast(id);
      setActionFeedback("Broadcast deleted successfully");
      loadBroadcasts();
    } catch (err: any) {
      alert(err.message || "Failed to delete broadcast");
    }
  };

  const handleRetry = async (id: string) => {
    if (!window.confirm("Retry this broadcast? A new pending broadcast will be created.")) return;

    try {
      await api.retryBroadcast(id);
      setActionFeedback("Broadcast retried - new pending broadcast created");
      loadBroadcasts();
    } catch (err: any) {
      alert(err.message || "Failed to retry broadcast");
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default" as const;
      case "pending":
        return "secondary" as const;
      case "failed":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {actionFeedback && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200">
          {actionFeedback}
        </div>
      )}

      {/* Create Broadcast Form */}
      <Card>
        <CardHeader>
          <CardTitle>New Broadcast</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Message Text</label>
              <textarea
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Enter broadcast message..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Target Chat IDs (comma-separated)
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="-1001234567890, -1009876543210"
                value={targetChatIds}
                onChange={(e) => setTargetChatIds(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Broadcast"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Broadcast List */}
      <Card>
        <CardHeader>
          <CardTitle>Broadcasts</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 p-4 text-destructive">
              {error}
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Text</TableHead>
                  <TableHead>Targets</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : broadcasts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No broadcasts found
                    </TableCell>
                  </TableRow>
                ) : (
                  broadcasts.map((broadcast) => (
                    <TableRow key={broadcast.id}>
                      <TableCell className="font-mono text-xs">
                        {broadcast.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        {editingId === broadcast.id ? (
                          <form onSubmit={handleEditSubmit} className="space-y-2">
                            <textarea
                              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              required
                            />
                            <input
                              type="text"
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              placeholder="Chat IDs (comma-separated)"
                              value={editTargetChatIds}
                              onChange={(e) => setEditTargetChatIds(e.target.value)}
                              required
                            />
                            <div className="flex gap-2">
                              <Button type="submit" size="sm" disabled={editSubmitting}>
                                {editSubmitting ? "Saving..." : "Save"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={cancelEdit}
                                disabled={editSubmitting}
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        ) : (
                          <div className="max-w-[300px] truncate">
                            {broadcast.text}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{broadcast.targetChatIds.length} groups</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(broadcast.status)}>
                          {broadcast.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(broadcast.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {editingId !== broadcast.id && (
                          <div className="flex gap-1">
                            {broadcast.status === "pending" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEdit(broadcast)}
                              >
                                Edit
                              </Button>
                            )}
                            {broadcast.status === "failed" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRetry(broadcast.id)}
                              >
                                Retry
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(broadcast.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * pageSize + 1} to{" "}
                {Math.min(page * pageSize, total)} of {total} broadcasts
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
