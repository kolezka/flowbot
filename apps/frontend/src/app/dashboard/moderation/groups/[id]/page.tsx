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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus } from "lucide-react";

type ConfigTab =
  | "warnings"
  | "anti-spam"
  | "anti-link"
  | "welcome"
  | "captcha"
  | "content"
  | "automation"
  | "logging";

const TABS: { key: ConfigTab; label: string }[] = [
  { key: "warnings", label: "Warnings" },
  { key: "anti-spam", label: "Anti-Spam" },
  { key: "anti-link", label: "Anti-Link" },
  { key: "welcome", label: "Welcome & Rules" },
  { key: "captcha", label: "CAPTCHA" },
  { key: "content", label: "Content" },
  { key: "automation", label: "Automation" },
  { key: "logging", label: "Logging" },
];

const NOTIFICATION_EVENT_OPTIONS = ["order_placed", "order_shipped"];

function TagInput({
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState("");

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !items.includes(trimmed)) {
      onAdd(trimmed);
      setInputValue("");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, idx) => (
          <Badge key={idx} variant="secondary" className="gap-1 pr-1">
            {item}
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
    </div>
  );
}

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
  const [activeTab, setActiveTab] = useState<ConfigTab>("warnings");

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

      {/* Tabbed Config Editor */}
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

          {/* Tab buttons */}
          <div className="flex flex-wrap gap-1 mb-6 border-b pb-3">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="space-y-6">
            {activeTab === "warnings" && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Warning Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="warnThresholdMute">Warnings Before Mute</Label>
                    <Input
                      id="warnThresholdMute"
                      type="number"
                      min={1}
                      value={config.warnThresholdMute}
                      onChange={(e) => updateConfig("warnThresholdMute", parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="warnThresholdBan">Warnings Before Ban</Label>
                    <Input
                      id="warnThresholdBan"
                      type="number"
                      min={1}
                      value={config.warnThresholdBan}
                      onChange={(e) => updateConfig("warnThresholdBan", parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="warnDecayDays">Warning Decay (days)</Label>
                    <Input
                      id="warnDecayDays"
                      type="number"
                      min={0}
                      value={config.warnDecayDays}
                      onChange={(e) => updateConfig("warnDecayDays", parseInt(e.target.value) || 0)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Warnings expire after this many days. 0 = never expire.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultMuteDurationS">Default Mute Duration (seconds)</Label>
                    <Input
                      id="defaultMuteDurationS"
                      type="number"
                      min={0}
                      value={config.defaultMuteDurationS}
                      onChange={(e) => updateConfig("defaultMuteDurationS", parseInt(e.target.value) || 0)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Duration in seconds for automatic mutes on warning threshold.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "anti-spam" && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Anti-Spam</h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="antiSpamEnabled"
                    checked={config.antiSpamEnabled}
                    onCheckedChange={(checked) => updateConfig("antiSpamEnabled", checked === true)}
                  />
                  <Label htmlFor="antiSpamEnabled">Enable anti-spam protection</Label>
                </div>
                {config.antiSpamEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="antiSpamMaxMessages">Max Messages</Label>
                      <Input
                        id="antiSpamMaxMessages"
                        type="number"
                        min={1}
                        value={config.antiSpamMaxMessages}
                        onChange={(e) => updateConfig("antiSpamMaxMessages", parseInt(e.target.value) || 1)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Max messages allowed within the time window.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="antiSpamWindowSeconds">Window (seconds)</Label>
                      <Input
                        id="antiSpamWindowSeconds"
                        type="number"
                        min={1}
                        value={config.antiSpamWindowSeconds}
                        onChange={(e) => updateConfig("antiSpamWindowSeconds", parseInt(e.target.value) || 1)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Time window for message counting.
                      </p>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="slowModeDelay">Slow Mode Delay (seconds)</Label>
                  <Input
                    id="slowModeDelay"
                    type="number"
                    min={0}
                    value={config.slowModeDelay}
                    onChange={(e) => updateConfig("slowModeDelay", parseInt(e.target.value) || 0)}
                    className="max-w-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enforce a delay between user messages. 0 = disabled.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "anti-link" && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Anti-Link</h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="antiLinkEnabled"
                    checked={config.antiLinkEnabled}
                    onCheckedChange={(checked) => updateConfig("antiLinkEnabled", checked === true)}
                  />
                  <Label htmlFor="antiLinkEnabled">Enable anti-link protection</Label>
                </div>
                {config.antiLinkEnabled && (
                  <div className="space-y-2">
                    <Label>Whitelisted Domains</Label>
                    <TagInput
                      items={config.antiLinkWhitelist ?? []}
                      onAdd={(val) =>
                        updateConfig("antiLinkWhitelist", [...(config.antiLinkWhitelist ?? []), val])
                      }
                      onRemove={(idx) =>
                        updateConfig(
                          "antiLinkWhitelist",
                          (config.antiLinkWhitelist ?? []).filter((_, i) => i !== idx)
                        )
                      }
                      placeholder="e.g. example.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Links from these domains will not be removed.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "welcome" && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Welcome & Rules</h3>
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
                    <Textarea
                      id="welcomeMessage"
                      value={config.welcomeMessage || ""}
                      onChange={(e) => updateConfig("welcomeMessage", e.target.value)}
                      placeholder="Welcome to the group, {name}!"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="rulesText">Rules Text</Label>
                  <Textarea
                    id="rulesText"
                    value={config.rulesText || ""}
                    onChange={(e) => updateConfig("rulesText", e.target.value)}
                    placeholder="Group rules go here..."
                    className="min-h-[120px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown when users type /rules in the group.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "captcha" && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">CAPTCHA</h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="captchaEnabled"
                    checked={config.captchaEnabled}
                    onCheckedChange={(checked) => updateConfig("captchaEnabled", checked === true)}
                  />
                  <Label htmlFor="captchaEnabled">Enable CAPTCHA for new members</Label>
                </div>
                {config.captchaEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="captchaMode">CAPTCHA Mode</Label>
                      <Select
                        value={config.captchaMode}
                        onValueChange={(val) => updateConfig("captchaMode", val)}
                      >
                        <SelectTrigger id="captchaMode">
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="button">Button</SelectItem>
                          <SelectItem value="math">Math</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Button: click to verify. Math: solve a simple equation.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="captchaTimeoutS">Timeout (seconds)</Label>
                      <Input
                        id="captchaTimeoutS"
                        type="number"
                        min={10}
                        value={config.captchaTimeoutS}
                        onChange={(e) => updateConfig("captchaTimeoutS", parseInt(e.target.value) || 60)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Time before unverified users are kicked.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "content" && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Content Filtering</h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="silentMode"
                    checked={config.silentMode}
                    onCheckedChange={(checked) => updateConfig("silentMode", checked === true)}
                  />
                  <Label htmlFor="silentMode">Silent mode (suppress bot confirmation messages)</Label>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="keywordFiltersEnabled"
                      checked={config.keywordFiltersEnabled}
                      onCheckedChange={(checked) => updateConfig("keywordFiltersEnabled", checked === true)}
                    />
                    <Label htmlFor="keywordFiltersEnabled">Enable keyword filters</Label>
                  </div>
                  {config.keywordFiltersEnabled && (
                    <div className="space-y-2">
                      <Label>Blocked Keywords</Label>
                      <TagInput
                        items={config.keywordFilters ?? []}
                        onAdd={(val) =>
                          updateConfig("keywordFilters", [...(config.keywordFilters ?? []), val])
                        }
                        onRemove={(idx) =>
                          updateConfig(
                            "keywordFilters",
                            (config.keywordFilters ?? []).filter((_, i) => i !== idx)
                          )
                        }
                        placeholder="Add a keyword..."
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="aiModEnabled"
                      checked={config.aiModEnabled}
                      onCheckedChange={(checked) => updateConfig("aiModEnabled", checked === true)}
                    />
                    <Label htmlFor="aiModEnabled">Enable AI moderation</Label>
                  </div>
                  {config.aiModEnabled && (
                    <div className="space-y-2 max-w-xs">
                      <Label htmlFor="aiModThreshold">AI Threshold (0 - 1)</Label>
                      <Input
                        id="aiModThreshold"
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={config.aiModThreshold}
                        onChange={(e) => updateConfig("aiModThreshold", parseFloat(e.target.value) || 0)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Messages scoring above this threshold are flagged. Lower = stricter.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "automation" && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Automation</h3>

                {/* Quarantine */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="quarantineEnabled"
                      checked={config.quarantineEnabled}
                      onCheckedChange={(checked) => updateConfig("quarantineEnabled", checked === true)}
                    />
                    <Label htmlFor="quarantineEnabled">Enable quarantine for new members</Label>
                  </div>
                  {config.quarantineEnabled && (
                    <div className="space-y-2 max-w-xs">
                      <Label htmlFor="quarantineDurationS">Quarantine Duration (seconds)</Label>
                      <Input
                        id="quarantineDurationS"
                        type="number"
                        min={0}
                        value={config.quarantineDurationS}
                        onChange={(e) => updateConfig("quarantineDurationS", parseInt(e.target.value) || 0)}
                      />
                      <p className="text-xs text-muted-foreground">
                        New members are restricted for this duration.
                      </p>
                    </div>
                  )}
                </div>

                {/* Pipeline */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pipelineEnabled"
                      checked={config.pipelineEnabled}
                      onCheckedChange={(checked) => updateConfig("pipelineEnabled", checked === true)}
                    />
                    <Label htmlFor="pipelineEnabled">Enable notification pipeline</Label>
                  </div>
                  {config.pipelineEnabled && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="pipelineDmTemplate">DM Template</Label>
                        <Textarea
                          id="pipelineDmTemplate"
                          value={config.pipelineDmTemplate || ""}
                          onChange={(e) => updateConfig("pipelineDmTemplate", e.target.value)}
                          placeholder="Hello {name}, your order {orderId} has been updated..."
                        />
                      </div>
                      <div className="space-y-2 max-w-md">
                        <Label htmlFor="pipelineDeeplink">Deeplink</Label>
                        <Input
                          id="pipelineDeeplink"
                          value={config.pipelineDeeplink || ""}
                          onChange={(e) => updateConfig("pipelineDeeplink", e.target.value)}
                          placeholder="e.g. order_status"
                        />
                        <p className="text-xs text-muted-foreground">
                          Bot deeplink parameter sent with DM notifications.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notification Events */}
                <div className="space-y-3 pt-2">
                  <Label>Notification Events</Label>
                  <div className="space-y-2">
                    {NOTIFICATION_EVENT_OPTIONS.map((evt) => (
                      <div key={evt} className="flex items-center space-x-2">
                        <Checkbox
                          id={`notif-${evt}`}
                          checked={(config.notificationEvents ?? []).includes(evt)}
                          onCheckedChange={(checked) => {
                            const current = config.notificationEvents ?? [];
                            if (checked) {
                              updateConfig("notificationEvents", [...current, evt]);
                            } else {
                              updateConfig(
                                "notificationEvents",
                                current.filter((e) => e !== evt)
                              );
                            }
                          }}
                        />
                        <Label htmlFor={`notif-${evt}`} className="font-normal">
                          {evt.replace(/_/g, " ")}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "logging" && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Logging</h3>
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="logChannelId">Log Channel ID</Label>
                  <Input
                    id="logChannelId"
                    value={config.logChannelId || ""}
                    onChange={(e) => updateConfig("logChannelId", e.target.value || undefined)}
                    placeholder="-1001234567890"
                  />
                  <p className="text-xs text-muted-foreground">
                    Telegram channel or group ID where moderation actions are logged.
                  </p>
                </div>
                <div className="space-y-2 max-w-xs">
                  <Label htmlFor="autoDeleteCommandsS">Auto-Delete Commands After (seconds)</Label>
                  <Input
                    id="autoDeleteCommandsS"
                    type="number"
                    min={0}
                    value={config.autoDeleteCommandsS}
                    onChange={(e) => updateConfig("autoDeleteCommandsS", parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Automatically delete bot commands after this many seconds. 0 = disabled.
                  </p>
                </div>
              </div>
            )}

            {/* Save button */}
            <div className="pt-4 border-t">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
