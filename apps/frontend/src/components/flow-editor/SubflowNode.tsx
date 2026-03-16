"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";

interface SubflowNodeData {
  label: string;
  config?: {
    flowId?: string;
    flowName?: string;
    waitForResult?: boolean;
  };
}

export const SubflowNode = memo(
  ({ data }: { data: SubflowNodeData }) => {
    const isSubflow = data.config?.waitForResult === true;

    if (!isSubflow) {
      return (
        <div className="rounded-md border border-border bg-card px-3 py-2 shadow-sm">
          <Handle type="target" position={Position.Top} />
          <div className="text-xs font-medium">{data.label}</div>
          <Handle type="source" position={Position.Bottom} />
        </div>
      );
    }

    return (
      <div className="rounded-lg border-2 border-purple-400 bg-purple-50 px-4 py-3 shadow-sm min-w-[150px]">
        <Handle type="target" position={Position.Top} />
        <div className="flex items-center gap-2">
          <span className="rounded bg-purple-200 px-1 text-[10px] font-bold text-purple-700">
            SUB
          </span>
          <span className="text-sm font-medium">
            {data.config?.flowName ?? "Subflow"}
          </span>
        </div>
        {data.config?.flowId && (
          <div className="mt-1 text-[10px] text-muted-foreground font-mono">
            {data.config.flowId.slice(0, 12)}...
          </div>
        )}
        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  },
);
SubflowNode.displayName = "SubflowNode";
