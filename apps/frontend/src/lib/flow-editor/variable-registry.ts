import { type Node, type Edge } from "@xyflow/react";
import { getNodeOutputs } from "@flowbot/flow-shared";

export interface AvailableVariable {
  name: string;
  type: string;
  source: string; // node label or "trigger"
}

export function getAvailableVariables(
  selectedNodeId: string,
  nodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<Edge>,
): ReadonlyArray<AvailableVariable> {
  const variables: AvailableVariable[] = [];
  const visited = new Set<string>();

  function walkUpstream(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const nodeType = String(node.data?.type ?? node.type ?? "");
    const outputs = getNodeOutputs(nodeType);
    const source = String(node.data?.label ?? nodeType);

    for (const output of outputs) {
      variables.push({
        name: `${source}.${output.key}`,
        type: output.type,
        source,
      });
    }

    // Walk upstream via edges pointing to this node
    for (const edge of edges) {
      if (edge.target === nodeId) {
        walkUpstream(edge.source);
      }
    }
  }

  // Start from nodes connected to the selected node
  for (const edge of edges) {
    if (edge.target === selectedNodeId) {
      walkUpstream(edge.source);
    }
  }

  // Always include trigger variables if a trigger node exists upstream
  const triggerNode = nodes.find((n) => {
    const t = String(n.data?.type ?? n.type ?? "");
    return (
      t.includes("received") ||
      t.includes("joined") ||
      t.includes("left") ||
      t === "callback_query"
    );
  });
  if (triggerNode && !visited.has(triggerNode.id)) {
    const nodeType = String(triggerNode.data?.type ?? triggerNode.type ?? "");
    const outputs = getNodeOutputs(nodeType);
    for (const output of outputs) {
      variables.push({
        name: `trigger.${output.key}`,
        type: output.type,
        source: "trigger",
      });
    }
  }

  return variables;
}
