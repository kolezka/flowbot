export interface FlowNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
  style?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  [key: string]: unknown;
}

export type DiffStatus = "added" | "removed" | "modified" | "unchanged";

export interface NodeDiff {
  id: string;
  status: DiffStatus;
  label: string;
  category: string;
  oldNode?: FlowNode;
  newNode?: FlowNode;
  changes?: string[];
}

export interface EdgeDiff {
  id: string;
  status: DiffStatus;
  source: string;
  target: string;
  oldEdge?: FlowEdge;
  newEdge?: FlowEdge;
}

export interface FlowDiffResult {
  nodes: NodeDiff[];
  edges: EdgeDiff[];
  summary: {
    nodesAdded: number;
    nodesRemoved: number;
    nodesModified: number;
    nodesUnchanged: number;
    edgesAdded: number;
    edgesRemoved: number;
    edgesModified: number;
    edgesUnchanged: number;
  };
}

function getNodeLabel(node: FlowNode): string {
  if (node.data && typeof node.data === "object") {
    const label = (node.data as Record<string, unknown>).label;
    if (typeof label === "string") return label;
  }
  return node.type || node.id;
}

function getNodeCategory(node: FlowNode): string {
  if (node.data && typeof node.data === "object") {
    const category = (node.data as Record<string, unknown>).category;
    if (typeof category === "string") return category;
  }
  return "unknown";
}

function describeNodeChanges(oldNode: FlowNode, newNode: FlowNode): string[] {
  const changes: string[] = [];

  // Position change
  if (
    oldNode.position &&
    newNode.position &&
    (oldNode.position.x !== newNode.position.x ||
      oldNode.position.y !== newNode.position.y)
  ) {
    changes.push("Position moved");
  }

  // Label change
  const oldLabel = getNodeLabel(oldNode);
  const newLabel = getNodeLabel(newNode);
  if (oldLabel !== newLabel) {
    changes.push(`Label: "${oldLabel}" -> "${newLabel}"`);
  }

  // Config change
  const oldConfig = JSON.stringify(
    (oldNode.data as Record<string, unknown>)?.config ?? {}
  );
  const newConfig = JSON.stringify(
    (newNode.data as Record<string, unknown>)?.config ?? {}
  );
  if (oldConfig !== newConfig) {
    changes.push("Configuration changed");
  }

  // Type change
  const oldType =
    (oldNode.data as Record<string, unknown>)?.nodeType ?? oldNode.type;
  const newType =
    (newNode.data as Record<string, unknown>)?.nodeType ?? newNode.type;
  if (oldType !== newType) {
    changes.push(`Type: "${oldType}" -> "${newType}"`);
  }

  if (changes.length === 0) {
    // Generic deep comparison
    const oldStr = JSON.stringify({ ...oldNode, position: undefined });
    const newStr = JSON.stringify({ ...newNode, position: undefined });
    if (oldStr !== newStr) {
      changes.push("Properties changed");
    }
  }

  return changes;
}

export function diffFlowVersions(
  oldNodes: FlowNode[],
  oldEdges: FlowEdge[],
  newNodes: FlowNode[],
  newEdges: FlowEdge[]
): FlowDiffResult {
  const safeOldNodes = Array.isArray(oldNodes) ? oldNodes : [];
  const safeNewNodes = Array.isArray(newNodes) ? newNodes : [];
  const safeOldEdges = Array.isArray(oldEdges) ? oldEdges : [];
  const safeNewEdges = Array.isArray(newEdges) ? newEdges : [];

  const oldNodeMap = new Map(safeOldNodes.map((n) => [n.id, n]));
  const newNodeMap = new Map(safeNewNodes.map((n) => [n.id, n]));

  const nodeDiffs: NodeDiff[] = [];

  // Check for removed and modified nodes
  for (const oldNode of safeOldNodes) {
    const newNode = newNodeMap.get(oldNode.id);
    if (!newNode) {
      nodeDiffs.push({
        id: oldNode.id,
        status: "removed",
        label: getNodeLabel(oldNode),
        category: getNodeCategory(oldNode),
        oldNode,
      });
    } else {
      const changes = describeNodeChanges(oldNode, newNode);
      if (changes.length > 0) {
        nodeDiffs.push({
          id: oldNode.id,
          status: "modified",
          label: getNodeLabel(newNode),
          category: getNodeCategory(newNode),
          oldNode,
          newNode,
          changes,
        });
      } else {
        nodeDiffs.push({
          id: oldNode.id,
          status: "unchanged",
          label: getNodeLabel(oldNode),
          category: getNodeCategory(oldNode),
          oldNode,
          newNode,
        });
      }
    }
  }

  // Check for added nodes
  for (const newNode of safeNewNodes) {
    if (!oldNodeMap.has(newNode.id)) {
      nodeDiffs.push({
        id: newNode.id,
        status: "added",
        label: getNodeLabel(newNode),
        category: getNodeCategory(newNode),
        newNode,
      });
    }
  }

  // Edge diff
  const oldEdgeMap = new Map(safeOldEdges.map((e) => [e.id, e]));
  const newEdgeMap = new Map(safeNewEdges.map((e) => [e.id, e]));

  const edgeDiffs: EdgeDiff[] = [];

  for (const oldEdge of safeOldEdges) {
    const newEdge = newEdgeMap.get(oldEdge.id);
    if (!newEdge) {
      edgeDiffs.push({
        id: oldEdge.id,
        status: "removed",
        source: oldEdge.source,
        target: oldEdge.target,
        oldEdge,
      });
    } else {
      const changed =
        oldEdge.source !== newEdge.source ||
        oldEdge.target !== newEdge.target ||
        oldEdge.sourceHandle !== newEdge.sourceHandle ||
        oldEdge.targetHandle !== newEdge.targetHandle;
      edgeDiffs.push({
        id: oldEdge.id,
        status: changed ? "modified" : "unchanged",
        source: newEdge.source,
        target: newEdge.target,
        oldEdge,
        newEdge,
      });
    }
  }

  for (const newEdge of safeNewEdges) {
    if (!oldEdgeMap.has(newEdge.id)) {
      edgeDiffs.push({
        id: newEdge.id,
        status: "added",
        source: newEdge.source,
        target: newEdge.target,
        newEdge,
      });
    }
  }

  return {
    nodes: nodeDiffs,
    edges: edgeDiffs,
    summary: {
      nodesAdded: nodeDiffs.filter((n) => n.status === "added").length,
      nodesRemoved: nodeDiffs.filter((n) => n.status === "removed").length,
      nodesModified: nodeDiffs.filter((n) => n.status === "modified").length,
      nodesUnchanged: nodeDiffs.filter((n) => n.status === "unchanged").length,
      edgesAdded: edgeDiffs.filter((e) => e.status === "added").length,
      edgesRemoved: edgeDiffs.filter((e) => e.status === "removed").length,
      edgesModified: edgeDiffs.filter((e) => e.status === "modified").length,
      edgesUnchanged: edgeDiffs.filter((e) => e.status === "unchanged").length,
    },
  };
}
