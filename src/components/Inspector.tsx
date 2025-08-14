"use client";
import type { Edge, Node } from "reactflow";
import type { CRTNodeData, CRTNodeCategory } from "./NodeView";
import type { CRTEdgeKind } from "./Toolbar";

type CRTEdgeData = { kind?: CRTEdgeKind };

export function Inspector({
  selection,
  updateNode,
  updateEdge,
}: {
  selection: { node?: Node<CRTNodeData>; edge?: Edge<CRTEdgeData> };
  updateNode: (id: string, data: Partial<CRTNodeData>) => void;
  updateEdge: (id: string, patch: Partial<Edge<CRTEdgeData>>) => void;
}) {
  const node = selection.node;
  const edge = selection.edge;

  return (
    <div className="fixed right-3 top-3 z-50 w-80 rounded-2xl border bg-white/80 p-3 shadow-xl backdrop-blur-md dark:bg-neutral-900/80 dark:border-neutral-800">
      <div className="mb-2 text-sm font-semibold uppercase text-neutral-600 dark:text-neutral-300">Инспектор</div>
      {!node && !edge && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Ничего не выбрано. Кликните узел или связь.</p>
      )}

      {node && (
        <div className="space-y-2">
          <div>
            <label className="block text-[11px] text-neutral-500">Заголовок</label>
            <input
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"
              value={node.data.title}
              onChange={(e) => updateNode(node.id, { title: e.target.value })}
            />
          </div>
          <div>
            <label className="block text:[11px] text-neutral-500">Описание</label>
            <textarea
              className="h-24 w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"
              value={node.data.description ?? ""}
              onChange={(e) => updateNode(node.id, { description: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] text-neutral-500">Категория</label>
            <select
              className="w-40 rounded-lg border border-neutral-300 bg-white p-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
              value={node.data.category}
              onChange={(e) => updateNode(node.id, { category: e.target.value as CRTNodeCategory })}
            >
              <option>UDE</option><option>Cause</option><option>RootCause</option><option>Injection</option><option>Note</option>
            </select>
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] text-neutral-500">Доверие</label>
            <input
              type="range" min={0} max={100} value={node.data.confidence ?? 100}
              onChange={(e) => updateNode(node.id, { confidence: Number(e.target.value) })}
              className="w-40"
            />
            <span className="text-xs text-neutral-600 dark:text-neutral-300">{node.data.confidence ?? 100}%</span>
          </div>
          <div>
            <label className="block text-[11px] text-neutral-500">Теги (через запятую)</label>
            <input
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"
              value={node.data.tags?.join(", ") ?? ""}
              onChange={(e) =>
                updateNode(node.id, {
                  tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
            />
          </div>
        </div>
      )}

      {edge && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] text-neutral-500">Тип связи</label>
            <select
              className="w-40 rounded-lg border border-neutral-300 bg-white p-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
              value={edge.data?.kind ?? "sufficiency"}
              onChange={(e) =>
                updateEdge(edge.id, {
                  data: { ...(edge.data ?? {}), kind: e.target.value as CRTEdgeKind },
                  style: (e.target.value as CRTEdgeKind) === "assumption" ? { strokeDasharray: "6 3" } : {},
                })
              }
            >
              <option value="sufficiency">Достаточность</option>
              <option value="assumption">Допущение</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-neutral-500">Метка</label>
            <input
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"
              value={edge.label?.toString() ?? ""}
              onChange={(e) => updateEdge(edge.id, { label: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
