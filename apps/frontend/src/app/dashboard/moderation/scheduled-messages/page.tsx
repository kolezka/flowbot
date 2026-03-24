"use client";

import { useEffect, useState, useCallback } from "react";
import {
  api,
  ScheduledMessage,
  ScheduledMessageListResponse,
  ManagedGroup,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Tab = "upcoming" | "history";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDefaultSendAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setMinutes(0, 0, 0);
  // Format as datetime-local value: YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ScheduledMessagesPage() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Groups for filter and create form
  const [groups, setGroups] = useState<ManagedGroup[]>([]);
  const [filterGroupId, setFilterGroupId] = useState<string>("");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createGroupId, setCreateGroupId] = useState("");
  const [createText, setCreateText] = useState("");
  const [createSendAt, setCreateSendAt] = useState(getDefaultSendAt());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    try {
      const res = await api.getGroups({ limit: 100 });
      setGroups(res.data);
      if (res.data.length > 0 && !createGroupId) {
        setCreateGroupId(res.data[0]!.id);
      }
    } catch {
      // Groups are optional for display
    }
  }, [createGroupId]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sent = tab === "history";
      const res: ScheduledMessageListResponse =
        await api.getScheduledMessages({
          page,
          limit: 20,
          sent,
          groupId: filterGroupId || undefined,
        });
      setMessages(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load scheduled messages";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [tab, page, filterGroupId]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Reset page when tab or filter changes
  useEffect(() => {
    setPage(1);
  }, [tab, filterGroupId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createGroupId || !createText.trim() || !createSendAt) return;

    setCreating(true);
    setCreateError(null);
    try {
      await api.createScheduledMessage({
        groupId: createGroupId,
        text: createText.trim(),
        sendAt: new Date(createSendAt).toISOString(),
      });
      setCreateText("");
      setCreateSendAt(getDefaultSendAt());
      setShowCreate(false);
      setTab("upcoming");
      loadMessages();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create message";
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteScheduledMessage(id);
      setDeletingId(null);
      loadMessages();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to delete message";
      setError(message);
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scheduled Messages</h1>
          <p className="text-sm text-muted-foreground">
            Manage scheduled messages across all groups.
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "New Message"}
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schedule New Message</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium" htmlFor="create-group">
                  Group
                </label>
                <select
                  id="create-group"
                  value={createGroupId}
                  onChange={(e) => setCreateGroupId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title || g.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="create-text">
                  Message
                </label>
                <textarea
                  id="create-text"
                  value={createText}
                  onChange={(e) => setCreateText(e.target.value)}
                  rows={4}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Enter your message..."
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="create-send-at">
                  Send At
                </label>
                <Input
                  id="create-send-at"
                  type="datetime-local"
                  value={createSendAt}
                  onChange={(e) => setCreateSendAt(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
              <Button type="submit" disabled={creating || !createText.trim()}>
                {creating ? "Scheduling..." : "Schedule Message"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tabs + Filter */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1">
          <Button
            variant={tab === "upcoming" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("upcoming")}
          >
            Upcoming
          </Button>
          <Button
            variant={tab === "history" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("history")}
          >
            History
          </Button>
        </div>
        <select
          value={filterGroupId}
          onChange={(e) => setFilterGroupId(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All Groups</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title || g.id}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">
          {total} message{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Messages Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : error ? (
            <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
              {error}
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {tab === "upcoming"
                ? "No upcoming scheduled messages."
                : "No message history."}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 font-medium">Group</th>
                  <th className="py-2 font-medium">Message</th>
                  <th className="py-2 font-medium">Send At</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg) => (
                  <tr key={msg.id} className="border-b">
                    <td className="py-2">{msg.groupTitle || msg.groupId}</td>
                    <td className="py-2 max-w-xs truncate" title={msg.text}>
                      {msg.text.length > 60
                        ? msg.text.slice(0, 60) + "..."
                        : msg.text}
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      {formatDateTime(msg.sendAt)}
                    </td>
                    <td className="py-2">
                      {msg.sent ? (
                        <Badge variant="secondary">Sent</Badge>
                      ) : (
                        <Badge>Pending</Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {!msg.sent && (
                        <>
                          {deletingId === msg.id ? (
                            <span className="flex items-center justify-end gap-2">
                              <span className="text-xs text-muted-foreground">
                                Delete?
                              </span>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(msg.id)}
                              >
                                Yes
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeletingId(null)}
                              >
                                No
                              </Button>
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletingId(msg.id)}
                            >
                              Cancel
                            </Button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
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
