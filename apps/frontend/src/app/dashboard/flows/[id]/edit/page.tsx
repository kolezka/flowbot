"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api, type BotInstance } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Play, Square, BarChart3, History, Bot } from "lucide-react";
import { ExpressionBuilder, type ExpressionValue } from "@/components/expression-builder";
import Link from "next/link";
import {
  ExecutionToolbar,
  ExecutionPanel,
  applyExecutionStyles,
  useExecutionState,
} from "@/components/flow-execution-overlay";
import { NodePalette as ExtractedNodePalette } from "@/components/flow-editor/NodePalette";

import { NODE_TYPES } from "@tg-allegro/flow-shared";

const NODE_TYPES_CONFIG = NODE_TYPES;

/** Node types that have a dedicated property panel. */
const CONFIGURABLE_ACTIONS = new Set([
  "send_message", "send_photo", "forward_message", "copy_message", "edit_message",
  "delete_message", "pin_message", "unpin_message", "restrict_user", "promote_user",
  "create_poll", "answer_callback_query", "ban_user", "mute_user",
  "send_video", "send_document", "send_sticker", "send_location",
  "send_voice", "send_contact", "set_chat_title", "set_chat_description",
  "export_invite_link", "get_chat_member",
  // Context & chaining
  "get_context", "set_context", "delete_context", "context_condition",
  "run_flow", "emit_event", "custom_event",
  // New Telegram (SP2)
  "answer_inline_query", "send_invoice", "answer_pre_checkout",
  "set_chat_menu_button", "send_media_group", "create_forum_topic", "set_my_commands",
  // Unified cross-platform
  "unified_send_message", "unified_send_media", "unified_delete_message",
  "unified_ban_user", "unified_kick_user", "unified_pin_message",
  "unified_send_dm", "unified_set_role",
  // Discord actions
  "discord_send_message", "discord_send_embed", "discord_send_dm", "discord_edit_message",
  "discord_delete_message", "discord_add_reaction", "discord_remove_reaction",
  "discord_pin_message", "discord_unpin_message", "discord_ban_member", "discord_kick_member",
  "discord_timeout_member", "discord_add_role", "discord_remove_role", "discord_create_role",
  "discord_set_nickname", "discord_create_channel", "discord_delete_channel",
  "discord_move_member", "discord_create_thread", "discord_send_thread_message",
  "discord_create_invite", "discord_create_scheduled_event",
  // New Discord (SP2)
  "discord_reply_interaction", "discord_show_modal", "discord_send_components",
  "discord_edit_interaction", "discord_defer_reply", "discord_set_channel_permissions",
  "discord_create_forum_post", "discord_register_commands",
]);

const GENERAL_NODE_TYPES = new Set(["schedule", "webhook", "api_call", "delay", "time_based"]);

type PlatformFilter = "all" | "telegram" | "discord" | "general";

function getNodePlatform(nodeType: string): "telegram" | "discord" | "general" {
  if (nodeType.startsWith("discord_")) return "discord";
  if (GENERAL_NODE_TYPES.has(nodeType)) return "general";
  return "telegram";
}

function NodePalette({ onDragStart }: { onDragStart: (type: string, label: string, category: string) => void }) {
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const categories = ["trigger", "condition", "action", "advanced"];

  const filteredNodes = NODE_TYPES_CONFIG.filter((n) => {
    if (platformFilter === "all") return true;
    return getNodePlatform(n.type) === platformFilter;
  });

  return (
    <div className="w-56 border-r border-border bg-card p-3 overflow-y-auto">
      <h3 className="mb-2 text-sm font-semibold">Node Palette</h3>
      <div className="mb-3 flex gap-1 flex-wrap">
        {(["all", "telegram", "discord", "general"] as PlatformFilter[]).map((p) => (
          <button
            key={p}
            onClick={() => setPlatformFilter(p)}
            className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
              platformFilter === p
                ? p === "discord" ? "bg-[#5865F2] text-white" : p === "telegram" ? "bg-[#0088cc] text-white" : "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      {categories.map((cat) => {
        const catNodes = filteredNodes.filter((n) => n.category === cat);
        if (catNodes.length === 0) return null;
        return (
          <div key={cat} className="mb-4">
            <h4 className="mb-1 text-xs font-medium uppercase text-muted-foreground">{cat}s</h4>
            <div className="space-y-1">
              {catNodes.map((node) => (
                <div
                  key={node.type}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/reactflow-type", node.type);
                    e.dataTransfer.setData("application/reactflow-label", node.label);
                    e.dataTransfer.setData("application/reactflow-category", node.category);
                    onDragStart(node.type, node.label, node.category);
                  }}
                  className="cursor-grab rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent transition-colors"
                  style={{ borderLeftColor: node.color, borderLeftWidth: 3 }}
                >
                  {node.label}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable property panel field components
// ---------------------------------------------------------------------------

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted-foreground">{children}</label>;
}

function TextInput({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function TextareaInput({
  label, value, onChange, placeholder, rows = 3,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <textarea
        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function SelectInput({
  label, value, onChange, options, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function CheckboxInput({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded" />
      {label}
    </label>
  );
}

function NumberInput({
  label, value, onChange, min, max, placeholder,
}: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; placeholder?: string }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        placeholder={placeholder}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Property panel for action/trigger node configuration
// ---------------------------------------------------------------------------

function ActionPropertyPanel({
  node,
  updateConfig,
  botInstances,
}: {
  node: Node;
  updateConfig: (key: string, value: unknown) => void;
  botInstances: BotInstance[];
}) {
  const nodeType = String(node.data.nodeType ?? "");
  const config = (node.data.config as Record<string, unknown>) ?? {};
  const cfg = (key: string, fallback: unknown = "") => config[key] ?? fallback;

  switch (nodeType) {
    // ----- Messaging -----
    case "send_message":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} placeholder="{{trigger.chatId}}" />
          <TextareaInput label="Text" value={String(cfg("text"))} onChange={(v) => updateConfig("text", v)} placeholder="Hello {{trigger.userName}}!" rows={4} />
          <SelectInput label="Parse Mode" value={String(cfg("parseMode", "HTML"))} onChange={(v) => updateConfig("parseMode", v)} options={[{ value: "HTML", label: "HTML" }, { value: "MarkdownV2", label: "Markdown V2" }, { value: "", label: "None" }]} />
          <CheckboxInput label="Disable notification" checked={Boolean(cfg("disableNotification", false))} onChange={(v) => updateConfig("disableNotification", v)} />
          <TextInput label="Reply to Message ID" value={String(cfg("replyToMessageId", ""))} onChange={(v) => updateConfig("replyToMessageId", v)} placeholder="Optional" />
        </div>
      );

    case "send_photo":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} placeholder="{{trigger.chatId}}" />
          <TextInput label="Photo URL" value={String(cfg("photoUrl"))} onChange={(v) => updateConfig("photoUrl", v)} placeholder="https://example.com/photo.jpg" />
          <TextareaInput label="Caption" value={String(cfg("caption", ""))} onChange={(v) => updateConfig("caption", v)} placeholder="Optional caption" rows={2} />
          <SelectInput label="Parse Mode" value={String(cfg("parseMode", "HTML"))} onChange={(v) => updateConfig("parseMode", v)} options={[{ value: "HTML", label: "HTML" }, { value: "MarkdownV2", label: "Markdown V2" }, { value: "", label: "None" }]} />
        </div>
      );

    case "forward_message":
      return (
        <div className="space-y-3">
          <TextInput label="From Chat ID" value={String(cfg("fromChatId"))} onChange={(v) => updateConfig("fromChatId", v)} placeholder="{{trigger.chatId}}" />
          <TextInput label="To Chat ID" value={String(cfg("toChatId"))} onChange={(v) => updateConfig("toChatId", v)} placeholder="Target chat ID" />
          <TextInput label="Message ID" value={String(cfg("messageId", ""))} onChange={(v) => updateConfig("messageId", v)} placeholder="{{trigger.messageId}}" />
        </div>
      );

    case "copy_message":
      return (
        <div className="space-y-3">
          <TextInput label="From Chat ID" value={String(cfg("fromChatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("fromChatId", v)} />
          <TextInput label="To Chat ID" value={String(cfg("toChatId"))} onChange={(v) => updateConfig("toChatId", v)} placeholder="Target chat ID" />
          <TextInput label="Message ID" value={String(cfg("messageId", ""))} onChange={(v) => updateConfig("messageId", v)} placeholder="{{trigger.messageId}}" />
        </div>
      );

    case "edit_message":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} />
          <TextInput label="Message ID" value={String(cfg("messageId"))} onChange={(v) => updateConfig("messageId", v)} placeholder="{{trigger.messageId}}" />
          <TextareaInput label="New Text" value={String(cfg("text"))} onChange={(v) => updateConfig("text", v)} placeholder="Updated message text" rows={3} />
          <SelectInput label="Parse Mode" value={String(cfg("parseMode", "HTML"))} onChange={(v) => updateConfig("parseMode", v)} options={[{ value: "HTML", label: "HTML" }, { value: "MarkdownV2", label: "Markdown V2" }, { value: "", label: "None" }]} />
        </div>
      );

    case "delete_message":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} />
          <TextInput label="Message ID" value={String(cfg("messageId"))} onChange={(v) => updateConfig("messageId", v)} placeholder="{{trigger.messageId}}" />
        </div>
      );

    case "pin_message":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} />
          <TextInput label="Message ID" value={String(cfg("messageId"))} onChange={(v) => updateConfig("messageId", v)} placeholder="{{trigger.messageId}}" />
          <CheckboxInput label="Disable notification" checked={Boolean(cfg("disableNotification", false))} onChange={(v) => updateConfig("disableNotification", v)} />
        </div>
      );

    case "unpin_message":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} />
          <TextInput label="Message ID (leave empty to unpin all)" value={String(cfg("messageId", ""))} onChange={(v) => updateConfig("messageId", v)} placeholder="Optional" />
        </div>
      );

    // ----- User Management -----
    case "ban_user":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} />
          <TextInput label="User ID" value={String(cfg("userId", "{{trigger.userId}}"))} onChange={(v) => updateConfig("userId", v)} />
          <TextInput label="Reason" value={String(cfg("reason", ""))} onChange={(v) => updateConfig("reason", v)} placeholder="Optional ban reason" />
        </div>
      );

    case "mute_user":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} />
          <TextInput label="User ID" value={String(cfg("userId", "{{trigger.userId}}"))} onChange={(v) => updateConfig("userId", v)} />
          <NumberInput label="Duration (seconds)" value={Number(cfg("durationSeconds", 3600))} onChange={(v) => updateConfig("durationSeconds", v)} min={0} />
        </div>
      );

    case "restrict_user":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} />
          <TextInput label="User ID" value={String(cfg("userId", "{{trigger.userId}}"))} onChange={(v) => updateConfig("userId", v)} />
          <NumberInput label="Duration (seconds, 0 = forever)" value={Number(cfg("untilDate", 0))} onChange={(v) => updateConfig("untilDate", v)} min={0} />
          <FieldLabel>Permissions</FieldLabel>
          <div className="space-y-1 pl-1">
            {["canSendMessages", "canSendMedia", "canSendPolls", "canSendOther", "canAddWebPagePreviews", "canChangeInfo", "canInviteUsers", "canPinMessages"].map((perm) => (
              <CheckboxInput
                key={perm}
                label={perm.replace(/^can/, "Can ").replace(/([A-Z])/g, " $1").trim()}
                checked={Boolean(((cfg("permissions", {}) as Record<string, boolean>)[perm]) ?? false)}
                onChange={(v) => {
                  const current = (cfg("permissions", {}) as Record<string, boolean>);
                  updateConfig("permissions", { ...current, [perm]: v });
                }}
              />
            ))}
          </div>
        </div>
      );

    case "promote_user":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} />
          <TextInput label="User ID" value={String(cfg("userId", "{{trigger.userId}}"))} onChange={(v) => updateConfig("userId", v)} />
          <FieldLabel>Admin Privileges</FieldLabel>
          <div className="space-y-1 pl-1">
            {["canManageChat", "canDeleteMessages", "canManageVideoChats", "canRestrictMembers", "canPromoteMembers", "canChangeInfo", "canInviteUsers", "canPinMessages"].map((priv) => (
              <CheckboxInput
                key={priv}
                label={priv.replace(/^can/, "Can ").replace(/([A-Z])/g, " $1").trim()}
                checked={Boolean(((cfg("privileges", {}) as Record<string, boolean>)[priv]) ?? false)}
                onChange={(v) => {
                  const current = (cfg("privileges", {}) as Record<string, boolean>);
                  updateConfig("privileges", { ...current, [priv]: v });
                }}
              />
            ))}
          </div>
        </div>
      );

    // ----- Interactive -----
    case "create_poll":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} />
          <TextInput label="Question" value={String(cfg("question"))} onChange={(v) => updateConfig("question", v)} placeholder="What do you think?" />
          <TextareaInput
            label="Options (one per line)"
            value={Array.isArray(cfg("options")) ? (cfg("options") as string[]).join("\n") : String(cfg("options", ""))}
            onChange={(v) => updateConfig("options", v.split("\n").filter(Boolean))}
            placeholder={"Option 1\nOption 2\nOption 3"}
            rows={4}
          />
          <SelectInput label="Poll Type" value={String(cfg("pollType", "regular"))} onChange={(v) => updateConfig("pollType", v)} options={[{ value: "regular", label: "Regular" }, { value: "quiz", label: "Quiz" }]} />
          <CheckboxInput label="Anonymous" checked={Boolean(cfg("isAnonymous", true))} onChange={(v) => updateConfig("isAnonymous", v)} />
          <CheckboxInput label="Multiple answers" checked={Boolean(cfg("allowsMultipleAnswers", false))} onChange={(v) => updateConfig("allowsMultipleAnswers", v)} />
        </div>
      );

    case "answer_callback_query":
      return (
        <div className="space-y-3">
          <TextInput label="Callback Query ID" value={String(cfg("callbackQueryId", "{{trigger.callbackQueryId}}"))} onChange={(v) => updateConfig("callbackQueryId", v)} />
          <TextInput label="Response Text" value={String(cfg("text", ""))} onChange={(v) => updateConfig("text", v)} placeholder="Optional toast message" />
          <CheckboxInput label="Show alert popup" checked={Boolean(cfg("showAlert", false))} onChange={(v) => updateConfig("showAlert", v)} />
          <TextInput label="URL" value={String(cfg("url", ""))} onChange={(v) => updateConfig("url", v)} placeholder="Optional redirect URL" />
        </div>
      );

    // ----- New Messaging Actions -----
    case "send_video":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} placeholder="{{trigger.chatId}}" />
          <TextInput label="Video URL" value={String(cfg("videoUrl"))} onChange={(v) => updateConfig("videoUrl", v)} placeholder="https://example.com/video.mp4" />
          <TextareaInput label="Caption" value={String(cfg("caption", ""))} onChange={(v) => updateConfig("caption", v)} placeholder="Optional caption" rows={2} />
          <SelectInput label="Parse Mode" value={String(cfg("parseMode", "HTML"))} onChange={(v) => updateConfig("parseMode", v)} options={[{ value: "HTML", label: "HTML" }, { value: "MarkdownV2", label: "Markdown V2" }, { value: "", label: "None" }]} />
          <NumberInput label="Duration (seconds)" value={Number(cfg("duration", 0))} onChange={(v) => updateConfig("duration", v)} min={0} />
          <CheckboxInput label="Supports streaming" checked={Boolean(cfg("supportsStreaming", true))} onChange={(v) => updateConfig("supportsStreaming", v)} />
        </div>
      );

    case "send_document":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} placeholder="{{trigger.chatId}}" />
          <TextInput label="Document URL" value={String(cfg("documentUrl"))} onChange={(v) => updateConfig("documentUrl", v)} placeholder="https://example.com/file.pdf" />
          <TextInput label="File Name" value={String(cfg("fileName", ""))} onChange={(v) => updateConfig("fileName", v)} placeholder="Optional display name" />
          <TextareaInput label="Caption" value={String(cfg("caption", ""))} onChange={(v) => updateConfig("caption", v)} placeholder="Optional caption" rows={2} />
          <SelectInput label="Parse Mode" value={String(cfg("parseMode", "HTML"))} onChange={(v) => updateConfig("parseMode", v)} options={[{ value: "HTML", label: "HTML" }, { value: "MarkdownV2", label: "Markdown V2" }, { value: "", label: "None" }]} />
        </div>
      );

    case "send_sticker":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} placeholder="{{trigger.chatId}}" />
          <TextInput label="Sticker (file_id or URL)" value={String(cfg("sticker"))} onChange={(v) => updateConfig("sticker", v)} placeholder="CAACAgIAAxkBAAI..." />
        </div>
      );

    case "send_location":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} placeholder="{{trigger.chatId}}" />
          <NumberInput label="Latitude" value={Number(cfg("latitude", 0))} onChange={(v) => updateConfig("latitude", v)} />
          <NumberInput label="Longitude" value={Number(cfg("longitude", 0))} onChange={(v) => updateConfig("longitude", v)} />
          <NumberInput label="Live Period (seconds, 0 = static)" value={Number(cfg("livePeriod", 0))} onChange={(v) => updateConfig("livePeriod", v)} min={0} max={86400} />
        </div>
      );

    case "send_voice":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} placeholder="{{trigger.chatId}}" />
          <TextInput label="Voice URL" value={String(cfg("voiceUrl"))} onChange={(v) => updateConfig("voiceUrl", v)} placeholder="https://example.com/voice.ogg" />
          <TextareaInput label="Caption" value={String(cfg("caption", ""))} onChange={(v) => updateConfig("caption", v)} placeholder="Optional caption" rows={2} />
          <NumberInput label="Duration (seconds)" value={Number(cfg("duration", 0))} onChange={(v) => updateConfig("duration", v)} min={0} />
        </div>
      );

    case "send_contact":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} placeholder="{{trigger.chatId}}" />
          <TextInput label="Phone Number" value={String(cfg("phoneNumber"))} onChange={(v) => updateConfig("phoneNumber", v)} placeholder="+1234567890" />
          <TextInput label="First Name" value={String(cfg("firstName"))} onChange={(v) => updateConfig("firstName", v)} placeholder="John" />
          <TextInput label="Last Name" value={String(cfg("lastName", ""))} onChange={(v) => updateConfig("lastName", v)} placeholder="Optional" />
        </div>
      );

    case "set_chat_title":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} placeholder="{{trigger.chatId}}" />
          <TextInput label="New Title" value={String(cfg("title"))} onChange={(v) => updateConfig("title", v)} placeholder="New chat title (max 128 chars)" />
        </div>
      );

    case "set_chat_description":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} placeholder="{{trigger.chatId}}" />
          <TextareaInput label="Description" value={String(cfg("description"))} onChange={(v) => updateConfig("description", v)} placeholder="New chat description (max 255 chars)" rows={3} />
        </div>
      );

    case "export_invite_link":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} placeholder="{{trigger.chatId}}" />
          <TextInput label="Link Name" value={String(cfg("name", ""))} onChange={(v) => updateConfig("name", v)} placeholder="Optional link name" />
          <NumberInput label="Member Limit (0 = unlimited)" value={Number(cfg("memberLimit", 0))} onChange={(v) => updateConfig("memberLimit", v)} min={0} max={99999} />
          <NumberInput label="Expire (seconds from now, 0 = never)" value={Number(cfg("expireDate", 0))} onChange={(v) => updateConfig("expireDate", v)} min={0} />
        </div>
      );

    case "get_chat_member":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} placeholder="{{trigger.chatId}}" />
          <TextInput label="User ID" value={String(cfg("userId", "{{trigger.userId}}"))} onChange={(v) => updateConfig("userId", v)} />
          <p className="text-[10px] text-muted-foreground">Returns member status and permissions. Use with conditions to check admin status, etc.</p>
        </div>
      );

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Property panel for trigger node configuration
// ---------------------------------------------------------------------------

function TriggerPropertyPanel({
  node,
  updateConfig,
}: {
  node: Node;
  updateConfig: (key: string, value: unknown) => void;
}) {
  const nodeType = String(node.data.nodeType ?? "");
  const config = (node.data.config as Record<string, unknown>) ?? {};
  const cfg = (key: string, fallback: unknown = "") => config[key] ?? fallback;

  switch (nodeType) {
    case "command_received":
      return (
        <div className="space-y-3">
          <TextInput label="Command (e.g. /start)" value={String(cfg("command", ""))} onChange={(v) => updateConfig("command", v)} placeholder="/start" />
          <p className="text-[10px] text-muted-foreground">Leave empty to match any command. Available variables: {"{{trigger.command}}"}, {"{{trigger.args}}"}</p>
        </div>
      );

    case "callback_query":
      return (
        <div className="space-y-3">
          <TextInput label="Callback Data Pattern" value={String(cfg("dataPattern", ""))} onChange={(v) => updateConfig("dataPattern", v)} placeholder="action:confirm" />
          <p className="text-[10px] text-muted-foreground">Filter by callback data. Leave empty to match all button clicks. Available: {"{{trigger.callbackData}}"}, {"{{trigger.callbackQueryId}}"}</p>
        </div>
      );

    case "message_edited":
      return (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground">Triggers when a message is edited. Available: {"{{trigger.text}}"}, {"{{trigger.messageId}}"}</p>
        </div>
      );

    case "user_leaves":
      return (
        <div className="space-y-3">
          <CheckboxInput label="Include kicked users" checked={Boolean(cfg("includeKicked", true))} onChange={(v) => updateConfig("includeKicked", v)} />
          <p className="text-[10px] text-muted-foreground">Available: {"{{trigger.userId}}"}, {"{{trigger.userName}}"}, {"{{trigger.wasKicked}}"}</p>
        </div>
      );

    case "chat_member_updated":
      return (
        <div className="space-y-3">
          <TextInput label="Old Status Filter" value={String(cfg("oldStatus", ""))} onChange={(v) => updateConfig("oldStatus", v)} placeholder="Any (leave empty)" />
          <TextInput label="New Status Filter" value={String(cfg("newStatus", ""))} onChange={(v) => updateConfig("newStatus", v)} placeholder="Any (leave empty)" />
          <p className="text-[10px] text-muted-foreground">Statuses: member, administrator, creator, restricted, left, kicked. Available: {"{{trigger.oldStatus}}"}, {"{{trigger.newStatus}}"}</p>
        </div>
      );

    case "schedule":
      return (
        <div className="space-y-3">
          <TextInput label="Cron Expression" value={String(cfg("cron", ""))} onChange={(v) => updateConfig("cron", v)} placeholder="0 9 * * 1" />
          <p className="text-[10px] text-muted-foreground">Standard cron format: min hour day month weekday</p>
        </div>
      );

    case "webhook":
      return (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground">Triggered via POST to /api/flows/webhook/:flowId. Payload available as {"{{trigger.payload}}"}</p>
        </div>
      );

    case "poll_answer":
      return (
        <div className="space-y-3">
          <TextInput label="Poll ID Filter" value={String(cfg("pollId", ""))} onChange={(v) => updateConfig("pollId", v)} placeholder="Optional: filter by poll ID" />
          <p className="text-[10px] text-muted-foreground">Triggers when a user answers a poll. Available: {"{{trigger.pollId}}"}, {"{{trigger.optionIds}}"}, {"{{trigger.userId}}"}</p>
        </div>
      );

    case "inline_query":
      return (
        <div className="space-y-3">
          <TextInput label="Query Pattern" value={String(cfg("queryPattern", ""))} onChange={(v) => updateConfig("queryPattern", v)} placeholder="Optional regex filter" />
          <p className="text-[10px] text-muted-foreground">Triggers on inline queries. Available: {"{{trigger.query}}"}, {"{{trigger.queryId}}"}, {"{{trigger.offset}}"}</p>
        </div>
      );

    case "my_chat_member":
      return (
        <div className="space-y-3">
          <TextInput label="Old Status Filter" value={String(cfg("oldStatus", ""))} onChange={(v) => updateConfig("oldStatus", v)} placeholder="Any (leave empty)" />
          <TextInput label="New Status Filter" value={String(cfg("newStatus", ""))} onChange={(v) => updateConfig("newStatus", v)} placeholder="Any (leave empty)" />
          <p className="text-[10px] text-muted-foreground">Triggers when the bot{"'"}s own status changes in a chat. Available: {"{{trigger.oldStatus}}"}, {"{{trigger.newStatus}}"}</p>
        </div>
      );

    case "new_chat_title":
      return (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground">Triggers when a chat title is changed. Available: {"{{trigger.title}}"}, {"{{trigger.userId}}"}</p>
        </div>
      );

    case "new_chat_photo":
      return (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground">Triggers when a chat photo is changed. Available: {"{{trigger.userId}}"}</p>
        </div>
      );

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Property panel for condition node configuration (non-expression)
// ---------------------------------------------------------------------------

function ConditionPropertyPanel({
  node,
  updateConfig,
}: {
  node: Node;
  updateConfig: (key: string, value: unknown) => void;
}) {
  const nodeType = String(node.data.nodeType ?? "");
  const config = (node.data.config as Record<string, unknown>) ?? {};
  const cfg = (key: string, fallback: unknown = "") => config[key] ?? fallback;

  switch (nodeType) {
    case "message_type":
      return (
        <div className="space-y-3">
          <FieldLabel>Match Message Types</FieldLabel>
          <div className="space-y-1 pl-1">
            {["text", "photo", "video", "document", "sticker", "voice", "audio", "animation", "location", "contact", "poll"].map((mt) => (
              <CheckboxInput
                key={mt}
                label={mt}
                checked={Array.isArray(cfg("types")) && (cfg("types") as string[]).includes(mt)}
                onChange={(checked) => {
                  const current = Array.isArray(cfg("types")) ? [...(cfg("types") as string[])] : [];
                  if (checked && !current.includes(mt)) current.push(mt);
                  else if (!checked) {
                    const idx = current.indexOf(mt);
                    if (idx >= 0) current.splice(idx, 1);
                  }
                  updateConfig("types", current);
                }}
              />
            ))}
          </div>
        </div>
      );

    case "chat_type":
      return (
        <div className="space-y-3">
          <FieldLabel>Match Chat Types</FieldLabel>
          <div className="space-y-1 pl-1">
            {["private", "group", "supergroup", "channel"].map((ct) => (
              <CheckboxInput
                key={ct}
                label={ct}
                checked={Array.isArray(cfg("types")) && (cfg("types") as string[]).includes(ct)}
                onChange={(checked) => {
                  const current = Array.isArray(cfg("types")) ? [...(cfg("types") as string[])] : [];
                  if (checked && !current.includes(ct)) current.push(ct);
                  else if (!checked) {
                    const idx = current.indexOf(ct);
                    if (idx >= 0) current.splice(idx, 1);
                  }
                  updateConfig("types", current);
                }}
              />
            ))}
          </div>
        </div>
      );

    case "regex_match":
      return (
        <div className="space-y-3">
          <TextInput label="Regex Pattern" value={String(cfg("pattern"))} onChange={(v) => updateConfig("pattern", v)} placeholder="\\d{4,}" />
          <TextInput label="Flags" value={String(cfg("flags", "i"))} onChange={(v) => updateConfig("flags", v)} placeholder="i" />
          <p className="text-[10px] text-muted-foreground">Tests against {"{{trigger.text}}"}. Common flags: i (case-insensitive), g (global), m (multiline)</p>
        </div>
      );

    case "has_media":
      return (
        <div className="space-y-3">
          <FieldLabel>Filter by media type (optional)</FieldLabel>
          <div className="space-y-1 pl-1">
            {["photo", "video", "document", "sticker", "voice", "audio", "animation"].map((mt) => (
              <CheckboxInput
                key={mt}
                label={mt}
                checked={Array.isArray(cfg("mediaTypes")) && (cfg("mediaTypes") as string[]).includes(mt)}
                onChange={(checked) => {
                  const current = Array.isArray(cfg("mediaTypes")) ? [...(cfg("mediaTypes") as string[])] : [];
                  if (checked && !current.includes(mt)) current.push(mt);
                  else if (!checked) {
                    const idx = current.indexOf(mt);
                    if (idx >= 0) current.splice(idx, 1);
                  }
                  updateConfig("mediaTypes", current);
                }}
              />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">Leave all unchecked to match any media</p>
        </div>
      );

    case "user_is_admin":
      return (
        <div className="space-y-3">
          <TextInput label="Chat ID" value={String(cfg("chatId", "{{trigger.chatId}}"))} onChange={(v) => updateConfig("chatId", v)} />
          <TextInput label="User ID" value={String(cfg("userId", "{{trigger.userId}}"))} onChange={(v) => updateConfig("userId", v)} />
          <p className="text-[10px] text-muted-foreground">Checks if the user is an admin or creator in the chat.</p>
        </div>
      );

    case "message_length":
      return (
        <div className="space-y-3">
          <SelectInput label="Operator" value={String(cfg("operator", "less_than"))} onChange={(v) => updateConfig("operator", v)} options={[{ value: "less_than", label: "Less than" }, { value: "greater_than", label: "Greater than" }, { value: "equals", label: "Equals" }, { value: "between", label: "Between" }]} />
          <NumberInput label="Threshold" value={Number(cfg("threshold", 100))} onChange={(v) => updateConfig("threshold", v)} min={0} />
          {String(cfg("operator")) === "between" && (
            <NumberInput label="Max Threshold" value={Number(cfg("maxThreshold", 500))} onChange={(v) => updateConfig("maxThreshold", v)} min={0} />
          )}
        </div>
      );

    case "callback_data_match":
      return (
        <div className="space-y-3">
          <TextInput label="Pattern" value={String(cfg("pattern"))} onChange={(v) => updateConfig("pattern", v)} placeholder="action:*" />
          <SelectInput label="Match Mode" value={String(cfg("matchMode", "exact"))} onChange={(v) => updateConfig("matchMode", v)} options={[{ value: "exact", label: "Exact match" }, { value: "starts_with", label: "Starts with" }, { value: "contains", label: "Contains" }, { value: "regex", label: "Regex" }]} />
        </div>
      );

    case "user_is_bot":
      return (
        <div className="space-y-3">
          <CheckboxInput label="Match bots (uncheck to match non-bots)" checked={Boolean(cfg("matchBots", true))} onChange={(v) => updateConfig("matchBots", v)} />
          <p className="text-[10px] text-muted-foreground">Checks if the triggering user is a bot account.</p>
        </div>
      );

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Discord Action property panel
// ---------------------------------------------------------------------------

function DiscordActionPropertyPanel({
  node,
  updateConfig,
}: {
  node: Node;
  updateConfig: (key: string, value: unknown) => void;
}) {
  const nodeType = String(node.data.nodeType ?? "");
  const config = (node.data.config as Record<string, unknown>) ?? {};
  const cfg = (key: string, fallback: unknown = "") => config[key] ?? fallback;

  switch (nodeType) {
    case "discord_send_message":
      return (
        <div className="space-y-3">
          <TextInput label="Channel ID" value={String(cfg("channelId"))} onChange={(v) => updateConfig("channelId", v)} placeholder="{{trigger.channelId}}" />
          <TextareaInput label="Content" value={String(cfg("content"))} onChange={(v) => updateConfig("content", v)} placeholder="Hello from the bot!" rows={4} />
        </div>
      );

    case "discord_send_embed":
      return (
        <div className="space-y-3">
          <TextInput label="Channel ID" value={String(cfg("channelId"))} onChange={(v) => updateConfig("channelId", v)} placeholder="{{trigger.channelId}}" />
          <TextInput label="Title" value={String(cfg("title"))} onChange={(v) => updateConfig("title", v)} placeholder="Embed title" />
          <TextareaInput label="Description" value={String(cfg("description"))} onChange={(v) => updateConfig("description", v)} placeholder="Embed description" rows={3} />
          <TextInput label="Color (hex)" value={String(cfg("color", "#5865F2"))} onChange={(v) => updateConfig("color", v)} placeholder="#5865F2" />
          <TextareaInput label="Fields (JSON)" value={String(cfg("fields", ""))} onChange={(v) => updateConfig("fields", v)} placeholder={'[{"name":"Field","value":"Value","inline":true}]'} rows={3} />
          <TextInput label="Footer" value={String(cfg("footer", ""))} onChange={(v) => updateConfig("footer", v)} placeholder="Optional footer" />
          <TextInput label="Image URL" value={String(cfg("imageUrl", ""))} onChange={(v) => updateConfig("imageUrl", v)} placeholder="https://example.com/image.png" />
        </div>
      );

    case "discord_send_dm":
      return (
        <div className="space-y-3">
          <TextInput label="User ID" value={String(cfg("userId"))} onChange={(v) => updateConfig("userId", v)} placeholder="{{trigger.userId}}" />
          <TextareaInput label="Content" value={String(cfg("content"))} onChange={(v) => updateConfig("content", v)} placeholder="Direct message content" rows={4} />
        </div>
      );

    case "discord_edit_message":
      return (
        <div className="space-y-3">
          <TextInput label="Channel ID" value={String(cfg("channelId"))} onChange={(v) => updateConfig("channelId", v)} placeholder="{{trigger.channelId}}" />
          <TextInput label="Message ID" value={String(cfg("messageId"))} onChange={(v) => updateConfig("messageId", v)} placeholder="{{trigger.messageId}}" />
          <TextareaInput label="Content" value={String(cfg("content"))} onChange={(v) => updateConfig("content", v)} placeholder="Updated message" rows={3} />
        </div>
      );

    case "discord_delete_message":
      return (
        <div className="space-y-3">
          <TextInput label="Channel ID" value={String(cfg("channelId"))} onChange={(v) => updateConfig("channelId", v)} placeholder="{{trigger.channelId}}" />
          <TextInput label="Message ID" value={String(cfg("messageId"))} onChange={(v) => updateConfig("messageId", v)} placeholder="{{trigger.messageId}}" />
        </div>
      );

    case "discord_add_reaction":
    case "discord_remove_reaction":
      return (
        <div className="space-y-3">
          <TextInput label="Channel ID" value={String(cfg("channelId"))} onChange={(v) => updateConfig("channelId", v)} placeholder="{{trigger.channelId}}" />
          <TextInput label="Message ID" value={String(cfg("messageId"))} onChange={(v) => updateConfig("messageId", v)} placeholder="{{trigger.messageId}}" />
          <TextInput label="Emoji" value={String(cfg("emoji"))} onChange={(v) => updateConfig("emoji", v)} placeholder="👍 or custom emoji ID" />
        </div>
      );

    case "discord_pin_message":
    case "discord_unpin_message":
      return (
        <div className="space-y-3">
          <TextInput label="Channel ID" value={String(cfg("channelId"))} onChange={(v) => updateConfig("channelId", v)} placeholder="{{trigger.channelId}}" />
          <TextInput label="Message ID" value={String(cfg("messageId"))} onChange={(v) => updateConfig("messageId", v)} placeholder="{{trigger.messageId}}" />
        </div>
      );

    case "discord_ban_member":
      return (
        <div className="space-y-3">
          <TextInput label="Guild ID" value={String(cfg("guildId"))} onChange={(v) => updateConfig("guildId", v)} placeholder="{{trigger.guildId}}" />
          <TextInput label="User ID" value={String(cfg("userId"))} onChange={(v) => updateConfig("userId", v)} placeholder="{{trigger.userId}}" />
          <TextInput label="Reason" value={String(cfg("reason", ""))} onChange={(v) => updateConfig("reason", v)} placeholder="Optional ban reason" />
          <NumberInput label="Delete Message Days" value={Number(cfg("deleteMessageDays", 0))} onChange={(v) => updateConfig("deleteMessageDays", v)} min={0} max={7} />
        </div>
      );

    case "discord_kick_member":
      return (
        <div className="space-y-3">
          <TextInput label="Guild ID" value={String(cfg("guildId"))} onChange={(v) => updateConfig("guildId", v)} placeholder="{{trigger.guildId}}" />
          <TextInput label="User ID" value={String(cfg("userId"))} onChange={(v) => updateConfig("userId", v)} placeholder="{{trigger.userId}}" />
          <TextInput label="Reason" value={String(cfg("reason", ""))} onChange={(v) => updateConfig("reason", v)} placeholder="Optional kick reason" />
        </div>
      );

    case "discord_timeout_member":
      return (
        <div className="space-y-3">
          <TextInput label="Guild ID" value={String(cfg("guildId"))} onChange={(v) => updateConfig("guildId", v)} placeholder="{{trigger.guildId}}" />
          <TextInput label="User ID" value={String(cfg("userId"))} onChange={(v) => updateConfig("userId", v)} placeholder="{{trigger.userId}}" />
          <NumberInput label="Duration (ms)" value={Number(cfg("durationMs", 60000))} onChange={(v) => updateConfig("durationMs", v)} min={0} />
          <TextInput label="Reason" value={String(cfg("reason", ""))} onChange={(v) => updateConfig("reason", v)} placeholder="Optional reason" />
        </div>
      );

    case "discord_add_role":
    case "discord_remove_role":
      return (
        <div className="space-y-3">
          <TextInput label="Guild ID" value={String(cfg("guildId"))} onChange={(v) => updateConfig("guildId", v)} placeholder="{{trigger.guildId}}" />
          <TextInput label="User ID" value={String(cfg("userId"))} onChange={(v) => updateConfig("userId", v)} placeholder="{{trigger.userId}}" />
          <TextInput label="Role ID" value={String(cfg("roleId"))} onChange={(v) => updateConfig("roleId", v)} placeholder="Role ID" />
        </div>
      );

    case "discord_create_role":
      return (
        <div className="space-y-3">
          <TextInput label="Guild ID" value={String(cfg("guildId"))} onChange={(v) => updateConfig("guildId", v)} placeholder="{{trigger.guildId}}" />
          <TextInput label="Name" value={String(cfg("name"))} onChange={(v) => updateConfig("name", v)} placeholder="Role name" />
          <TextInput label="Color (hex)" value={String(cfg("color", ""))} onChange={(v) => updateConfig("color", v)} placeholder="#FF0000" />
          <TextInput label="Permissions" value={String(cfg("permissions", ""))} onChange={(v) => updateConfig("permissions", v)} placeholder="Permission bitfield" />
        </div>
      );

    case "discord_set_nickname":
      return (
        <div className="space-y-3">
          <TextInput label="Guild ID" value={String(cfg("guildId"))} onChange={(v) => updateConfig("guildId", v)} placeholder="{{trigger.guildId}}" />
          <TextInput label="User ID" value={String(cfg("userId"))} onChange={(v) => updateConfig("userId", v)} placeholder="{{trigger.userId}}" />
          <TextInput label="Nickname" value={String(cfg("nickname"))} onChange={(v) => updateConfig("nickname", v)} placeholder="New nickname" />
        </div>
      );

    case "discord_create_channel":
      return (
        <div className="space-y-3">
          <TextInput label="Guild ID" value={String(cfg("guildId"))} onChange={(v) => updateConfig("guildId", v)} placeholder="{{trigger.guildId}}" />
          <TextInput label="Name" value={String(cfg("name"))} onChange={(v) => updateConfig("name", v)} placeholder="channel-name" />
          <SelectInput label="Type" value={String(cfg("type", "text"))} onChange={(v) => updateConfig("type", v)} options={[
            { value: "text", label: "Text" },
            { value: "voice", label: "Voice" },
            { value: "category", label: "Category" },
            { value: "forum", label: "Forum" },
            { value: "stage", label: "Stage" },
          ]} />
        </div>
      );

    case "discord_delete_channel":
      return (
        <div className="space-y-3">
          <TextInput label="Channel ID" value={String(cfg("channelId"))} onChange={(v) => updateConfig("channelId", v)} placeholder="Channel ID to delete" />
        </div>
      );

    case "discord_move_member":
      return (
        <div className="space-y-3">
          <TextInput label="Guild ID" value={String(cfg("guildId"))} onChange={(v) => updateConfig("guildId", v)} placeholder="{{trigger.guildId}}" />
          <TextInput label="User ID" value={String(cfg("userId"))} onChange={(v) => updateConfig("userId", v)} placeholder="{{trigger.userId}}" />
          <TextInput label="Voice Channel ID" value={String(cfg("channelId"))} onChange={(v) => updateConfig("channelId", v)} placeholder="Target voice channel" />
        </div>
      );

    case "discord_create_thread":
      return (
        <div className="space-y-3">
          <TextInput label="Channel ID" value={String(cfg("channelId"))} onChange={(v) => updateConfig("channelId", v)} placeholder="{{trigger.channelId}}" />
          <TextInput label="Thread Name" value={String(cfg("name"))} onChange={(v) => updateConfig("name", v)} placeholder="Thread name" />
          <NumberInput label="Auto Archive Duration (min)" value={Number(cfg("autoArchiveDuration", 1440))} onChange={(v) => updateConfig("autoArchiveDuration", v)} min={60} />
        </div>
      );

    case "discord_send_thread_message":
      return (
        <div className="space-y-3">
          <TextInput label="Thread ID" value={String(cfg("threadId"))} onChange={(v) => updateConfig("threadId", v)} placeholder="Thread ID" />
          <TextareaInput label="Content" value={String(cfg("content"))} onChange={(v) => updateConfig("content", v)} placeholder="Thread message" rows={3} />
        </div>
      );

    case "discord_create_invite":
      return (
        <div className="space-y-3">
          <TextInput label="Channel ID" value={String(cfg("channelId"))} onChange={(v) => updateConfig("channelId", v)} placeholder="{{trigger.channelId}}" />
          <NumberInput label="Max Age (seconds, 0 = never)" value={Number(cfg("maxAge", 86400))} onChange={(v) => updateConfig("maxAge", v)} min={0} />
          <NumberInput label="Max Uses (0 = unlimited)" value={Number(cfg("maxUses", 0))} onChange={(v) => updateConfig("maxUses", v)} min={0} />
        </div>
      );

    case "discord_create_scheduled_event":
      return (
        <div className="space-y-3">
          <TextInput label="Guild ID" value={String(cfg("guildId"))} onChange={(v) => updateConfig("guildId", v)} placeholder="{{trigger.guildId}}" />
          <TextInput label="Name" value={String(cfg("name"))} onChange={(v) => updateConfig("name", v)} placeholder="Event name" />
          <TextareaInput label="Description" value={String(cfg("description", ""))} onChange={(v) => updateConfig("description", v)} placeholder="Event description" rows={2} />
          <TextInput label="Scheduled Start Time" value={String(cfg("scheduledStartTime"))} onChange={(v) => updateConfig("scheduledStartTime", v)} placeholder="ISO 8601 datetime" />
          <TextInput label="Scheduled End Time" value={String(cfg("scheduledEndTime", ""))} onChange={(v) => updateConfig("scheduledEndTime", v)} placeholder="ISO 8601 datetime (optional)" />
          <SelectInput label="Entity Type" value={String(cfg("entityType", "VOICE"))} onChange={(v) => updateConfig("entityType", v)} options={[
            { value: "STAGE_INSTANCE", label: "Stage Instance" },
            { value: "VOICE", label: "Voice" },
            { value: "EXTERNAL", label: "External" },
          ]} />
        </div>
      );

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Discord Trigger property panel
// ---------------------------------------------------------------------------

function DiscordTriggerPropertyPanel({
  node,
  updateConfig,
}: {
  node: Node;
  updateConfig: (key: string, value: unknown) => void;
}) {
  const nodeType = String(node.data.nodeType ?? "");
  const config = (node.data.config as Record<string, unknown>) ?? {};
  const cfg = (key: string, fallback: unknown = "") => config[key] ?? fallback;

  switch (nodeType) {
    case "discord_interaction_create":
      return (
        <div className="space-y-3">
          <TextInput label="Command Name" value={String(cfg("commandName", ""))} onChange={(v) => updateConfig("commandName", v)} placeholder="/mycommand" />
          <TextInput label="Command Description" value={String(cfg("commandDescription", ""))} onChange={(v) => updateConfig("commandDescription", v)} placeholder="What the command does" />
        </div>
      );

    case "discord_message_received":
      return (
        <div className="space-y-3">
          <TextInput label="Channel Filter" value={String(cfg("channelFilter", ""))} onChange={(v) => updateConfig("channelFilter", v)} placeholder="Optional channel ID filter" />
        </div>
      );

    default:
      return (
        <div className="space-y-3">
          <TextInput label="Guild Filter" value={String(cfg("guildFilter", ""))} onChange={(v) => updateConfig("guildFilter", v)} placeholder="Optional guild ID filter" />
          <TextInput label="Channel Filter" value={String(cfg("channelFilter", ""))} onChange={(v) => updateConfig("channelFilter", v)} placeholder="Optional channel ID filter" />
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Discord Condition property panel
// ---------------------------------------------------------------------------

function DiscordConditionPropertyPanel({
  node,
  updateConfig,
}: {
  node: Node;
  updateConfig: (key: string, value: unknown) => void;
}) {
  const nodeType = String(node.data.nodeType ?? "");
  const config = (node.data.config as Record<string, unknown>) ?? {};
  const cfg = (key: string, fallback: unknown = "") => config[key] ?? fallback;

  switch (nodeType) {
    case "discord_has_role":
      return (
        <div className="space-y-3">
          <TextInput label="Role ID" value={String(cfg("roleId"))} onChange={(v) => updateConfig("roleId", v)} placeholder="Role ID to check" />
        </div>
      );

    case "discord_channel_type":
      return (
        <div className="space-y-3">
          <SelectInput label="Channel Type" value={String(cfg("channelType", "text"))} onChange={(v) => updateConfig("channelType", v)} options={[
            { value: "text", label: "Text" },
            { value: "voice", label: "Voice" },
            { value: "forum", label: "Forum" },
            { value: "stage", label: "Stage" },
            { value: "category", label: "Category" },
          ]} />
        </div>
      );

    case "discord_is_bot":
      return (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground">Checks if the triggering user is a bot. No additional configuration needed.</p>
        </div>
      );

    case "discord_message_has_embed":
      return (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground">Checks if the message contains embeds. No additional configuration needed.</p>
        </div>
      );

    case "discord_member_permissions":
      return (
        <div className="space-y-3">
          <TextInput label="Required Permissions" value={String(cfg("requiredPermissions"))} onChange={(v) => updateConfig("requiredPermissions", v)} placeholder="MANAGE_MESSAGES, KICK_MEMBERS" />
          <p className="text-[10px] text-muted-foreground">Comma-separated Discord permission names.</p>
        </div>
      );

    default:
      return null;
  }
}

export default function FlowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const flowId = params.id as string;

  const [flowName, setFlowName] = useState("");
  const [flowStatus, setFlowStatus] = useState("draft");
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [botInstances, setBotInstances] = useState<BotInstance[]>([]);
  const [transportConfig, setTransportConfig] = useState<{ transport: string; botInstanceId?: string; discordBotInstanceId?: string }>({ transport: 'auto' });
  const [flowPlatform, setFlowPlatform] = useState<"telegram" | "discord" | "cross-platform">("telegram");

  // Execution visualization state
  const { executionState, setExecutionState } = useExecutionState();

  useEffect(() => {
    api.getBotInstances().then(setBotInstances).catch(() => {});
  }, []);

  useEffect(() => {
    api.getFlow(flowId).then((flow) => {
      setFlowName(flow.name);
      setFlowStatus(flow.status);
      const loadedNodes = (flow.nodesJson || []) as Node[];
      const loadedEdges = (flow.edgesJson || []) as Edge[];
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setTransportConfig(flow.transportConfig ?? { transport: 'auto' });
      if (flow.platform === 'discord') setFlowPlatform('discord');
      else if (flow.platform === 'cross-platform') setFlowPlatform('cross-platform');
      else setFlowPlatform('telegram');
      setLoaded(true);
    }).catch(() => router.push("/dashboard/flows"));
  }, [flowId]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/reactflow-type");
      const label = e.dataTransfer.getData("application/reactflow-label");
      const category = e.dataTransfer.getData("application/reactflow-category");
      if (!type) return;

      const bounds = (e.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect();
      if (!bounds) return;

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: "default",
        position: {
          x: e.clientX - bounds.left - 75,
          y: e.clientY - bounds.top - 20,
        },
        data: {
          label,
          nodeType: type,
          category,
          config: {},
        },
        style: {
          border: `2px solid ${NODE_TYPES_CONFIG.find((n) => n.type === type)?.color ?? "#888"}`,
          borderRadius: 8,
          padding: 8,
          minWidth: 150,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateFlow(flowId, { nodesJson: nodes, edgesJson: edges, transportConfig, platform: flowPlatform });
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    try {
      const result = await api.activateFlow(flowId);
      setFlowStatus(result.status);
    } catch (e: any) {
      alert(e.message || "Activation failed");
    }
  };

  const handleDeactivate = async () => {
    const result = await api.deactivateFlow(flowId);
    setFlowStatus(result.status);
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedNodeType = String(selectedNode?.data?.nodeType ?? "");
  const selectedCategory = String(selectedNode?.data?.category ?? "");
  const isConditionNode = selectedCategory === "condition";
  const isBotActionNode = selectedNodeType === "bot_action";
  const isTriggerNode = selectedCategory === "trigger";
  const isConfigurableAction = CONFIGURABLE_ACTIONS.has(selectedNodeType);
  const isDiscordNode = selectedNodeType.startsWith("discord_");
  const isDiscordAction = isDiscordNode && selectedCategory === "action";
  const isDiscordTrigger = isDiscordNode && selectedCategory === "trigger";
  const isDiscordCondition = isDiscordNode && selectedCategory === "condition";

  // New conditions with dedicated panels (not using ExpressionBuilder)
  const hasConditionPanel = ["message_type", "chat_type", "regex_match", "has_media", "user_is_admin", "message_length", "callback_data_match", "user_is_bot"].includes(selectedNodeType);
  // Discord conditions have their own panel
  const hasDiscordConditionPanel = isDiscordCondition;
  // Original conditions use ExpressionBuilder
  const usesExpressionBuilder = isConditionNode && !hasConditionPanel && !hasDiscordConditionPanel;

  const updateNodeConfig = useCallback(
    (key: string, value: unknown) => {
      if (!selectedNodeId) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNodeId
            ? { ...n, data: { ...n.data, config: { ...(n.data.config as Record<string, unknown>), [key]: value } } }
            : n,
        ),
      );
    },
    [selectedNodeId, setNodes],
  );

  const handleExpressionChange = useCallback(
    (expression: ExpressionValue) => {
      if (!selectedNodeId) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNodeId
            ? { ...n, data: { ...n.data, config: { ...(n.data.config as Record<string, unknown>), expression } } }
            : n,
        ),
      );
    },
    [selectedNodeId, setNodes],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Determine if we should show a property panel
  const showPropertyPanel = selectedNode && (
    usesExpressionBuilder || hasConditionPanel || hasDiscordConditionPanel || isBotActionNode || isConfigurableAction || isTriggerNode || isDiscordAction || isDiscordTrigger
  );

  // Apply execution styles to nodes and edges for visualization
  const { styledNodes, styledEdges } = useMemo(() => {
    if (!executionState.execution) {
      return { styledNodes: nodes, styledEdges: edges };
    }
    return applyExecutionStyles(nodes, edges, executionState);
  }, [nodes, edges, executionState]);

  if (!loaded) return <div className="h-screen animate-pulse bg-muted" />;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">{flowName}</h2>
          <Badge variant={flowStatus === "active" ? "default" : "secondary"}>{flowStatus}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <ExecutionToolbar
            flowId={flowId}
            nodes={nodes}
            edges={edges}
            executionState={executionState}
            onExecutionStateChange={setExecutionState}
          />
          <div className="mx-1 h-5 w-px bg-border" />
          <Link href={`/dashboard/flows/${flowId}/analytics`}>
            <Button variant="ghost" size="sm"><BarChart3 className="mr-1 h-4 w-4" />Analytics</Button>
          </Link>
          <Link href={`/dashboard/flows/${flowId}/versions`}>
            <Button variant="ghost" size="sm"><History className="mr-1 h-4 w-4" />Versions</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />{saving ? "Saving..." : "Save"}
          </Button>
          {flowStatus !== "active" ? (
            <Button size="sm" onClick={handleActivate}><Play className="mr-1 h-4 w-4" />Activate</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleDeactivate}><Square className="mr-1 h-4 w-4" />Deactivate</Button>
          )}
          {/* Platform & Transport Settings */}
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Platform:</label>
            <select
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              value={flowPlatform}
              onChange={(e) => setFlowPlatform(e.target.value as "telegram" | "discord" | "cross-platform")}
            >
              <option value="telegram">Telegram</option>
              <option value="discord">Discord</option>
              <option value="cross-platform">Cross-Platform</option>
            </select>

            {/* Telegram transport config */}
            {(flowPlatform === 'telegram' || flowPlatform === 'cross-platform') && (
              <>
                <label className="text-xs text-muted-foreground whitespace-nowrap">Transport:</label>
                <select
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                  value={transportConfig.transport}
                  onChange={(e) => setTransportConfig(prev => ({ ...prev, transport: e.target.value }))}
                >
                  <option value="auto">Auto</option>
                  <option value="mtproto">MTProto (User Account)</option>
                  <option value="bot_api">Bot API</option>
                </select>
                {(transportConfig.transport === 'bot_api' || transportConfig.transport === 'auto') && (
                  <select
                    className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                    value={transportConfig.botInstanceId ?? ''}
                    onChange={(e) => setTransportConfig(prev => ({ ...prev, botInstanceId: e.target.value || undefined }))}
                  >
                    <option value="">No TG bot selected</option>
                    {botInstances.filter(b => b.isActive && b.type !== 'discord').map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}{b.botUsername ? ` (@${b.botUsername})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}

            {/* Discord bot config */}
            {(flowPlatform === 'discord' || flowPlatform === 'cross-platform') && (
              <>
                <label className="text-xs text-muted-foreground whitespace-nowrap">Discord Bot:</label>
                <select
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                  value={transportConfig.discordBotInstanceId ?? ''}
                  onChange={(e) => setTransportConfig(prev => ({ ...prev, discordBotInstanceId: e.target.value || undefined }))}
                >
                  <option value="">No Discord bot selected</option>
                  {botInstances.filter(b => b.isActive && b.type === 'discord').map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}{b.botUsername ? ` (${b.botUsername})` : ''}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Canvas + Panels */}
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex flex-1 min-h-0">
        <ExtractedNodePalette onDragStart={() => {}} />
        <div className="flex-1" onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={styledNodes}
            edges={styledEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {/* Unified Property Panel */}
        {showPropertyPanel && selectedNode && (
          <div className="w-80 border-l border-border bg-card p-3 overflow-y-auto">
            <h3 className="mb-3 text-sm font-semibold flex items-center gap-1">
              {isBotActionNode && <Bot className="h-4 w-4" />}
              {String(selectedNode.data.label ?? selectedNodeType)}
            </h3>

            {/* Expression Builder for keyword_match, user_role, time_based */}
            {usesExpressionBuilder && (
              <ExpressionBuilder
                value={(selectedNode.data.config as Record<string, unknown>)?.expression as ExpressionValue | undefined}
                onChange={handleExpressionChange}
              />
            )}

            {/* Dedicated condition panels for new condition types */}
            {hasConditionPanel && (
              <ConditionPropertyPanel node={selectedNode} updateConfig={updateNodeConfig} />
            )}

            {/* Discord condition panels */}
            {hasDiscordConditionPanel && (
              <DiscordConditionPropertyPanel node={selectedNode} updateConfig={updateNodeConfig} />
            )}

            {/* Trigger configuration panels */}
            {isTriggerNode && !isDiscordTrigger && (
              <TriggerPropertyPanel node={selectedNode} updateConfig={updateNodeConfig} />
            )}

            {/* Discord trigger panels */}
            {isDiscordTrigger && (
              <DiscordTriggerPropertyPanel node={selectedNode} updateConfig={updateNodeConfig} />
            )}

            {/* Action configuration panels */}
            {isConfigurableAction && !isBotActionNode && !isDiscordAction && (
              <ActionPropertyPanel node={selectedNode} updateConfig={updateNodeConfig} botInstances={botInstances} />
            )}

            {/* Discord action panels */}
            {isDiscordAction && (
              <DiscordActionPropertyPanel node={selectedNode} updateConfig={updateNodeConfig} />
            )}

            {/* Bot action panel */}
            {isBotActionNode && (
              <div className="space-y-3">
                <div>
                  <FieldLabel>Bot Instance</FieldLabel>
                  <select
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    value={String((selectedNode.data.config as Record<string, unknown>)?.botInstanceId ?? "")}
                    onChange={(e) => updateNodeConfig("botInstanceId", e.target.value)}
                  >
                    <option value="">Select a bot...</option>
                    {botInstances.filter((b) => b.isActive).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}{b.botUsername ? ` (@${b.botUsername})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <SelectInput
                  label="Action"
                  value={String((selectedNode.data.config as Record<string, unknown>)?.action ?? "")}
                  onChange={(v) => updateNodeConfig("action", v)}
                  placeholder="Select action..."
                  options={[
                    { value: "sendMessage", label: "Send Message" },
                    { value: "setCommands", label: "Set Commands" },
                    { value: "sendBroadcast", label: "Send Broadcast" },
                    { value: "moderateUser", label: "Moderate User" },
                    { value: "crossPost", label: "Cross Post" },
                  ]}
                />
                <TextareaInput
                  label="Parameters (JSON)"
                  value={(() => {
                    const params = (selectedNode.data.config as Record<string, unknown>)?.params;
                    if (!params) return "";
                    if (typeof params === "string") return params;
                    return JSON.stringify(params, null, 2);
                  })()}
                  onChange={(v) => {
                    try {
                      const parsed = JSON.parse(v);
                      updateNodeConfig("params", parsed);
                    } catch {
                      updateNodeConfig("params", v);
                    }
                  }}
                  placeholder='{"chatId": "123", "text": "Hello"}'
                  rows={5}
                />
              </div>
            )}
          </div>
        )}
        </div>

        {/* Execution panel (bottom) */}
        <ExecutionPanel executionState={executionState} nodes={nodes} />
      </div>
    </div>
  );
}
