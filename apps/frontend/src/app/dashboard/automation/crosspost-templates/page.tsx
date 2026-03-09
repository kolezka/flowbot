"use client";

import { useEffect, useState, useCallback } from "react";
import {
  api,
  CrossPostTemplate,
  CrossPostTemplateListResponse,
  ManagedGroup,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CrossPostTemplatesPage() {
  const [templates, setTemplates] = useState<CrossPostTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Groups for multi-select
  const [groups, setGroups] = useState<ManagedGroup[]>([]);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createMessage, setCreateMessage] = useState("");
  const [createTargetChatIds, setCreateTargetChatIds] = useState<string[]>([]);
  const [createActive, setCreateActive] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit form
  const [editingTemplate, setEditingTemplate] =
    useState<CrossPostTemplate | null>(null);
  const [editName, setEditName] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editTargetChatIds, setEditTargetChatIds] = useState<string[]>([]);
  const [editActive, setEditActive] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    try {
      const res = await api.getGroups({ limit: 100 });
      setGroups(res.data);
    } catch {
      // Groups are optional for display
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: CrossPostTemplateListResponse =
        await api.getCrossPostTemplates({ page, limit: 20 });
      setTemplates(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load cross-post templates";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const toggleGroupSelection = (
    chatId: string,
    selected: string[],
    setSelected: (ids: string[]) => void
  ) => {
    if (selected.includes(chatId)) {
      setSelected(selected.filter((id) => id !== chatId));
    } else {
      setSelected([...selected, chatId]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !createMessage.trim()) return;

    setCreating(true);
    setCreateError(null);
    try {
      await api.createCrossPostTemplate({
        name: createName.trim(),
        messageText: createMessage.trim(),
        targetChatIds: createTargetChatIds,
        isActive: createActive,
      });
      setCreateName("");
      setCreateMessage("");
      setCreateTargetChatIds([]);
      setCreateActive(true);
      setShowCreate(false);
      loadTemplates();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create template";
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleEditClick = (template: CrossPostTemplate) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditMessage(template.messageText);
    setEditTargetChatIds([...template.targetChatIds]);
    setEditActive(template.isActive);
    setEditError(null);
    setShowCreate(false);
  };

  const handleEditCancel = () => {
    setEditingTemplate(null);
    setEditError(null);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate || !editName.trim() || !editMessage.trim()) return;

    setEditing(true);
    setEditError(null);
    try {
      await api.updateCrossPostTemplate(editingTemplate.id, {
        name: editName.trim(),
        messageText: editMessage.trim(),
        targetChatIds: editTargetChatIds,
        isActive: editActive,
      });
      setEditingTemplate(null);
      loadTemplates();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update template";
      setEditError(message);
    } finally {
      setEditing(false);
    }
  };

  const handleToggleActive = async (template: CrossPostTemplate) => {
    try {
      await api.updateCrossPostTemplate(template.id, {
        isActive: !template.isActive,
      });
      loadTemplates();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to toggle template";
      setError(message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteCrossPostTemplate(id);
      setDeletingId(null);
      loadTemplates();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to delete template";
      setError(message);
      setDeletingId(null);
    }
  };

  const groupNameMap = new Map(
    groups.map((g) => [g.chatId, g.title || g.chatId])
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cross-post Templates</h2>
          <p className="text-sm text-muted-foreground">
            Manage message templates for cross-posting across groups.
          </p>
        </div>
        <Button
          onClick={() => {
            setShowCreate(!showCreate);
            setEditingTemplate(null);
          }}
        >
          {showCreate ? "Cancel" : "New Template"}
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create New Template</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium" htmlFor="create-name">
                  Name
                </label>
                <Input
                  id="create-name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Template name..."
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="create-message">
                  Message
                </label>
                <textarea
                  id="create-message"
                  value={createMessage}
                  onChange={(e) => setCreateMessage(e.target.value)}
                  rows={4}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Enter your message template..."
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Target Groups</label>
                <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-input p-2 space-y-1">
                  {groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No groups available.
                    </p>
                  ) : (
                    groups.map((g) => (
                      <label
                        key={g.chatId}
                        className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={createTargetChatIds.includes(g.chatId)}
                          onChange={() =>
                            toggleGroupSelection(
                              g.chatId,
                              createTargetChatIds,
                              setCreateTargetChatIds
                            )
                          }
                          className="rounded"
                        />
                        {g.title || g.chatId}
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createActive}
                    onChange={(e) => setCreateActive(e.target.checked)}
                    className="rounded"
                  />
                  Active
                </label>
              </div>
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
              <Button
                type="submit"
                disabled={creating || !createName.trim() || !createMessage.trim()}
              >
                {creating ? "Creating..." : "Create Template"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Edit Form */}
      {editingTemplate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit Template</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div>
                <label className="text-sm font-medium" htmlFor="edit-name">
                  Name
                </label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Template name..."
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="edit-message">
                  Message
                </label>
                <textarea
                  id="edit-message"
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  rows={4}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Enter your message template..."
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Target Groups</label>
                <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-input p-2 space-y-1">
                  {groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No groups available.
                    </p>
                  ) : (
                    groups.map((g) => (
                      <label
                        key={g.chatId}
                        className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={editTargetChatIds.includes(g.chatId)}
                          onChange={() =>
                            toggleGroupSelection(
                              g.chatId,
                              editTargetChatIds,
                              setEditTargetChatIds
                            )
                          }
                          className="rounded"
                        />
                        {g.title || g.chatId}
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="rounded"
                  />
                  Active
                </label>
              </div>
              {editError && (
                <p className="text-sm text-destructive">{editError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={editing || !editName.trim() || !editMessage.trim()}
                >
                  {editing ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleEditCancel}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          {total} template{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Templates Table */}
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
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No cross-post templates yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Message</th>
                  <th className="py-2 font-medium">Target Groups</th>
                  <th className="py-2 font-medium">Active</th>
                  <th className="py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((tpl) => (
                  <tr
                    key={tpl.id}
                    className="border-b cursor-pointer hover:bg-accent/30"
                    onClick={() => handleEditClick(tpl)}
                  >
                    <td className="py-2 font-medium">{tpl.name}</td>
                    <td
                      className="py-2 max-w-xs truncate"
                      title={tpl.messageText}
                    >
                      {tpl.messageText.length > 60
                        ? tpl.messageText.slice(0, 60) + "..."
                        : tpl.messageText}
                    </td>
                    <td className="py-2">
                      <Badge variant="secondary">
                        {tpl.targetChatIds.length} group
                        {tpl.targetChatIds.length !== 1 ? "s" : ""}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <Badge
                        variant={tpl.isActive ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(tpl);
                        }}
                      >
                        {tpl.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      {deletingId === tpl.id ? (
                        <span
                          className="flex items-center justify-end gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-xs text-muted-foreground">
                            Delete?
                          </span>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(tpl.id)}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(tpl.id);
                          }}
                        >
                          Delete
                        </Button>
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
