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

const NODE_TYPES_CONFIG = [
  // Triggers
  { type: "message_received", label: "Message Received", category: "trigger", color: "#22c55e" },
  { type: "user_joins", label: "User Joins", category: "trigger", color: "#22c55e" },
  { type: "user_leaves", label: "User Leaves", category: "trigger", color: "#22c55e" },
  { type: "callback_query", label: "Button Click", category: "trigger", color: "#22c55e" },
  { type: "command_received", label: "Command", category: "trigger", color: "#22c55e" },
  { type: "message_edited", label: "Message Edited", category: "trigger", color: "#22c55e" },
  { type: "chat_member_updated", label: "Member Status", category: "trigger", color: "#22c55e" },
  { type: "schedule", label: "Schedule", category: "trigger", color: "#22c55e" },
  { type: "webhook", label: "Webhook", category: "trigger", color: "#22c55e" },
  { type: "poll_answer", label: "Poll Answer", category: "trigger", color: "#22c55e" },
  { type: "inline_query", label: "Inline Query", category: "trigger", color: "#22c55e" },
  { type: "my_chat_member", label: "Bot Status Change", category: "trigger", color: "#22c55e" },
  { type: "new_chat_title", label: "Chat Title Changed", category: "trigger", color: "#22c55e" },
  { type: "new_chat_photo", label: "Chat Photo Changed", category: "trigger", color: "#22c55e" },
  // Conditions
  { type: "keyword_match", label: "Keyword Match", category: "condition", color: "#eab308" },
  { type: "user_role", label: "User Role", category: "condition", color: "#eab308" },
  { type: "time_based", label: "Time Based", category: "condition", color: "#eab308" },
  { type: "message_type", label: "Message Type", category: "condition", color: "#eab308" },
  { type: "chat_type", label: "Chat Type", category: "condition", color: "#eab308" },
  { type: "regex_match", label: "Regex Match", category: "condition", color: "#eab308" },
  { type: "has_media", label: "Has Media", category: "condition", color: "#eab308" },
  { type: "user_is_admin", label: "Is Admin", category: "condition", color: "#eab308" },
  { type: "message_length", label: "Message Length", category: "condition", color: "#eab308" },
  { type: "callback_data_match", label: "Callback Data", category: "condition", color: "#eab308" },
  { type: "user_is_bot", label: "Is Bot", category: "condition", color: "#eab308" },
  // Actions — messaging
  { type: "send_message", label: "Send Message", category: "action", color: "#3b82f6" },
  { type: "send_photo", label: "Send Photo", category: "action", color: "#3b82f6" },
  { type: "forward_message", label: "Forward Message", category: "action", color: "#3b82f6" },
  { type: "copy_message", label: "Copy Message", category: "action", color: "#3b82f6" },
  { type: "edit_message", label: "Edit Message", category: "action", color: "#3b82f6" },
  { type: "delete_message", label: "Delete Message", category: "action", color: "#ef4444" },
  { type: "pin_message", label: "Pin Message", category: "action", color: "#3b82f6" },
  { type: "unpin_message", label: "Unpin Message", category: "action", color: "#3b82f6" },
  { type: "send_video", label: "Send Video", category: "action", color: "#3b82f6" },
  { type: "send_document", label: "Send Document", category: "action", color: "#3b82f6" },
  { type: "send_sticker", label: "Send Sticker", category: "action", color: "#3b82f6" },
  { type: "send_location", label: "Send Location", category: "action", color: "#3b82f6" },
  { type: "send_voice", label: "Send Voice", category: "action", color: "#3b82f6" },
  { type: "send_contact", label: "Send Contact", category: "action", color: "#3b82f6" },
  { type: "set_chat_title", label: "Set Chat Title", category: "action", color: "#6366f1" },
  { type: "set_chat_description", label: "Set Description", category: "action", color: "#6366f1" },
  { type: "export_invite_link", label: "Invite Link", category: "action", color: "#6366f1" },
  { type: "get_chat_member", label: "Get Member", category: "action", color: "#6366f1" },
  // Actions — user management
  { type: "ban_user", label: "Ban User", category: "action", color: "#ef4444" },
  { type: "mute_user", label: "Mute User", category: "action", color: "#ef4444" },
  { type: "restrict_user", label: "Restrict User", category: "action", color: "#ef4444" },
  { type: "promote_user", label: "Promote User", category: "action", color: "#10b981" },
  // Actions — interactive
  { type: "create_poll", label: "Create Poll", category: "action", color: "#3b82f6" },
  { type: "answer_callback_query", label: "Answer Button", category: "action", color: "#3b82f6" },
  // Actions — utility
  { type: "api_call", label: "API Call", category: "action", color: "#3b82f6" },
  { type: "delay", label: "Delay", category: "action", color: "#8b5cf6" },
  { type: "bot_action", label: "Bot Action", category: "action", color: "#f97316" },
  // Advanced
  { type: "parallel_branch", label: "Parallel Branch", category: "advanced", color: "#a855f7" },
  { type: "db_query", label: "Database Query", category: "advanced", color: "#a855f7" },
  { type: "loop", label: "Loop", category: "advanced", color: "#a855f7" },
  { type: "switch", label: "Switch/Router", category: "advanced", color: "#a855f7" },
  { type: "transform", label: "Transform", category: "advanced", color: "#a855f7" },
];

/** Node types that have a dedicated property panel. */
const CONFIGURABLE_ACTIONS = new Set([
  "send_message", "send_photo", "forward_message", "copy_message", "edit_message",
  "delete_message", "pin_message", "unpin_message", "restrict_user", "promote_user",
  "create_poll", "answer_callback_query", "ban_user", "mute_user",
  "send_video", "send_document", "send_sticker", "send_location",
  "send_voice", "send_contact", "set_chat_title", "set_chat_description",
  "export_invite_link", "get_chat_member",
]);

function NodePalette({ onDragStart }: { onDragStart: (type: string, label: string, category: string) => void }) {
  const categories = ["trigger", "condition", "action", "advanced"];

  return (
    <div className="w-56 border-r border-border bg-card p-3 overflow-y-auto">
      <h3 className="mb-3 text-sm font-semibold">Node Palette</h3>
      {categories.map((cat) => (
        <div key={cat} className="mb-4">
          <h4 className="mb-1 text-xs font-medium uppercase text-muted-foreground">{cat}s</h4>
          <div className="space-y-1">
            {NODE_TYPES_CONFIG.filter((n) => n.category === cat).map((node) => (
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
      ))}
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
      await api.updateFlow(flowId, { nodesJson: nodes, edgesJson: edges });
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

  // New conditions with dedicated panels (not using ExpressionBuilder)
  const hasConditionPanel = ["message_type", "chat_type", "regex_match", "has_media", "user_is_admin", "message_length", "callback_data_match", "user_is_bot"].includes(selectedNodeType);
  // Original conditions use ExpressionBuilder
  const usesExpressionBuilder = isConditionNode && !hasConditionPanel;

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
    usesExpressionBuilder || hasConditionPanel || isBotActionNode || isConfigurableAction || isTriggerNode
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
        </div>
      </div>

      {/* Canvas + Panels */}
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex flex-1 min-h-0">
        <NodePalette onDragStart={() => {}} />
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

            {/* Trigger configuration panels */}
            {isTriggerNode && (
              <TriggerPropertyPanel node={selectedNode} updateConfig={updateNodeConfig} />
            )}

            {/* Action configuration panels */}
            {isConfigurableAction && !isBotActionNode && (
              <ActionPropertyPanel node={selectedNode} updateConfig={updateNodeConfig} botInstances={botInstances} />
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
