"use client";

import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VariableAutocomplete } from "./VariableAutocomplete";
import { type NodeFieldSchema } from "@flowbot/flow-shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AvailableVariable {
  name: string;
  type: string;
  source: string;
}

/** Variable shape expected by VariableAutocomplete */
interface AutocompleteVariable {
  name: string;
  source: "trigger" | "node" | "context" | "loop";
  description?: string;
}

export interface NodeConfigFormProps {
  fields: ReadonlyArray<NodeFieldSchema>;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  availableVariables?: Array<AvailableVariable>;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateField(field: NodeFieldSchema, value: unknown): string | null {
  if (field.required && (!value || String(value).trim() === "")) {
    return `${field.label} is required`;
  }
  if (field.validation?.pattern && typeof value === "string") {
    if (!new RegExp(field.validation.pattern).test(value)) {
      return `${field.label} format is invalid`;
    }
  }
  if (
    field.validation?.min !== undefined &&
    Number(value) < field.validation.min
  ) {
    return `${field.label} must be at least ${field.validation.min}`;
  }
  if (
    field.validation?.max !== undefined &&
    Number(value) > field.validation.max
  ) {
    return `${field.label} must be at most ${field.validation.max}`;
  }
  return null;
}

/** Coerce AvailableVariable to the shape VariableAutocomplete expects */
function toAutocompleteVariable(v: AvailableVariable): AutocompleteVariable {
  const knownSources = ["trigger", "node", "context", "loop"] as const;
  const source = knownSources.includes(
    v.source as (typeof knownSources)[number],
  )
    ? (v.source as (typeof knownSources)[number])
    : "node";
  return { name: v.name, source };
}

// ---------------------------------------------------------------------------
// Field renderers
// ---------------------------------------------------------------------------

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

interface FieldWrapperProps {
  field: NodeFieldSchema;
  error?: string;
  children: React.ReactNode;
}

function FieldWrapper({ field, error, children }: FieldWrapperProps) {
  return (
    <div className="space-y-1">
      {field.type !== "checkbox" && (
        <Label htmlFor={field.key} className="text-xs font-medium">
          {field.label}
          {field.required && (
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </Label>
      )}
      {children}
      <FieldError message={error} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Permissions grid
// ---------------------------------------------------------------------------

interface PermissionsFieldProps {
  field: NodeFieldSchema;
  value: unknown;
  onChange: (value: Record<string, boolean>) => void;
  error?: string;
}

function PermissionsField({
  field,
  value,
  onChange,
  error,
}: PermissionsFieldProps) {
  const current =
    typeof value === "object" && value !== null
      ? (value as Record<string, boolean>)
      : {};

  const handleToggle = (optionValue: string, checked: boolean) => {
    onChange({ ...current, [optionValue]: checked });
  };

  return (
    <FieldWrapper field={field} error={error}>
      <div className="grid grid-cols-2 gap-2 rounded-md border border-input p-3">
        {(field.options ?? []).map((option) => (
          <div key={option.value} className="flex items-center gap-2">
            <Checkbox
              id={`${field.key}-${option.value}`}
              checked={current[option.value] ?? false}
              onCheckedChange={(checked) =>
                handleToggle(option.value, Boolean(checked))
              }
            />
            <label
              htmlFor={`${field.key}-${option.value}`}
              className="cursor-pointer text-xs"
            >
              {option.label}
            </label>
          </div>
        ))}
      </div>
    </FieldWrapper>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function NodeConfigForm({
  fields,
  values,
  onChange,
  availableVariables = [],
}: NodeConfigFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const autocompleteVars = availableVariables.map(toAutocompleteVariable);

  const handleBlur = useCallback(
    (field: NodeFieldSchema) => {
      const error = validateField(field, values[field.key]);
      setErrors((prev) => {
        if (error === null) {
          const { [field.key]: _removed, ...rest } = prev;
          return rest;
        }
        return { ...prev, [field.key]: error };
      });
    },
    [values],
  );

  const handleChange = useCallback(
    (key: string, value: unknown) => {
      onChange(key, value);
    },
    [onChange],
  );

  /** True when all required fields have no validation error */
  const isValid = fields
    .filter((f) => f.required)
    .every((f) => !errors[f.key]);

  if (fields.length === 0) {
    return (
      <p className="py-2 text-xs text-muted-foreground">
        No configuration required for this node.
      </p>
    );
  }

  return (
    <div className="space-y-4" data-valid={isValid}>
      {fields.map((field) => {
        const rawValue = values[field.key] ?? field.defaultValue ?? "";
        const error = errors[field.key];

        if (field.type === "permissions") {
          return (
            <PermissionsField
              key={field.key}
              field={field}
              value={rawValue}
              onChange={(v) => handleChange(field.key, v)}
              error={error}
            />
          );
        }

        if (field.type === "checkbox") {
          return (
            <div key={field.key} className="flex items-center gap-2">
              <Checkbox
                id={field.key}
                checked={Boolean(rawValue)}
                onCheckedChange={(checked) =>
                  handleChange(field.key, Boolean(checked))
                }
              />
              <Label
                htmlFor={field.key}
                className="cursor-pointer text-xs font-medium"
              >
                {field.label}
              </Label>
            </div>
          );
        }

        if (field.type === "select") {
          return (
            <FieldWrapper key={field.key} field={field} error={error}>
              <Select
                value={String(rawValue)}
                onValueChange={(v) => {
                  handleChange(field.key, v);
                  // Validate immediately on selection change
                  const validationError = validateField(field, v);
                  setErrors((prev) => {
                    if (validationError === null) {
                      const { [field.key]: _removed, ...rest } = prev;
                      return rest;
                    }
                    return { ...prev, [field.key]: validationError };
                  });
                }}
              >
                <SelectTrigger
                  id={field.key}
                  className={
                    error ? "border-destructive focus:ring-destructive" : ""
                  }
                >
                  <SelectValue placeholder={field.placeholder ?? "Select..."} />
                </SelectTrigger>
                <SelectContent>
                  {(field.options ?? []).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrapper>
          );
        }

        if (field.type === "number") {
          return (
            <FieldWrapper key={field.key} field={field} error={error}>
              <Input
                id={field.key}
                type="number"
                value={String(rawValue)}
                placeholder={field.placeholder}
                min={field.validation?.min}
                max={field.validation?.max}
                className={
                  error ? "border-destructive focus-visible:ring-destructive" : ""
                }
                onChange={(e) => handleChange(field.key, e.target.value)}
                onBlur={() => handleBlur(field)}
              />
            </FieldWrapper>
          );
        }

        if (field.type === "textarea") {
          if (field.supportsVariables && autocompleteVars.length > 0) {
            return (
              <FieldWrapper key={field.key} field={field} error={error}>
                <VariableAutocomplete
                  value={String(rawValue)}
                  onChange={(v) => handleChange(field.key, v)}
                  variables={autocompleteVars}
                  multiline
                  placeholder={field.placeholder}
                  className={
                    error
                      ? "w-full rounded-md border border-destructive bg-background px-2 py-1.5 text-sm"
                      : undefined
                  }
                />
              </FieldWrapper>
            );
          }
          return (
            <FieldWrapper key={field.key} field={field} error={error}>
              <Textarea
                id={field.key}
                value={String(rawValue)}
                placeholder={field.placeholder}
                className={
                  error ? "border-destructive focus-visible:ring-destructive" : ""
                }
                onChange={(e) => handleChange(field.key, e.target.value)}
                onBlur={() => handleBlur(field)}
              />
            </FieldWrapper>
          );
        }

        // Default: text
        if (field.supportsVariables && autocompleteVars.length > 0) {
          return (
            <FieldWrapper key={field.key} field={field} error={error}>
              <VariableAutocomplete
                value={String(rawValue)}
                onChange={(v) => handleChange(field.key, v)}
                variables={autocompleteVars}
                placeholder={field.placeholder}
                className={
                  error
                    ? "w-full rounded-md border border-destructive bg-background px-2 py-1.5 text-sm"
                    : undefined
                }
              />
            </FieldWrapper>
          );
        }

        return (
          <FieldWrapper key={field.key} field={field} error={error}>
            <Input
              id={field.key}
              type="text"
              value={String(rawValue)}
              placeholder={field.placeholder}
              className={
                error ? "border-destructive focus-visible:ring-destructive" : ""
              }
              onChange={(e) => handleChange(field.key, e.target.value)}
              onBlur={() => handleBlur(field)}
            />
          </FieldWrapper>
        );
      })}
    </div>
  );
}

export { validateField };
