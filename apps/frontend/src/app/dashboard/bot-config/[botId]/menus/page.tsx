"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { BotMenu, BotMenuButton } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ArrowLeft, Plus, Pencil, Trash2, X, Check, LayoutGrid } from "lucide-react";

function ButtonGrid({ buttons }: { buttons: BotMenuButton[] }) {
  if (buttons.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">No buttons yet</p>;
  }

  const maxRow = Math.max(...buttons.map((b) => b.row), 0);
  const rows: BotMenuButton[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    rows.push(buttons.filter((b) => b.row === r).sort((a, b) => a.col - b.col));
  }

  return (
    <div className="space-y-1">
      {rows.map((rowButtons, rowIdx) => (
        <div key={rowIdx} className="flex gap-1">
          {rowButtons.map((btn) => (
            <div
              key={btn.id}
              className="flex-1 rounded border border-primary/30 bg-primary/5 px-3 py-1.5 text-center text-xs font-medium text-primary truncate"
              title={`Action: ${btn.action}`}
            >
              {btn.label}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function MenusEditorPage() {
  const params = useParams();
  const botId = params.botId as string;
  const [menus, setMenus] = useState<BotMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [newMenuName, setNewMenuName] = useState("");
  const [deleteMenuTarget, setDeleteMenuTarget] = useState<BotMenu | null>(null);
  const [deleteButtonTarget, setDeleteButtonTarget] = useState<{ menu: BotMenu; button: BotMenuButton } | null>(null);
  const [expandedMenuId, setExpandedMenuId] = useState<string | null>(null);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [editMenuName, setEditMenuName] = useState("");
  // Add button form state
  const [addButtonMenuId, setAddButtonMenuId] = useState<string | null>(null);
  const [newBtnLabel, setNewBtnLabel] = useState("");
  const [newBtnAction, setNewBtnAction] = useState("");
  const [newBtnRow, setNewBtnRow] = useState("0");
  const [newBtnCol, setNewBtnCol] = useState("0");
  // Edit button state
  const [editingButton, setEditingButton] = useState<{ menuId: string; button: BotMenuButton } | null>(null);
  const [editBtnLabel, setEditBtnLabel] = useState("");
  const [editBtnAction, setEditBtnAction] = useState("");
  const [editBtnRow, setEditBtnRow] = useState("0");
  const [editBtnCol, setEditBtnCol] = useState("0");

  const loadMenus = useCallback(async () => {
    try {
      const data = await api.getBotMenus(botId);
      setMenus(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load menus");
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    loadMenus();
  }, [loadMenus]);

  const handleAddMenu = async () => {
    if (!newMenuName.trim()) return;
    try {
      const created = await api.createBotMenu(botId, { name: newMenuName });
      setMenus((prev) => [...prev, created]);
      setNewMenuName("");
      setShowAddMenu(false);
      setExpandedMenuId(created.id);
      toast.success("Menu created");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create menu");
    }
  };

  const handleUpdateMenuName = async () => {
    if (!editingMenuId || !editMenuName.trim()) return;
    try {
      const updated = await api.updateBotMenu(botId, editingMenuId, { name: editMenuName });
      setMenus((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setEditingMenuId(null);
      toast.success("Menu name updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update menu");
    }
  };

  const handleDeleteMenu = async () => {
    if (!deleteMenuTarget) return;
    try {
      await api.deleteBotMenu(botId, deleteMenuTarget.id);
      setMenus((prev) => prev.filter((m) => m.id !== deleteMenuTarget.id));
      setDeleteMenuTarget(null);
      toast.success("Menu deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete menu");
    }
  };

  const handleAddButton = async (menuId: string) => {
    if (!newBtnLabel.trim() || !newBtnAction.trim()) return;
    try {
      const btn = await api.createMenuButton(botId, menuId, {
        label: newBtnLabel,
        action: newBtnAction,
        row: parseInt(newBtnRow) || 0,
        col: parseInt(newBtnCol) || 0,
      });
      setMenus((prev) =>
        prev.map((m) => (m.id === menuId ? { ...m, buttons: [...m.buttons, btn] } : m))
      );
      setNewBtnLabel("");
      setNewBtnAction("");
      setNewBtnRow("0");
      setNewBtnCol("0");
      setAddButtonMenuId(null);
      toast.success("Button added");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add button");
    }
  };

  const startEditButton = (menuId: string, button: BotMenuButton) => {
    setEditingButton({ menuId, button });
    setEditBtnLabel(button.label);
    setEditBtnAction(button.action);
    setEditBtnRow(String(button.row));
    setEditBtnCol(String(button.col));
  };

  const handleSaveEditButton = async () => {
    if (!editingButton) return;
    try {
      const updated = await api.updateMenuButton(botId, editingButton.menuId, editingButton.button.id, {
        label: editBtnLabel,
        action: editBtnAction,
        row: parseInt(editBtnRow) || 0,
        col: parseInt(editBtnCol) || 0,
      });
      setMenus((prev) =>
        prev.map((m) =>
          m.id === editingButton.menuId
            ? { ...m, buttons: m.buttons.map((b) => (b.id === updated.id ? updated : b)) }
            : m
        )
      );
      setEditingButton(null);
      toast.success("Button updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update button");
    }
  };

  const handleDeleteButton = async () => {
    if (!deleteButtonTarget) return;
    try {
      await api.deleteMenuButton(botId, deleteButtonTarget.menu.id, deleteButtonTarget.button.id);
      setMenus((prev) =>
        prev.map((m) =>
          m.id === deleteButtonTarget.menu.id
            ? { ...m, buttons: m.buttons.filter((b) => b.id !== deleteButtonTarget.button.id) }
            : m
        )
      );
      setDeleteButtonTarget(null);
      toast.success("Button deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete button");
    }
  };

  if (loading) return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-48" />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/bot-config/${botId}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Menus</h1>
          <p className="text-sm text-muted-foreground">Build inline keyboard menus with button grids</p>
        </div>
        <Button onClick={() => setShowAddMenu(true)} disabled={showAddMenu}>
          <Plus className="mr-2 h-4 w-4" />Add Menu
        </Button>
      </div>

      {showAddMenu && (
        <Card>
          <CardHeader><CardTitle>New Menu</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="menu-name">Menu Name</Label>
                <Input id="menu-name" placeholder="Main Menu" value={newMenuName} onChange={(e) => setNewMenuName(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddMenu} disabled={!newMenuName.trim()}>
                  <Check className="mr-2 h-4 w-4" />Create
                </Button>
                <Button variant="outline" onClick={() => { setShowAddMenu(false); setNewMenuName(""); }}>
                  <X className="mr-2 h-4 w-4" />Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {menus.length === 0 && !showAddMenu && (
        <EmptyState
          icon={LayoutGrid}
          title="No menus configured"
          description="Create your first menu to get started"
        />
      )}

      {menus.map((menu) => (
        <Card key={menu.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              {editingMenuId === menu.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input value={editMenuName} onChange={(e) => setEditMenuName(e.target.value)} className="max-w-xs" />
                  <Button size="sm" onClick={handleUpdateMenuName}><Check className="h-3 w-3" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingMenuId(null)}><X className="h-3 w-3" /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">{menu.name}</CardTitle>
                  <Badge variant="secondary">{menu.buttons.length} buttons</Badge>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedMenuId(expandedMenuId === menu.id ? null : menu.id)}
                >
                  {expandedMenuId === menu.id ? "Collapse" : "Expand"}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingMenuId(menu.id); setEditMenuName(menu.name); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteMenuTarget(menu)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Visual preview */}
            <div className="mb-4 rounded-lg border border-border p-4 bg-muted/20">
              <p className="text-xs text-muted-foreground mb-2">Button Layout Preview</p>
              <ButtonGrid buttons={menu.buttons} />
            </div>

            {expandedMenuId === menu.id && (
              <div className="space-y-4">
                {/* Button list */}
                <div className="space-y-2">
                  {menu.buttons
                    .sort((a, b) => a.row - b.row || a.col - b.col)
                    .map((btn) => (
                      <div key={btn.id} className="flex items-center justify-between rounded border border-border p-2 text-sm">
                        {editingButton?.button.id === btn.id ? (
                          <div className="flex flex-wrap items-end gap-2 flex-1">
                            <div className="space-y-1">
                              <Label className="text-xs">Label</Label>
                              <Input className="h-8 w-32" value={editBtnLabel} onChange={(e) => setEditBtnLabel(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Action</Label>
                              <Input className="h-8 w-40" value={editBtnAction} onChange={(e) => setEditBtnAction(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Row</Label>
                              <Input className="h-8 w-16" type="number" value={editBtnRow} onChange={(e) => setEditBtnRow(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Col</Label>
                              <Input className="h-8 w-16" type="number" value={editBtnCol} onChange={(e) => setEditBtnCol(e.target.value)} />
                            </div>
                            <Button size="sm" className="h-8" onClick={handleSaveEditButton}><Check className="h-3 w-3" /></Button>
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingButton(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3">
                              <span className="font-medium">{btn.label}</span>
                              <span className="text-muted-foreground text-xs">action: {btn.action}</span>
                              <Badge variant="secondary" className="text-xs">R{btn.row}:C{btn.col}</Badge>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditButton(menu.id, btn)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteButtonTarget({ menu, button: btn })}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                </div>

                {/* Add button form */}
                {addButtonMenuId === menu.id ? (
                  <div className="rounded-lg border border-dashed border-border p-3 space-y-3">
                    <p className="text-sm font-medium">Add Button</p>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Label</Label>
                        <Input className="h-8 w-32" placeholder="Button text" value={newBtnLabel} onChange={(e) => setNewBtnLabel(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Action</Label>
                        <Input className="h-8 w-40" placeholder="callback_data" value={newBtnAction} onChange={(e) => setNewBtnAction(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Row</Label>
                        <Input className="h-8 w-16" type="number" value={newBtnRow} onChange={(e) => setNewBtnRow(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Col</Label>
                        <Input className="h-8 w-16" type="number" value={newBtnCol} onChange={(e) => setNewBtnCol(e.target.value)} />
                      </div>
                      <Button size="sm" className="h-8" onClick={() => handleAddButton(menu.id)} disabled={!newBtnLabel.trim() || !newBtnAction.trim()}>
                        <Check className="mr-1 h-3 w-3" />Add
                      </Button>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setAddButtonMenuId(null)}>
                        <X className="mr-1 h-3 w-3" />Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setAddButtonMenuId(menu.id)}>
                    <Plus className="mr-2 h-3 w-3" />Add Button
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <ConfirmDialog
        open={!!deleteMenuTarget}
        onOpenChange={(open) => { if (!open) setDeleteMenuTarget(null); }}
        title="Delete Menu"
        description={`Are you sure you want to delete the menu "${deleteMenuTarget?.name}" and all its buttons? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteMenu}
      />

      <ConfirmDialog
        open={!!deleteButtonTarget}
        onOpenChange={(open) => { if (!open) setDeleteButtonTarget(null); }}
        title="Delete Button"
        description={`Are you sure you want to delete the button "${deleteButtonTarget?.button.label}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteButton}
      />
    </div>
  );
}
