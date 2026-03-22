import type { ComponentType } from "react";
import { createElement } from "react";
import { NodeConfigForm } from "../NodeConfigForm";
import { NODE_FIELD_SCHEMAS } from "@flowbot/flow-shared";

export interface PanelProps {
  nodeId: string;
  nodeType: string;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  flowId: string;
  upstreamNodes: Array<{ id: string; type: string; label: string }>;
}

const panelMap = new Map<string, ComponentType<PanelProps>>();

export function registerPanel(
  nodeType: string,
  component: ComponentType<PanelProps>,
) {
  panelMap.set(nodeType, component);
}

export function getPanel(
  nodeType: string,
): ComponentType<PanelProps> | undefined {
  return panelMap.get(nodeType);
}

export function registerPanels(
  entries: Array<[string, ComponentType<PanelProps>]>,
) {
  for (const [type, component] of entries) {
    panelMap.set(type, component);
  }
}

export function hasPanel(nodeType: string): boolean {
  return panelMap.has(nodeType);
}

/**
 * Returns the custom panel for the given nodeType if one is registered, or a
 * NodeConfigForm-backed default panel driven by NODE_FIELD_SCHEMAS.
 * ContextPanel and RunFlowPanel are registered as custom overrides and remain
 * unaffected by this fallback.
 */
export function getOrDefaultPanel(
  nodeType: string,
): ComponentType<PanelProps> {
  const custom = panelMap.get(nodeType);
  if (custom) return custom;

  const schema = NODE_FIELD_SCHEMAS.find((s) => s.type === nodeType);
  const fields = schema?.fields ?? [];

  const DefaultPanel: ComponentType<PanelProps> = (props: PanelProps) =>
    createElement(NodeConfigForm, {
      fields,
      values: props.config,
      onChange: (key: string, value: unknown) =>
        props.onChange({ ...props.config, [key]: value }),
      availableVariables: props.upstreamNodes.map((n) => ({
        name: `node.${n.id}.output`,
        type: "string",
        source: "node",
      })),
    });

  DefaultPanel.displayName = `DefaultPanel(${nodeType})`;
  return DefaultPanel;
}
