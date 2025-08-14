"use client";
import { Edge, Node, ReactFlowInstance } from "reactflow";
import { useMemo } from "react";
import type { CRTEdgeData } from "./Toolbar";
import type { CRTNodeData } from "./NodeView";

export type Warning = {
  id: string;
  label: string;
  nodeId?: string;
};

function findCycles(nodes: Node[], edges: Edge<CRTEdgeData>[]): string[][] {
  const adj: Record<string, string[]> = {};
  edges.forEach((e) => {
    (adj[e.source] ||= []).push(e.target);
  });
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];
  const cycles: string[][] = [];
  function dfs(v: string) {
    visited.add(v);
    stack.add(v);
    path.push(v);
    for (const n of adj[v] || []) {
      if (!visited.has(n)) {
        dfs(n);
      } else if (stack.has(n)) {
        const idx = path.indexOf(n);
        if (idx !== -1) cycles.push(path.slice(idx).concat(n));
      }
    }
    stack.delete(v);
    path.pop();
  }
  nodes.forEach((n) => {
    if (!visited.has(n.id)) dfs(n.id);
  });
  return cycles;
}

export function ValidationPanel({
  open,
  setOpen,
  nodes,
  edges,
  rf,
  setSelection,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  nodes: Node[];
  edges: Edge<CRTEdgeData>[];
  rf: ReactFlowInstance | null;
  setSelection: (sel: { node?: Node; edge?: Edge<CRTEdgeData> }) => void;
}) {
  const warnings = useMemo(() => {
    const w: Warning[] = [];
    const inCount: Record<string, number> = {};
    const outCount: Record<string, number> = {};
    edges.forEach((e) => {
      outCount[e.source] = (outCount[e.source] || 0) + 1;
      inCount[e.target] = (inCount[e.target] || 0) + 1;
    });
    nodes.forEach((n) => {
      const inc = inCount[n.id] || 0;
      const out = outCount[n.id] || 0;
      if (inc === 0 && out === 0) {
        w.push({ id: `dangling-${n.id}`, label: `Висячий узел ${n.id}`, nodeId: n.id });
      }
      const data = n.data as CRTNodeData | undefined;
      if (n.type === "crt" && data) {
        if (data.category === "UDE" && inc === 0) {
          w.push({ id: `ude-${n.id}`, label: `UDE без причин (${n.data.title})`, nodeId: n.id });
        }
        if (data.category === "RootCause" && out === 0) {
          w.push({ id: `rc-${n.id}`, label: `RootCause без следствий (${n.data.title})`, nodeId: n.id });
        }
      }
      if (n.type === "and" && inc < 2) {
        w.push({ id: `and-${n.id}`, label: `AND требует ≥2 входов`, nodeId: n.id });
      }
    });
    const cycles = findCycles(nodes, edges);
    cycles.forEach((c, i) => {
      w.push({ id: `cycle-${i}`, label: `Цикл: ${c.join(" → ")}`, nodeId: c[0] });
    });
    return w;
  }, [nodes, edges]);

  const handleFocus = (id?: string) => {
    if (!id) return;
    const node = nodes.find((n) => n.id === id);
    if (node) {
      rf?.setCenter(node.position.x, node.position.y, { zoom: 1.5 });
      setSelection({ node });
    }
  };

  if (!open)
    return (
      <div
        className="fixed bottom-3 right-3 z-50 cursor-pointer rounded-xl border bg-white/80 px-3 py-1 text-xs shadow-md backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/80"
        onClick={() => setOpen(true)}
      >
        Проверка
      </div>
    );

  return (
    <div className="fixed bottom-3 right-3 z-50 w-64 rounded-2xl border bg-white/80 p-3 shadow-xl backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/80">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold uppercase text-neutral-600 dark:text-neutral-300">
        <span>Проверка</span>
        <button className="text-xs" onClick={() => setOpen(false)}>
          ×
        </button>
      </div>
      {warnings.length === 0 ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Нет предупреждений</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {warnings.map((w) => (
            <li
              key={w.id}
              className="cursor-pointer underline"
              onClick={() => handleFocus(w.nodeId)}
            >
              {w.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
