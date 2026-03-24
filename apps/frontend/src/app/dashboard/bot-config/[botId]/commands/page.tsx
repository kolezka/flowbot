"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { BotCommand } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ArrowLeft, ArrowUp, ArrowDown, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function CommandsEditorPage() {
  const params = useParams();
  const botId = params.botId as string;
  const [commands, setCommands] = useState<BotCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCommand, setEditCommand] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCommand, setNewCommand] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BotCommand | null>(null);

  const loadCommands = useCallback(async () => {
    try {
      const data = await api.getBotCommands(botId);
      setCommands(data.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load commands");
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    loadCommands();
  }, [loadCommands]);

  const handleToggle = async (cmd: BotCommand) => {
    try {
      const updated = await api.updateBotCommand(botId, cmd.id, { isEnabled: !cmd.isEnabled });
      setCommands((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast.success(`Command /${cmd.command} ${updated.isEnabled ? "enabled" : "disabled"}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to toggle command");
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newOrder = [...commands];
    const temp = newOrder[index - 1]!;
    newOrder[index - 1] = newOrder[index]!;
    newOrder[index] = temp;
    setCommands(newOrder);
    try {
      await api.reorderBotCommands(botId, newOrder.map((c) => c.id));
    } catch (err) {
      console.error(err);
      toast.error("Failed to reorder commands");
      loadCommands();
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === commands.length - 1) return;
    const newOrder = [...commands];
    const temp = newOrder[index + 1]!;
    newOrder[index + 1] = newOrder[index]!;
    newOrder[index] = temp;
    setCommands(newOrder);
    try {
      await api.reorderBotCommands(botId, newOrder.map((c) => c.id));
    } catch (err) {
      console.error(err);
      toast.error("Failed to reorder commands");
      loadCommands();
    }
  };

  const handleAdd = async () => {
    if (!newCommand.trim()) return;
    try {
      const created = await api.createBotCommand(botId, {
        command: newCommand.replace(/^\//, ""),
        description: newDescription || undefined,
      });
      setCommands((prev) => [...prev, created]);
      setNewCommand("");
      setNewDescription("");
      setShowAddForm(false);
      toast.success(`Command /${created.command} created`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create command");
    }
  };

  const startEdit = (cmd: BotCommand) => {
    setEditingId(cmd.id);
    setEditCommand(cmd.command);
    setEditDescription(cmd.description || "");
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      const updated = await api.updateBotCommand(botId, editingId, {
        description: editDescription || undefined,
      });
      setCommands((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingId(null);
      toast.success(`Command /${updated.command} updated`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update command");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteBotCommand(botId, deleteTarget.id);
      setCommands((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success(`Command /${deleteTarget.command} deleted`);
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete command");
    }
  };

  if (loading) return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-48" />
      </div>
      <SkeletonTable rows={5} cols={3} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/bot-config/${botId}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Commands</h1>
          <p className="text-sm text-muted-foreground">Manage bot commands and their order</p>
        </div>
        <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
          <Plus className="mr-2 h-4 w-4" />Add Command
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader><CardTitle>New Command</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="new-command">Command</Label>
                <Input
                  id="new-command"
                  placeholder="start"
                  value={newCommand}
                  onChange={(e) => setNewCommand(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="new-desc">Description</Label>
                <Input
                  id="new-desc"
                  placeholder="Start the bot"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAdd} disabled={!newCommand.trim()}>
                  <Check className="mr-2 h-4 w-4" />Save
                </Button>
                <Button variant="outline" onClick={() => { setShowAddForm(false); setNewCommand(""); setNewDescription(""); }}>
                  <X className="mr-2 h-4 w-4" />Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {commands.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No commands configured. Add your first command above.</p>
          ) : (
            <div className="divide-y divide-border">
              {commands.map((cmd, index) => (
                <div key={cmd.id} className="flex items-center gap-3 p-4">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveUp(index)} disabled={index === 0}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveDown(index)} disabled={index === commands.length - 1}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {editingId === cmd.id ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <span className="font-mono text-sm">/{editCommand}</span>
                        <Input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Description"
                          className="flex-1"
                        />
                        <div className="flex gap-1">
                          <Button size="sm" onClick={handleSaveEdit}><Check className="h-3 w-3" /></Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="font-mono text-sm">/{cmd.command}</span>
                        {cmd.description && <span className="ml-2 text-sm text-muted-foreground">{cmd.description}</span>}
                      </div>
                    )}
                  </div>

                  {/* Controls */}
                  {editingId !== cmd.id && (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={cmd.isEnabled}
                        onCheckedChange={() => handleToggle(cmd)}
                      />
                      <Badge variant={cmd.isEnabled ? "default" : "secondary"} className="w-16 justify-center text-xs">
                        {cmd.isEnabled ? "On" : "Off"}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(cmd)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(cmd)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Command"
        description={`Are you sure you want to delete the command "/${deleteTarget?.command}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
