"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import {
  api,
  Community,
  CommunityConfig,
  CommunityTelegramConfig,
  CommunityMember,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PlatformBadge } from "@/components/platform-badge";
import { ResponsiveTable, Column } from "@/components/responsive-table";
import { ArrowLeft, Users, Settings, MessageSquare, AlertTriangle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "config" | "telegram" | "members" | "warnings" | "logs";

const memberColumns: Column<CommunityMember>[] = [
  {
    header: "Platform",
    accessor: (m) => <PlatformBadge platform={m.platform ?? "telegram"} />,
  },
  {
    header: "Username",
    accessor: (m) =>
      m.username ? (
        <span className="font-medium">@{m.username}</span>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      ),
  },
  {
    header: "Role",
    accessor: (m) => (
      <Badge variant="outline" className="capitalize">
        {m.role}
      </Badge>
    ),
  },
  {
    header: "Messages",
    accessor: "messageCount",
    cellClassName: "text-muted-foreground",
    hideOnMobile: true,
  },
  {
    header: "Warnings",
    accessor: (m) =>
      m.warningCount > 0 ? (
        <Badge variant="destructive">{m.warningCount}</Badge>
      ) : (
        <span className="text-muted-foreground text-sm">0</span>
      ),
  },
  {
    header: "Status",
    accessor: (m) => (
      <div className="flex gap-1 flex-wrap">
        {m.isMuted && <Badge variant="secondary">Muted</Badge>}
        {m.isQuarantined && <Badge variant="destructive">Quarantined</Badge>}
        {!m.isMuted && !m.isQuarantined && (
          <Badge variant="default">Active</Badge>
        )}
      </div>
    ),
  },
  {
    header: "Joined",
    accessor: (m) => new Date(m.joinedAt).toLocaleDateString(),
    cellClassName: "text-muted-foreground",
    hideOnMobile: true,
  },
];

export default function CommunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [community, setCommunity] = useState<Community | null>(null);
  const [config, setConfig] = useState<CommunityConfig | null>(null);
  const [telegramConfig, setTelegramConfig] =
    useState<CommunityTelegramConfig | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("config");
  const [loading, setLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadCommunity();
  }, [id]);

  useEffect(() => {
    if (!community) return;
    if (activeTab === "config" && !config) loadConfig();
    if (activeTab === "telegram" && !telegramConfig && community.platform === "telegram")
      loadTelegramConfig();
    if (activeTab === "members" && members.length === 0) loadMembers();
    if (activeTab === "warnings" && warnings.length === 0) loadWarnings();
    if (activeTab === "logs" && logs.length === 0) loadLogs();
  }, [activeTab, community]);

  const loadCommunity = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCommunity(id);
      setCommunity(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load community");
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const data = await api.getCommunityConfig(id);
      setConfig(data);
    } catch {
      // config may not exist yet
    }
  };

  const loadTelegramConfig = async () => {
    try {
      const data = await api.getCommunityTelegramConfig(id);
      setTelegramConfig(data);
    } catch {
      // may not exist
    }
  };

  const loadMembers = async () => {
    try {
      const data = await api.getCommunityMembers(id, { limit: 20 });
      setMembers(data.data);
    } catch {
      // ignore
    }
  };

  const loadWarnings = async () => {
    try {
      const data = await api.getCommunityWarnings(id, { limit: 20 });
      setWarnings(data.data);
    } catch {
      // ignore
    }
  };

  const loadLogs = async () => {
    try {
      const data = await api.getCommunityLogs(id, { limit: 20 });
      setLogs(data.data);
    } catch {
      // ignore
    }
  };

  const handleConfigSave = async (updated: Partial<CommunityConfig>) => {
    setConfigLoading(true);
    try {
      const data = await api.updateCommunityConfig(id, updated);
      setConfig(data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setConfigLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-muted-foreground">Loading community...</div>
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/communities">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Communities
          </Link>
        </Button>
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          {error ?? "Community not found"}
        </div>
      </div>
    );
  }

  const allTabs: { id: Tab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: "config" as Tab, label: "Config", icon: <Settings className="h-4 w-4" />, show: true },
    {
      id: "telegram" as Tab,
      label: "Telegram",
      icon: <MessageSquare className="h-4 w-4" />,
      show: community.platform === "telegram",
    },
    { id: "members" as Tab, label: "Members", icon: <Users className="h-4 w-4" />, show: true },
    { id: "warnings" as Tab, label: "Warnings", icon: <AlertTriangle className="h-4 w-4" />, show: true },
    { id: "logs" as Tab, label: "Logs", icon: <FileText className="h-4 w-4" />, show: true },
  ];
  const tabs = allTabs.filter((t) => t.show);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/communities">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Communities
        </Link>
      </Button>

      {/* Community info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="space-y-1">
              <CardTitle className="text-xl">
                {community.name ?? "Unnamed Community"}
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <PlatformBadge platform={community.platform} />
                {community.type && (
                  <Badge variant="outline" className="capitalize">
                    {community.type}
                  </Badge>
                )}
                {community.isActive ? (
                  <Badge variant="default">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground space-y-1">
              <div>
                <span className="font-medium">{community.memberCount}</span> members
              </div>
              <div>
                Joined {new Date(community.joinedAt).toLocaleDateString()}
              </div>
              {community.leftAt && (
                <div>Left {new Date(community.leftAt).toLocaleDateString()}</div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "config" && (
        <ConfigTab
          config={config}
          loading={configLoading}
          saveSuccess={saveSuccess}
          onSave={handleConfigSave}
        />
      )}

      {activeTab === "telegram" && community.platform === "telegram" && (
        <TelegramConfigTab
          communityId={id}
          config={telegramConfig}
          onUpdate={setTelegramConfig}
        />
      )}

      {activeTab === "members" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Members</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/communities/${id}/members`}>
                  View All
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveTable
              columns={memberColumns}
              data={members}
              keyExtractor={(m) => m.id}
              loading={false}
              emptyMessage="No members found"
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "warnings" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Warnings</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/communities/${id}/warnings`}>
                  View All
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {warnings.length === 0 ? (
              <p className="text-muted-foreground text-sm">No warnings found</p>
            ) : (
              <div className="space-y-2">
                {warnings.map((w: any) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">
                        Member: {w.platformAccountId ?? w.userId ?? "—"}
                      </div>
                      {w.reason && (
                        <div className="text-xs text-muted-foreground">{w.reason}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {w.isActive ? (
                        <Badge variant="destructive">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(w.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "logs" && (
        <Card>
          <CardHeader>
            <CardTitle>Moderation Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-sm">No logs found</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log: any) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium capitalize">{log.action}</div>
                      {log.reason && (
                        <div className="text-xs text-muted-foreground">{log.reason}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {log.automated && <Badge variant="outline">Auto</Badge>}
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConfigTab
// ---------------------------------------------------------------------------

function ConfigTab({
  config,
  loading,
  saveSuccess,
  onSave,
}: {
  config: CommunityConfig | null;
  loading: boolean;
  saveSuccess: boolean;
  onSave: (data: Partial<CommunityConfig>) => void;
}) {
  const [local, setLocal] = useState<Partial<CommunityConfig>>({});

  useEffect(() => {
    if (config) setLocal(config);
  }, [config]);

  const update = <K extends keyof CommunityConfig>(
    key: K,
    value: CommunityConfig[K]
  ) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  if (!config) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-muted-foreground text-sm">No config found for this community.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Community Config</CardTitle>
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="text-sm text-green-600">Saved!</span>
            )}
            <Button
              size="sm"
              onClick={() => onSave(local)}
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Welcome */}
        <Section title="Welcome">
          <ToggleField
            label="Enable Welcome Message"
            checked={local.welcomeEnabled ?? false}
            onChange={(v) => update("welcomeEnabled", v)}
          />
          {local.welcomeEnabled && (
            <TextField
              label="Welcome Message"
              value={local.welcomeMessage ?? ""}
              onChange={(v) => update("welcomeMessage", v)}
              multiline
            />
          )}
          <TextField
            label="Rules Text"
            value={local.rulesText ?? ""}
            onChange={(v) => update("rulesText", v)}
            multiline
          />
        </Section>

        {/* Anti-Spam */}
        <Section title="Anti-Spam">
          <ToggleField
            label="Enable Anti-Spam"
            checked={local.antiSpamEnabled ?? false}
            onChange={(v) => update("antiSpamEnabled", v)}
          />
          {local.antiSpamEnabled && (
            <>
              <NumberField
                label="Max Messages"
                value={local.antiSpamMaxMessages ?? 0}
                onChange={(v) => update("antiSpamMaxMessages", v)}
              />
              <NumberField
                label="Window (seconds)"
                value={local.antiSpamWindowSeconds ?? 0}
                onChange={(v) => update("antiSpamWindowSeconds", v)}
              />
            </>
          )}
        </Section>

        {/* Anti-Link */}
        <Section title="Anti-Link">
          <ToggleField
            label="Enable Anti-Link"
            checked={local.antiLinkEnabled ?? false}
            onChange={(v) => update("antiLinkEnabled", v)}
          />
        </Section>

        {/* Warnings */}
        <Section title="Warning System">
          <NumberField
            label="Warnings before Mute"
            value={local.warnThresholdMute ?? 0}
            onChange={(v) => update("warnThresholdMute", v)}
          />
          <NumberField
            label="Warnings before Ban"
            value={local.warnThresholdBan ?? 0}
            onChange={(v) => update("warnThresholdBan", v)}
          />
          <NumberField
            label="Warning Decay (days)"
            value={local.warnDecayDays ?? 0}
            onChange={(v) => update("warnDecayDays", v)}
          />
          <NumberField
            label="Default Mute Duration (seconds)"
            value={local.defaultMuteDurationS ?? 0}
            onChange={(v) => update("defaultMuteDurationS", v)}
          />
        </Section>

        {/* AI Moderation */}
        <Section title="AI Moderation">
          <ToggleField
            label="Enable AI Moderation"
            checked={local.aiModerationEnabled ?? false}
            onChange={(v) => update("aiModerationEnabled", v)}
          />
          {local.aiModerationEnabled && (
            <NumberField
              label="AI Mod Threshold (0–1)"
              value={local.aiModThreshold ?? 0}
              onChange={(v) => update("aiModThreshold", v)}
              step={0.05}
              min={0}
              max={1}
            />
          )}
        </Section>

        {/* Pipeline */}
        <Section title="Pipeline">
          <ToggleField
            label="Enable Pipeline"
            checked={local.pipelineEnabled ?? false}
            onChange={(v) => update("pipelineEnabled", v)}
          />
          {local.pipelineEnabled && (
            <>
              <TextField
                label="DM Template"
                value={local.pipelineDmTemplate ?? ""}
                onChange={(v) => update("pipelineDmTemplate", v)}
              />
              <TextField
                label="Deeplink"
                value={local.pipelineDeeplink ?? ""}
                onChange={(v) => update("pipelineDeeplink", v)}
              />
            </>
          )}
        </Section>

        {/* Other */}
        <Section title="Other">
          <ToggleField
            label="Silent Mode"
            checked={local.silentMode ?? false}
            onChange={(v) => update("silentMode", v)}
          />
          <ToggleField
            label="Enable Keyword Filters"
            checked={local.keywordFiltersEnabled ?? false}
            onChange={(v) => update("keywordFiltersEnabled", v)}
          />
          <NumberField
            label="Auto-delete Commands (seconds, 0 = off)"
            value={local.autoDeleteCommandsS ?? 0}
            onChange={(v) => update("autoDeleteCommandsS", v)}
          />
          <TextField
            label="Log Channel ID"
            value={local.logChannelId ?? ""}
            onChange={(v) => update("logChannelId", v)}
          />
        </Section>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// TelegramConfigTab
// ---------------------------------------------------------------------------

function TelegramConfigTab({
  communityId,
  config,
  onUpdate,
}: {
  communityId: string;
  config: CommunityTelegramConfig | null;
  onUpdate: (c: CommunityTelegramConfig) => void;
}) {
  const [local, setLocal] = useState<Partial<CommunityTelegramConfig>>({});
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (config) setLocal(config);
  }, [config]);

  const update = <K extends keyof CommunityTelegramConfig>(
    key: K,
    value: CommunityTelegramConfig[K]
  ) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const data = await api.updateCommunityTelegramConfig(communityId, local);
      onUpdate(data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  if (!config) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-muted-foreground text-sm">No Telegram config found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Telegram Config</CardTitle>
          <div className="flex items-center gap-2">
            {saveSuccess && <span className="text-sm text-green-600">Saved!</span>}
            <Button size="sm" onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Section title="CAPTCHA">
          <ToggleField
            label="Enable CAPTCHA"
            checked={local.captchaEnabled ?? false}
            onChange={(v) => update("captchaEnabled", v)}
          />
          {local.captchaEnabled && (
            <>
              <TextField
                label="CAPTCHA Mode"
                value={local.captchaMode ?? ""}
                onChange={(v) => update("captchaMode", v)}
              />
              <NumberField
                label="CAPTCHA Timeout (seconds)"
                value={local.captchaTimeoutS ?? 0}
                onChange={(v) => update("captchaTimeoutS", v)}
              />
            </>
          )}
        </Section>
        <Section title="Quarantine">
          <ToggleField
            label="Enable Quarantine"
            checked={local.quarantineEnabled ?? false}
            onChange={(v) => update("quarantineEnabled", v)}
          />
          {local.quarantineEnabled && (
            <NumberField
              label="Quarantine Duration (seconds)"
              value={local.quarantineDurationS ?? 0}
              onChange={(v) => update("quarantineDurationS", v)}
            />
          )}
        </Section>
        <Section title="Slow Mode">
          <NumberField
            label="Slow Mode Delay (seconds, 0 = off)"
            value={local.slowModeDelay ?? 0}
            onChange={(v) => update("slowModeDelay", v)}
          />
        </Section>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Small field helpers
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      {multiline ? (
        <textarea
          className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <Input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-40"
      />
    </div>
  );
}
