"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { BotResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, X, Check, Eye } from "lucide-react";

function renderTelegramMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Bold: **text** or *text* (Telegram uses *text* for bold in some contexts)
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic: __text__ or _text_
  html = html.replace(/__(.+?)__/g, "<em>$1</em>");
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<strong>$1</strong>");
  html = html.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, "<em>$1</em>");
  // Code: `text`
  html = html.replace(/`(.+?)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-sm font-mono">$1</code>');
  // Newlines
  html = html.replace(/\n/g, "<br />");
  return html;
}

export default function ResponsesEditorPage() {
  const params = useParams();
  const botId = params.botId as string;
  const [responses, setResponses] = useState<BotResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLocale, setActiveLocale] = useState("en");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLocale, setNewLocale] = useState("en");
  const [newText, setNewText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BotResponse | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const loadResponses = useCallback(async () => {
    try {
      const data = await api.getBotResponses(botId);
      setResponses(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load responses");
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    loadResponses();
  }, [loadResponses]);

  const locales = useMemo(() => {
    const set = new Set(responses.map((r) => r.locale));
    if (set.size === 0) set.add("en");
    return Array.from(set).sort();
  }, [responses]);

  const filteredResponses = useMemo(
    () => responses.filter((r) => r.locale === activeLocale),
    [responses, activeLocale]
  );

  const handleAdd = async () => {
    if (!newKey.trim() || !newText.trim()) return;
    try {
      const created = await api.createBotResponse(botId, {
        key: newKey,
        locale: newLocale,
        text: newText,
      });
      setResponses((prev) => [...prev, created]);
      setNewKey("");
      setNewText("");
      setNewLocale(activeLocale);
      setShowAddForm(false);
      toast.success("Response created");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create response");
    }
  };

  const startEdit = (resp: BotResponse) => {
    setEditingId(resp.id);
    setEditText(resp.text);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      const updated = await api.updateBotResponse(botId, editingId, { text: editText });
      setResponses((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditingId(null);
      toast.success("Response updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update response");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteBotResponse(botId, deleteTarget.id);
      setResponses((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("Response deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete response");
    }
  };

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="h-64 bg-muted rounded-xl" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/bot-config/${botId}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Responses</h1>
          <p className="text-sm text-muted-foreground">Manage bot response templates by locale</p>
        </div>
        <Button onClick={() => { setShowAddForm(true); setNewLocale(activeLocale); }} disabled={showAddForm}>
          <Plus className="mr-2 h-4 w-4" />Add Response
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader><CardTitle>New Response</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="new-key">Key</Label>
                  <Input id="new-key" placeholder="welcome_message" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
                </div>
                <div className="w-32 space-y-2">
                  <Label htmlFor="new-locale">Locale</Label>
                  <Input id="new-locale" placeholder="en" value={newLocale} onChange={(e) => setNewLocale(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-text">Text</Label>
                <textarea
                  id="new-text"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Welcome, **{name}**! Use /help to get started."
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                />
              </div>
              {newText && (
                <div className="rounded-lg border border-border p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                  <div className="text-sm" dangerouslySetInnerHTML={{ __html: renderTelegramMarkdown(newText) }} />
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleAdd} disabled={!newKey.trim() || !newText.trim()}>
                  <Check className="mr-2 h-4 w-4" />Save
                </Button>
                <Button variant="outline" onClick={() => { setShowAddForm(false); setNewKey(""); setNewText(""); }}>
                  <X className="mr-2 h-4 w-4" />Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeLocale} onValueChange={setActiveLocale}>
        <TabsList>
          {locales.map((locale) => (
            <TabsTrigger key={locale} value={locale}>
              {locale.toUpperCase()}
            </TabsTrigger>
          ))}
        </TabsList>

        {locales.map((locale) => (
          <TabsContent key={locale} value={locale}>
            <Card>
              <CardContent className="p-0">
                {filteredResponses.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">
                    No responses for locale &quot;{locale}&quot;. Add one above.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredResponses.map((resp) => (
                      <div key={resp.id} className="p-4 space-y-2">
                        {editingId === resp.id ? (
                          <div className="space-y-3">
                            <div className="font-mono text-sm font-medium">{resp.key}</div>
                            <textarea
                              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                            />
                            {editText && (
                              <div className="rounded-lg border border-border p-3 bg-muted/30">
                                <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                                <div className="text-sm" dangerouslySetInnerHTML={{ __html: renderTelegramMarkdown(editText) }} />
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSaveEdit}><Check className="mr-2 h-3 w-3" />Save</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingId(null)}><X className="mr-2 h-3 w-3" />Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-sm font-medium">{resp.key}</div>
                              {previewId === resp.id ? (
                                <div className="mt-2 rounded-lg border border-border p-3 bg-muted/30">
                                  <div className="text-sm" dangerouslySetInnerHTML={{ __html: renderTelegramMarkdown(resp.text) }} />
                                </div>
                              ) : (
                                <p className="mt-1 text-sm text-muted-foreground truncate">{resp.text}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setPreviewId(previewId === resp.id ? null : resp.id)}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(resp)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(resp)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Response"
        description={`Are you sure you want to delete the response "${deleteTarget?.key}" (${deleteTarget?.locale})? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
