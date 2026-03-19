"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { BotI18nString } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Globe,
  Search,
  RotateCcw,
  Save,
  Loader2,
} from "lucide-react";

// Default .ftl strings for each bot type (used as reference defaults)
const DEFAULT_STRINGS: Record<string, Record<string, string>> = {
  en: {
    "start.description": "Start the bot",
    "language.description": "Change language",
    "setcommands.description": "Set bot commands",
    "welcome": "Welcome!",
    "language-select": "Please, select your language",
    "language-changed": "Language successfully changed!",
    "admin-commands-updated": "Commands updated.",
    "pagination-page": "Page",
    "pagination-of": "of",
    "pagination-total": "Total",
    "pagination-items": "items",
    "pagination-showing": "Showing",
    "unhandled": "Unrecognized command. Try /start",
    "error-not-group": "This command works only in groups.",
    "error-no-permission": "You don't have permission to use this command.",
    "error-no-reply": "Reply to a message to use this command.",
    "error-generic": "Something went wrong. Please try again.",
    "mod-user-warned": "User {$user} has been warned. ({$count}/3)",
    "mod-user-muted": "User {$user} has been muted.",
    "mod-user-unmuted": "User {$user} has been unmuted.",
    "mod-user-banned": "User {$user} has been banned.",
    "mod-user-unbanned": "User {$user} has been unbanned.",
    "mod-user-kicked": "User {$user} has been kicked.",
    "welcome-default": "Welcome to the group, {$user}!",
    "setup-group-registered": "Group registered successfully.",
    "setup-group-already-registered": "This group is already registered.",
    "rules-not-set": "No rules have been set for this group.",
    "rules-updated": "Rules updated successfully.",
  },
};

interface MergedString {
  key: string;
  locale: string;
  defaultValue: string;
  currentValue: string;
  isOverridden: boolean;
  dbRecord?: BotI18nString;
}

export default function I18nEditorPage() {
  const params = useParams();
  const botId = params.botId as string;
  const [dbStrings, setDbStrings] = useState<BotI18nString[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeLocale, setActiveLocale] = useState("en");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLocale, setNewLocale] = useState("en");
  const [newValue, setNewValue] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MergedString | null>(null);
  const [pendingChanges, setPendingChanges] = useState<
    Map<string, { key: string; locale: string; value: string }>
  >(new Map());
  const editInputRef = useRef<HTMLInputElement>(null);

  const loadStrings = useCallback(async () => {
    try {
      const data = await api.getBotI18nStrings(botId);
      setDbStrings(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load i18n strings");
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    loadStrings();
  }, [loadStrings]);

  // Merge defaults with DB overrides
  const mergedStrings = useMemo(() => {
    const defaults = DEFAULT_STRINGS[activeLocale] ?? DEFAULT_STRINGS["en"] ?? {};
    const dbByKey = new Map<string, BotI18nString>();
    for (const s of dbStrings) {
      if (s.locale === activeLocale) {
        dbByKey.set(s.key, s);
      }
    }

    const result: MergedString[] = [];

    // Add all default keys
    for (const [key, defaultValue] of Object.entries(defaults)) {
      const dbRecord = dbByKey.get(key);
      const pendingChange = pendingChanges.get(`${activeLocale}:${key}`);
      const currentValue = pendingChange?.value ?? dbRecord?.value ?? defaultValue;
      result.push({
        key,
        locale: activeLocale,
        defaultValue,
        currentValue,
        isOverridden: currentValue !== defaultValue,
        dbRecord,
      });
      dbByKey.delete(key);
    }

    // Add any DB keys that aren't in defaults (custom keys)
    for (const [key, record] of dbByKey) {
      const pendingChange = pendingChanges.get(`${activeLocale}:${key}`);
      result.push({
        key,
        locale: activeLocale,
        defaultValue: "",
        currentValue: pendingChange?.value ?? record.value,
        isOverridden: true,
        dbRecord: record,
      });
    }

    return result.sort((a, b) => a.key.localeCompare(b.key));
  }, [dbStrings, activeLocale, pendingChanges]);

  const filteredStrings = useMemo(() => {
    if (!searchQuery.trim()) return mergedStrings;
    const q = searchQuery.toLowerCase();
    return mergedStrings.filter(
      (s) =>
        s.key.toLowerCase().includes(q) ||
        s.currentValue.toLowerCase().includes(q)
    );
  }, [mergedStrings, searchQuery]);

  const locales = useMemo(() => {
    const set = new Set<string>(["en"]);
    for (const s of dbStrings) set.add(s.locale);
    for (const key of Object.keys(DEFAULT_STRINGS)) set.add(key);
    return Array.from(set).sort();
  }, [dbStrings]);

  const modifiedCount = pendingChanges.size;

  const startEdit = (str: MergedString) => {
    setEditingKey(str.key);
    setEditValue(str.currentValue);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const commitEdit = (str: MergedString) => {
    if (editValue === str.defaultValue && !str.dbRecord) {
      // Value matches default and there's no DB record -- remove any pending change
      setPendingChanges((prev) => {
        const next = new Map(prev);
        next.delete(`${activeLocale}:${str.key}`);
        return next;
      });
    } else if (editValue !== (str.dbRecord?.value ?? str.defaultValue)) {
      // Value differs from what's stored
      setPendingChanges((prev) => {
        const next = new Map(prev);
        next.set(`${activeLocale}:${str.key}`, {
          key: str.key,
          locale: activeLocale,
          value: editValue,
        });
        return next;
      });
    } else {
      // Value matches what's stored, remove from pending
      setPendingChanges((prev) => {
        const next = new Map(prev);
        next.delete(`${activeLocale}:${str.key}`);
        return next;
      });
    }
    setEditingKey(null);
  };

  const handleResetToDefault = (str: MergedString) => {
    if (str.dbRecord) {
      // Mark for deletion by setting value to default
      setPendingChanges((prev) => {
        const next = new Map(prev);
        next.set(`${activeLocale}:${str.key}`, {
          key: str.key,
          locale: activeLocale,
          value: str.defaultValue,
        });
        return next;
      });
    } else {
      // Just remove pending change
      setPendingChanges((prev) => {
        const next = new Map(prev);
        next.delete(`${activeLocale}:${str.key}`);
        return next;
      });
    }
    if (editingKey === str.key) {
      setEditValue(str.defaultValue);
      setEditingKey(null);
    }
  };

  const handleSaveAll = async () => {
    if (pendingChanges.size === 0) return;
    setSaving(true);
    try {
      const items = Array.from(pendingChanges.values());
      const updated = await api.batchUpdateBotI18nStrings(botId, items);
      // Refresh from server
      const freshData = await api.getBotI18nStrings(botId);
      setDbStrings(freshData);
      setPendingChanges(new Map());
      toast.success(`Saved ${updated.length} string${updated.length !== 1 ? "s" : ""}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    try {
      const created = await api.createBotI18nString(botId, {
        key: newKey,
        locale: newLocale,
        value: newValue,
      });
      setDbStrings((prev) => [...prev, created]);
      setNewKey("");
      setNewValue("");
      setNewLocale(activeLocale);
      setShowAddForm(false);
      toast.success("String created");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create string");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.dbRecord) {
      // No DB record, just clear pending
      if (deleteTarget) {
        setPendingChanges((prev) => {
          const next = new Map(prev);
          next.delete(`${deleteTarget.locale}:${deleteTarget.key}`);
          return next;
        });
      }
      setDeleteTarget(null);
      return;
    }
    try {
      await api.deleteBotI18nString(botId, deleteTarget.dbRecord.id);
      setDbStrings((prev) => prev.filter((s) => s.id !== deleteTarget.dbRecord!.id));
      setPendingChanges((prev) => {
        const next = new Map(prev);
        next.delete(`${deleteTarget.locale}:${deleteTarget.key}`);
        return next;
      });
      setDeleteTarget(null);
      toast.success("String deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete string");
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-8 w-48 bg-muted rounded" />
        </div>
        <div className="h-10 bg-muted rounded-lg" />
        <div className="h-9 w-48 bg-muted rounded-lg" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">i18n Strings</h1>
          <p className="text-sm text-muted-foreground">
            Manage localization strings. Override defaults or add custom keys.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {modifiedCount > 0 && (
            <Button onClick={handleSaveAll} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes ({modifiedCount})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setShowAddForm(true);
              setNewLocale(activeLocale);
            }}
            disabled={showAddForm}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add String
          </Button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="i18n-key">Key</Label>
                  <Input
                    id="i18n-key"
                    placeholder="custom-greeting"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                  />
                </div>
                <div className="w-32 space-y-2">
                  <Label htmlFor="i18n-locale">Locale</Label>
                  <Input
                    id="i18n-locale"
                    placeholder="en"
                    value={newLocale}
                    onChange={(e) => setNewLocale(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="i18n-value">Value</Label>
                <Input
                  id="i18n-value"
                  placeholder="Welcome to our bot!"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleAdd}
                  disabled={!newKey.trim() || !newValue.trim()}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewKey("");
                    setNewValue("");
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
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

      {/* Locale tabs */}
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
                  <div className="flex flex-col items-center py-12">
                    <Globe className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">
                      {searchQuery
                        ? "No matching strings found"
                        : `No strings for locale "${locale}".`}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Table header */}
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-4 px-4 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <div>Key</div>
                      <div>Value</div>
                      <div className="w-24 text-right">Actions</div>
                    </div>
                    {/* Table rows */}
                    <div className="divide-y divide-border">
                      {filteredStrings.map((str) => {
                        const isPending = pendingChanges.has(
                          `${locale}:${str.key}`
                        );
                        return (
                          <div
                            key={str.key}
                            className={`grid grid-cols-[1fr_1fr_auto] gap-4 px-4 py-3 items-center ${
                              isPending ? "bg-amber-50 dark:bg-amber-950/20" : ""
                            }`}
                          >
                            {/* Key column */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm truncate">
                                  {str.key}
                                </span>
                                {str.isOverridden && (
                                  <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                                    overridden
                                  </Badge>
                                )}
                                {isPending && (
                                  <Badge className="shrink-0 text-[10px] px-1.5 py-0 bg-amber-500 text-white hover:bg-amber-500">
                                    modified
                                  </Badge>
                                )}
                                {!str.defaultValue && (
                                  <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">
                                    custom
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Value column */}
                            <div className="min-w-0">
                              {editingKey === str.key ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    ref={editInputRef}
                                    value={editValue}
                                    onChange={(e) =>
                                      setEditValue(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") commitEdit(str);
                                      if (e.key === "Escape")
                                        setEditingKey(null);
                                    }}
                                    className="flex-1 h-8 text-sm"
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={() => commitEdit(str)}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setEditingKey(null)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="text-sm text-left truncate block w-full hover:text-foreground transition-colors cursor-text text-muted-foreground"
                                  onClick={() => startEdit(str)}
                                  title="Click to edit"
                                >
                                  {str.currentValue || (
                                    <span className="italic">empty</span>
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Actions column */}
                            <div className="flex items-center gap-1 w-24 justify-end">
                              {editingKey !== str.key && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => startEdit(str)}
                                    title="Edit"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  {str.isOverridden && str.defaultValue && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() =>
                                        handleResetToDefault(str)
                                      }
                                      title="Reset to default"
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {!str.defaultValue && str.dbRecord && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive"
                                      onClick={() => setDeleteTarget(str)}
                                      title="Delete"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Summary */}
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-3 px-1">
              <span>
                {filteredStrings.length} string{filteredStrings.length !== 1 ? "s" : ""}
                {searchQuery && ` matching "${searchQuery}"`}
              </span>
              <span>
                {filteredStrings.filter((s) => s.isOverridden).length} overridden
              </span>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete i18n String"
        description={`Are you sure you want to delete the custom string "${deleteTarget?.key}" (${deleteTarget?.locale})? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
