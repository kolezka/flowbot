"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ManagedGroup, GroupConfig } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [group, setGroup] = useState<ManagedGroup | null>(null);
  const [config, setConfig] = useState<GroupConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  const loadGroup = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getGroup(groupId);
      setGroup(data);
      setConfig(data.config);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load group";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const updated = await api.updateGroupConfig(groupId, config);
      setGroup(updated);
      setConfig(updated.config);
      setSaveMessage("Configuration saved successfully.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save config";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = <K extends keyof GroupConfig>(key: K, value: GroupConfig[K]) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading group...</div>
      </div>
    );
  }

  if (error && !group) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>Back</Button>
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">{error}</div>
      </div>
    );
  }

  if (!group || !config) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{group.title || `Chat ${group.chatId}`}</h2>
          <p className="text-sm text-muted-foreground">Chat ID: {group.chatId}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/moderation/groups/${group.id}/members`}>
            <Button variant="outline">Members</Button>
          </Link>
          <Link href={`/dashboard/moderation/groups/${group.id}/warnings`}>
            <Button variant="outline">Warnings</Button>
          </Link>
        </div>
      </div>

      {/* Group Info */}
      <Card>
        <CardHeader>
          <CardTitle>Group Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <Badge variant="outline">{group.type}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Members</p>
              <p className="font-medium">{group.memberCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={group.isActive ? "default" : "secondary"}>
                {group.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Joined</p>
              <p className="text-sm">{new Date(group.joinedAt).toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Config Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 p-4 text-destructive">{error}</div>
          )}
          {saveMessage && (
            <div className="mb-4 rounded-lg bg-green-500/10 p-4 text-green-700 dark:text-green-400">
              {saveMessage}
            </div>
          )}

          <div className="space-y-6">
            {/* Warning Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Warning Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxWarnings">Max Warnings Before Ban</Label>
                  <Input
                    id="maxWarnings"
                    type="number"
                    min={1}
                    value={config.maxWarnings}
                    onChange={(e) => updateConfig("maxWarnings", parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warningExpiry">Warning Expiry (hours)</Label>
                  <Input
                    id="warningExpiry"
                    type="number"
                    min={0}
                    value={config.warningExpiry}
                    onChange={(e) => updateConfig("warningExpiry", parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            {/* Mute Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Mute Settings</h3>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="muteOnWarn"
                  checked={config.muteOnWarn}
                  onCheckedChange={(checked) => updateConfig("muteOnWarn", checked === true)}
                />
                <Label htmlFor="muteOnWarn">Mute user on warning</Label>
              </div>
              {config.muteOnWarn && (
                <div className="space-y-2 max-w-xs">
                  <Label htmlFor="muteDuration">Mute Duration (minutes)</Label>
                  <Input
                    id="muteDuration"
                    type="number"
                    min={1}
                    value={config.muteDuration}
                    onChange={(e) => updateConfig("muteDuration", parseInt(e.target.value) || 1)}
                  />
                </div>
              )}
            </div>

            {/* Anti-Spam Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Anti-Spam & Anti-Flood</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="antiSpam"
                    checked={config.antiSpam}
                    onCheckedChange={(checked) => updateConfig("antiSpam", checked === true)}
                  />
                  <Label htmlFor="antiSpam">Enable anti-spam</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="antiFlood"
                    checked={config.antiFlood}
                    onCheckedChange={(checked) => updateConfig("antiFlood", checked === true)}
                  />
                  <Label htmlFor="antiFlood">Enable anti-flood</Label>
                </div>
              </div>
              {config.antiFlood && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="floodLimit">Flood Limit (messages)</Label>
                    <Input
                      id="floodLimit"
                      type="number"
                      min={1}
                      value={config.floodLimit}
                      onChange={(e) => updateConfig("floodLimit", parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="floodWindow">Flood Window (seconds)</Label>
                    <Input
                      id="floodWindow"
                      type="number"
                      min={1}
                      value={config.floodWindow}
                      onChange={(e) => updateConfig("floodWindow", parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Welcome Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Welcome Message</h3>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="welcomeEnabled"
                  checked={config.welcomeEnabled}
                  onCheckedChange={(checked) => updateConfig("welcomeEnabled", checked === true)}
                />
                <Label htmlFor="welcomeEnabled">Enable welcome message</Label>
              </div>
              {config.welcomeEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="welcomeMessage">Welcome Message</Label>
                  <textarea
                    id="welcomeMessage"
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={config.welcomeMessage || ""}
                    onChange={(e) => updateConfig("welcomeMessage", e.target.value)}
                    placeholder="Welcome to the group, {name}!"
                  />
                </div>
              )}
            </div>

            {/* Log Channel */}
            <div className="space-y-2">
              <Label htmlFor="logChannelId">Log Channel ID</Label>
              <Input
                id="logChannelId"
                value={config.logChannelId || ""}
                onChange={(e) => updateConfig("logChannelId", e.target.value || undefined)}
                placeholder="-1001234567890"
                className="max-w-xs"
              />
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
