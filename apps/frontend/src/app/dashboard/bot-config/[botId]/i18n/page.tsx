"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { BotI18nString } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ArrowLeft, Plus, Pencil, Trash2, X, Check, Globe, Search } from "lucide-react";

export default function I18nEditorPage() {
  const params = useParams();
  const botId = params.botId as string;
  const [strings, setStrings] = useState<BotI18nString[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLocale, setActiveLocale] = useState("en");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLocale, setNewLocale] = useState("en");
  const [newValue, setNewValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BotI18nString | null>(null);

  const loadStrings = useCallback(async () => {
    try {
      const data = await api.getBotI18nStrings(botId);
      setStrings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    loadStrings();
  }, [loadStrings]);

  const locales = useMemo(() => {
    const set = new Set(strings.map((s) => s.locale));
    if (set.size === 0) set.add("en");
    return Array.from(set).sort();
  }, [strings]);

  const filteredStrings = useMemo(() => {
    let result = strings.filter((s) => s.locale === activeLocale);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) => s.key.toLowerCase().includes(q) || s.value.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => a.key.localeCompare(b.key));
  }, [strings, activeLocale, searchQuery]);

  const handleAdd = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    try {
      const created = await api.createBotI18nString(botId, {
        key: newKey,
        locale: newLocale,
        value: newValue,
      });
      setStrings((prev) => [...prev, created]);
      setNewKey("");
      setNewValue("");
      setNewLocale(activeLocale);
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (str: BotI18nString) => {
    setEditingId(str.id);
    setEditValue(str.value);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      const updated = await api.updateBotI18nString(botId, editingId, { value: editValue });
      setStrings((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setEditingId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteBotI18nString(botId, deleteTarget.id);
      setStrings((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
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
          <h1 className="text-2xl font-bold">i18n Strings</h1>
          <p className="text-sm text-muted-foreground">Manage localization key-value pairs</p>
        </div>
        <Button onClick={() => { setShowAddForm(true); setNewLocale(activeLocale); }} disabled={showAddForm}>
          <Plus className="mr-2 h-4 w-4" />Add String
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader><CardTitle>New i18n String</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="i18n-key">Key</Label>
                  <Input id="i18n-key" placeholder="greeting.welcome" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
                </div>
                <div className="w-32 space-y-2">
                  <Label htmlFor="i18n-locale">Locale</Label>
                  <Input id="i18n-locale" placeholder="en" value={newLocale} onChange={(e) => setNewLocale(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="i18n-value">Value</Label>
                <Input id="i18n-value" placeholder="Welcome to our bot!" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAdd} disabled={!newKey.trim() || !newValue.trim()}>
                  <Check className="mr-2 h-4 w-4" />Save
                </Button>
                <Button variant="outline" onClick={() => { setShowAddForm(false); setNewKey(""); setNewValue(""); }}>
                  <X className="mr-2 h-4 w-4" />Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search keys or values..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

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
                {filteredStrings.length === 0 ? (
                  <div className="flex flex-col items-center py-8">
                    <Globe className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">
                      {searchQuery ? "No matching strings found" : `No strings for locale "${locale}". Add one above.`}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredStrings.map((str) => (
                      <div key={str.id} className="flex items-center gap-4 p-4">
                        <div className="flex-1 min-w-0">
                          {editingId === str.id ? (
                            <div className="space-y-2">
                              <div className="font-mono text-sm font-medium text-muted-foreground">{str.key}</div>
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="flex-1"
                                />
                                <Button size="sm" onClick={handleSaveEdit}><Check className="h-3 w-3" /></Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-mono text-sm font-medium">{str.key}</div>
                              <p className="mt-0.5 text-sm text-muted-foreground truncate">{str.value}</p>
                            </div>
                          )}
                        </div>
                        {editingId !== str.id && (
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(str)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(str)}>
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
          </TabsContent>
        ))}
      </Tabs>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete i18n String"
        description={`Are you sure you want to delete the string "${deleteTarget?.key}" (${deleteTarget?.locale})? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
