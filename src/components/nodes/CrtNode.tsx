"use client";
import { NodeProps } from "reactflow";
import { NodeView, CRTNodeData } from "@/components/NodeView";

export default function CrtNode({ data }: NodeProps<CRTNodeData>) {
  // Просто оборачиваем NodeView. React Flow сам позиционирует div.
  return <NodeView data={data} />;
}
