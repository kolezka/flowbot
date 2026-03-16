import type { ComponentType } from "react";

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
