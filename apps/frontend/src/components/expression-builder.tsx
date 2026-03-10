"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface Condition {
  id: string;
  field: string;
  operator: "equals" | "contains" | "regex" | "gt" | "lt";
  value: string;
}

export interface ConditionGroup {
  id: string;
  logic: "AND" | "OR";
  conditions: Condition[];
}

export interface ExpressionValue {
  logic: "AND" | "OR";
  groups: ConditionGroup[];
}

const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "contains", label: "Contains" },
  { value: "regex", label: "Regex" },
  { value: "gt", label: "Greater than" },
  { value: "lt", label: "Less than" },
] as const;

const DEFAULT_FIELDS = [
  "trigger.userId",
  "trigger.chatId",
  "trigger.text",
  "trigger.userRole",
  "trigger.messageId",
];

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function ConditionRow({
  condition,
  fields,
  onChange,
  onRemove,
}: {
  condition: Condition;
  fields: string[];
  onChange: (updated: Condition) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={condition.field}
        onValueChange={(val) => onChange({ ...condition, field: val })}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Field" />
        </SelectTrigger>
        <SelectContent>
          {fields.map((f) => (
            <SelectItem key={f} value={f}>
              {f}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={condition.operator}
        onValueChange={(val) =>
          onChange({ ...condition, operator: val as Condition["operator"] })
        }
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Operator" />
        </SelectTrigger>
        <SelectContent>
          {OPERATORS.map((op) => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        className="flex-1"
        placeholder="Value"
        value={condition.value}
        onChange={(e) => onChange({ ...condition, value: e.target.value })}
      />

      <Button variant="ghost" size="sm" onClick={onRemove} className="text-destructive">
        Remove
      </Button>
    </div>
  );
}

function GroupCard({
  group,
  fields,
  onUpdate,
  onRemove,
}: {
  group: ConditionGroup;
  fields: string[];
  onUpdate: (updated: ConditionGroup) => void;
  onRemove: () => void;
}) {
  const addCondition = () => {
    const newCondition: Condition = {
      id: generateId(),
      field: fields[0] ?? "",
      operator: "equals",
      value: "",
    };
    onUpdate({ ...group, conditions: [...group.conditions, newCondition] });
  };

  const updateCondition = (index: number, updated: Condition) => {
    const next = [...group.conditions];
    next[index] = updated;
    onUpdate({ ...group, conditions: next });
  };

  const removeCondition = (index: number) => {
    onUpdate({
      ...group,
      conditions: group.conditions.filter((_, i) => i !== index),
    });
  };

  const toggleLogic = () => {
    onUpdate({ ...group, logic: group.logic === "AND" ? "OR" : "AND" });
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Group</span>
          <Button variant="outline" size="sm" onClick={toggleLogic} className="h-6 px-2 text-xs">
            {group.logic}
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove} className="text-destructive h-6 px-2 text-xs">
          Remove Group
        </Button>
      </div>

      <div className="space-y-2">
        {group.conditions.map((condition, i) => (
          <div key={condition.id}>
            {i > 0 && (
              <p className="text-xs text-center text-muted-foreground py-1">{group.logic}</p>
            )}
            <ConditionRow
              condition={condition}
              fields={fields}
              onChange={(updated) => updateCondition(i, updated)}
              onRemove={() => removeCondition(i)}
            />
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addCondition} className="w-full">
        + Add Condition
      </Button>
    </div>
  );
}

interface ExpressionBuilderProps {
  value?: ExpressionValue;
  onChange: (value: ExpressionValue) => void;
  fields?: string[];
}

export function ExpressionBuilder({
  value,
  onChange,
  fields = DEFAULT_FIELDS,
}: ExpressionBuilderProps) {
  const expression: ExpressionValue = value ?? {
    logic: "AND",
    groups: [],
  };

  const addGroup = useCallback(() => {
    const newGroup: ConditionGroup = {
      id: generateId(),
      logic: "AND",
      conditions: [
        {
          id: generateId(),
          field: fields[0] ?? "",
          operator: "equals",
          value: "",
        },
      ],
    };
    onChange({
      ...expression,
      groups: [...expression.groups, newGroup],
    });
  }, [expression, fields, onChange]);

  const updateGroup = useCallback(
    (index: number, updated: ConditionGroup) => {
      const next = [...expression.groups];
      next[index] = updated;
      onChange({ ...expression, groups: next });
    },
    [expression, onChange],
  );

  const removeGroup = useCallback(
    (index: number) => {
      onChange({
        ...expression,
        groups: expression.groups.filter((_, i) => i !== index),
      });
    },
    [expression, onChange],
  );

  const toggleTopLogic = useCallback(() => {
    onChange({
      ...expression,
      logic: expression.logic === "AND" ? "OR" : "AND",
    });
  }, [expression, onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Match</span>
          <Button variant="outline" size="sm" onClick={toggleTopLogic} className="h-7 px-3">
            {expression.logic === "AND" ? "ALL groups" : "ANY group"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {expression.groups.map((group, i) => (
          <div key={group.id}>
            {i > 0 && (
              <p className="text-xs text-center text-muted-foreground py-2">
                {expression.logic}
              </p>
            )}
            <GroupCard
              group={group}
              fields={fields}
              onUpdate={(updated) => updateGroup(i, updated)}
              onRemove={() => removeGroup(i)}
            />
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addGroup}>
        + Add Condition Group
      </Button>
    </div>
  );
}
