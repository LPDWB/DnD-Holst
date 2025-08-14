"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  addEdge,
  MarkerType,
  useEdgesState,
  useNodesState,
  Connection,
  Edge,
  Node,
  OnConnect,
  ReactFlowInstance,
} from "reactflow";
import CrtNode from "@/components/nodes/CrtNode";
import AndNode from "@/components/nodes/AndNode";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { CRTNodeData } from "@/components/NodeView";
import { Toolbar, CRTEdgeKind, CRTEdgeData } from "@/components/Toolbar";
import { Inspector } from "@/components/Inspector";
import { ImportExportModal } from "@/components/ImportExportModal";
import { useToast } from "@/components/Toast";
import { ValidationPanel } from "@/components/ValidationPanel";
import * as dagre from "dagre";

type CRTNode = Node; // allow mixed node types

type Project = {
  id: string;
  name: string;
  updatedAt: number;
  data: { nodes: CRTNode[]; edges: Edge<CRTEdgeData>[] };
};

const LS_PROJECTS_KEY = "crt_projects_v1";
const LS_ACTIVE_ID_KEY = "crt_active_project_v1";

const nodeTypes = { crt: CrtNode, and: AndNode };

let idSeq = 1;
const nextId = () => `${Date.now().toString(36)}_${idSeq++}`;

const createExampleData = () => {
  const n1: CRTNode = {
    id: nextId(),
    position: { x: 80, y: 80 },
    data: {
      title: "Нежелательный эффект (пример)",
      category: "UDE",
      confidence: 80,
      tags: ["мезонин", "сборка"],
    },
    type: "crt",
  };
  const n2: CRTNode = {
    id: nextId(),
    position: { x: 420, y: 240 },
    data: { title: "Причина (пример)", category: "Cause", confidence: 60 },
    type: "crt",
  };
  const n3: CRTNode = {
    id: nextId(),
    position: { x: 720, y: 420 },
    data: { title: "Корневая причина (пример)", category: "RootCause", confidence: 70 },
    type: "crt",
  };
  return {
    nodes: [n1, n2, n3],
    edges: [
      {
        id: nextId(),
        source: n2.id,
        target: n1.id,
        markerEnd: { type: MarkerType.ArrowClosed },
        data: { kind: "sufficiency" as CRTEdgeKind },
      } as Edge<CRTEdgeData>,
      {
        id: nextId(),
        source: n3.id,
        target: n2.id,
        markerEnd: { type: MarkerType.ArrowClosed },
        data: { kind: "sufficiency" as CRTEdgeKind },
      } as Edge<CRTEdgeData>,
    ],
  };
};

export default function Page() {
  type GraphNodeData = CRTNodeData | Record<string, never>;
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CRTEdgeData>([]);
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);
  const [edgeKind, setEdgeKind] = useState<CRTEdgeKind>("sufficiency");
  const [selection, setSelection] = useState<{ nodes: Node[]; edges: Edge<CRTEdgeData>[] }>({ nodes: [], edges: [] });
  const selectSingle = useCallback(
    (sel: { node?: Node; edge?: Edge<CRTEdgeData> }) => {
      setSelection({ nodes: sel.node ? [sel.node] : [], edges: sel.edge ? [sel.edge] : [] });
    },
    []
  );
  const [contextMenu, setContextMenu] = useState<
    | { x: number; y: number; target: { type: "node" | "edge"; id: string } }
    | null
  >(null);
  const [showValidation, setShowValidation] = useState(false);
  const [showIE, setShowIE] = useState(false);
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [tempName, setTempName] = useState("");

  const graphJson = useMemo(() => JSON.stringify({ nodes, edges }, null, 2), [nodes, edges]);

  const clipboard = useRef<{ nodes: Node[]; edges: Edge<CRTEdgeData>[] }>({ nodes: [], edges: [] });

  // initial/load
  useEffect(() => {
    try {
      const savedProjects = localStorage.getItem(LS_PROJECTS_KEY);
      const savedActive = localStorage.getItem(LS_ACTIVE_ID_KEY);
      if (savedProjects) {
        const parsed = JSON.parse(savedProjects) as Project[];
        setProjects(parsed);
        const active = parsed.find((p) => p.id === savedActive)?.id || parsed[0]?.id;
        if (active) {
          setActiveProjectId(active);
          const proj = parsed.find((p) => p.id === active);
          if (proj) {
            setNodes(proj.data.nodes);
            setEdges(proj.data.edges);
            return;
          }
        }
      }
      let initial = null;
      const old = localStorage.getItem("crt_graph_v1");
      if (old) {
        try {
          const parsed = JSON.parse(old);
          if (parsed.nodes && parsed.edges) {
            initial = parsed;
          }
        } catch {}
      }
      if (!initial) initial = createExampleData();
      const defaultProject: Project = {
        id: nextId(),
        name: "Мой граф 1",
        updatedAt: Date.now(),
        data: initial,
      };
      setProjects([defaultProject]);
      setActiveProjectId(defaultProject.id);
      setNodes(initial.nodes);
      setEdges(initial.edges);
    } catch {}
  }, [setEdges, setNodes]);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(LS_PROJECTS_KEY, JSON.stringify(projects));
      if (activeProjectId) localStorage.setItem(LS_ACTIVE_ID_KEY, activeProjectId);
    } catch {}
  }, [projects, activeProjectId]);

  // autosave
  useEffect(() => {
    if (!activeProjectId) return;
    setProjects((ps) =>
      ps.map((p) =>
        p.id === activeProjectId
          ? { ...p, data: { nodes, edges }, updatedAt: Date.now() }
          : p
      )
    );
  }, [nodes, edges, activeProjectId]);

  const onConnect: OnConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            markerEnd: { type: MarkerType.ArrowClosed },
            data: { kind: edgeKind },
            style: edgeKind === "assumption" ? { strokeDasharray: "6 3" } : {},
          },
          eds
        )
      ),
    [edgeKind, setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!rf) return;
      const payload = event.dataTransfer.getData("application/reactflow");
      if (!payload) return;
      let parsed: { type?: string; category?: CRTNodeData["category"] };
      try {
        parsed = JSON.parse(payload);
      } catch {
        return;
      }
      const position = rf.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      if (parsed.type === "and") {
        const newNode: CRTNode = { id: nextId(), position, data: {}, type: "and" };
        setNodes((nds) => nds.concat(newNode));
      } else if (parsed.category) {
        const category: CRTNodeData["category"] = parsed.category;
        const newNode: CRTNode = {
          id: nextId(),
          position,
          data: { title: "Новый узел", category, confidence: 100 },
          type: "crt",
        };
        setNodes((nds) => nds.concat(newNode));
      }
    },
    [rf, setNodes]
  );

  const onNodeDragStart = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (event.altKey) {
        const clone: Node = {
          ...node,
          id: nextId(),
          position: { x: node.position.x + 20, y: node.position.y + 20 },
        };
        setNodes((nds) => nds.concat(clone));
        setSelection({ nodes: [clone], edges: [] });
      }
    },
    [setNodes]
  );

  const updateNode = useCallback(
    (id: string, data: Partial<CRTNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id && n.type === "crt" ? { ...n, data: { ...n.data, ...data } } : n
        )
      );
    },
    [setNodes]
  );

  const updateEdge = useCallback(
    (id: string, patch: Partial<Edge<CRTEdgeData>>) => {
      setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    },
    [setEdges]
  );

  const deleteNodes = useCallback(
    (ids: string[]) => {
      setNodes((nds) => nds.filter((n) => !ids.includes(n.id)));
      setEdges((eds) => eds.filter((e) => !ids.includes(e.source) && !ids.includes(e.target)));
    },
    [setNodes, setEdges]
  );

  const deleteEdges = useCallback(
    (ids: string[]) => {
      setEdges((eds) => eds.filter((e) => !ids.includes(e.id)));
    },
    [setEdges]
  );

  const onDeleteSelected = useCallback(() => {
    if (selection.nodes.length) {
      deleteNodes(selection.nodes.map((n) => n.id));
    }
    if (selection.edges.length) {
      deleteEdges(selection.edges.map((e) => e.id));
    }
    setSelection({ nodes: [], edges: [] });
  }, [deleteEdges, deleteNodes, selection.edges, selection.nodes]);

  const alignSelected = useCallback(
    (mode: "left" | "centerX" | "right" | "top" | "middle" | "bottom") => {
      const ids = selection.nodes.map((n) => n.id);
      const xs = selection.nodes.map((n) => n.position.x);
      const ys = selection.nodes.map((n) => n.position.y);
      const left = Math.min(...xs);
      const right = Math.max(...xs);
      const top = Math.min(...ys);
      const bottom = Math.max(...ys);
      const centerX = (left + right) / 2;
      const centerY = (top + bottom) / 2;
      setNodes((nds) =>
        nds.map((n) => {
          if (!ids.includes(n.id)) return n;
          const pos = { ...n.position };
          switch (mode) {
            case "left":
              pos.x = left;
              break;
            case "centerX":
              pos.x = centerX;
              break;
            case "right":
              pos.x = right;
              break;
            case "top":
              pos.y = top;
              break;
            case "middle":
              pos.y = centerY;
              break;
            case "bottom":
              pos.y = bottom;
              break;
          }
          return { ...n, position: pos };
        })
      );
    },
    [selection.nodes, setNodes]
  );

  const duplicateNode = useCallback(
    (id: string) => {
      const original = nodes.find((n) => n.id === id);
      if (!original) return;
      const clone: Node = {
        ...original,
        id: nextId(),
        position: { x: original.position.x + 40, y: original.position.y + 40 },
      };
      setNodes((nds) => nds.concat(clone));
    },
    [nodes, setNodes]
  );

  const changeType = useCallback(
    (id: string) => {
      const node = nodes.find((n) => n.id === id);
      if (node && node.type === "crt") {
        const next = window.prompt(
          "Новый тип (UDE, Cause, RootCause, Injection, Note)",
          (node.data as CRTNodeData).category
        );
        if (next) updateNode(id, { category: next as CRTNodeData["category"] });
      }
    },
    [nodes, updateNode]
  );

  const quickTags = useCallback(
    (id: string) => {
      const node = nodes.find((n) => n.id === id);
      if (node && node.type === "crt") {
        const tags = window.prompt("Теги через запятую", (node.data as CRTNodeData).tags?.join(", ") ?? "");
        if (tags !== null)
          updateNode(id, {
            tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          });
      }
    },
    [nodes, updateNode]
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.key === "Backspace" || e.key === "Delete") && (selection.nodes.length || selection.edges.length)) {
        e.preventDefault();
        onDeleteSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const payload = graphJson;
        const blob = new Blob([payload], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `crt_graph_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setShowIE(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        navigator.clipboard.writeText(graphJson);
        toast("Экспорт скопирован");
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        const ids = selection.nodes.map((n) => n.id);
        clipboard.current = {
          nodes: selection.nodes.map((n) => ({ ...n, data: JSON.parse(JSON.stringify(n.data)) })),
          edges: edges
            .filter((ed) => ids.includes(ed.source) && ids.includes(ed.target))
            .map((ed) => ({ ...ed, data: JSON.parse(JSON.stringify(ed.data)) })),
        };
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        const map = new Map<string, string>();
        const newNodes = clipboard.current.nodes.map((n) => {
          const id = nextId();
          map.set(n.id, id);
          return {
            ...n,
            id,
            position: { x: n.position.x + 40, y: n.position.y + 40 },
          };
        });
        const newEdges = clipboard.current.edges.map((e) => ({
          ...e,
          id: nextId(),
          source: map.get(e.source) || e.source,
          target: map.get(e.target) || e.target,
        }));
        if (newNodes.length) setNodes((nds) => nds.concat(newNodes));
        if (newEdges.length) setEdges((eds) => eds.concat(newEdges));
      }
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        setShowValidation((v) => !v);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [edges, graphJson, onDeleteSelected, selection.edges, selection.nodes, setEdges, setNodes, toast]);

  const onImportData = useCallback(
    ({ nodes: n, edges: e }: { nodes: CRTNode[]; edges: Edge<CRTEdgeData>[] }) => {
      setNodes(n);
      setEdges(e);
      setSelection({ nodes: [], edges: [] });
    },
    [setEdges, setNodes]
  );

  const onImportAsNew = useCallback(
    ({ nodes: n, edges: e }: { nodes: CRTNode[]; edges: Edge<CRTEdgeData>[] }) => {
      const proj: Project = {
        id: nextId(),
        name: `Импорт ${projects.length + 1}`,
        updatedAt: Date.now(),
        data: { nodes: n, edges: e },
      };
      setProjects((ps) => ps.concat(proj));
      setActiveProjectId(proj.id);
      setNodes(n);
      setEdges(e);
      setSelection({ nodes: [], edges: [] });
    },
    [projects.length, setEdges, setNodes]
  );

  const onClear = useCallback(() => {
    if (!window.confirm("Точно очистить холст? Действие необратимо.")) return;
    setNodes([]);
    setEdges([]);
    setSelection({ nodes: [], edges: [] });
    toast("Очистка выполнена");
  }, [setEdges, setNodes, toast]);

  const onAutoLayout = useCallback(() => {
    try {
      const g = new dagre.graphlib.Graph();
      g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 80 });
      g.setDefaultEdgeLabel(() => ({}));
      nodes.forEach((n) => g.setNode(n.id, { width: 260, height: 120 }));
      edges.forEach((e) => g.setEdge(e.source, e.target));
      dagre.layout(g);
      const next = nodes.map((n) => {
        const p = g.node(n.id);
        return { ...n, position: { x: p.x - 130, y: p.y - 60 } };
        });
      setNodes(next);
    } catch (err) {
      console.warn("Dagre layout error:", err);
    }
  }, [edges, nodes, setNodes]);

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    const proj = projects.find((p) => p.id === id);
    if (proj) {
      setNodes(proj.data.nodes);
      setEdges(proj.data.edges);
      setSelection({ nodes: [], edges: [] });
    }
  };

  const handleNewProject = () => {
    const data = createExampleData();
    const proj: Project = {
      id: nextId(),
      name: `Мой граф ${projects.length + 1}`,
      updatedAt: Date.now(),
      data,
    };
    setProjects((ps) => ps.concat(proj));
    setActiveProjectId(proj.id);
    setNodes(data.nodes);
    setEdges(data.edges);
    setSelection({ nodes: [], edges: [] });
  };

  const startRename = () => {
    const current = projects.find((p) => p.id === activeProjectId);
    if (!current) return;
    setTempName(current.name);
    setRenaming(true);
  };

  const finishRename = () => {
    if (!renaming || !activeProjectId) return;
    setProjects((ps) => ps.map((p) => (p.id === activeProjectId ? { ...p, name: tempName } : p)));
    setRenaming(false);
  };

  const handleDeleteProject = () => {
    if (projects.length <= 1) {
      window.alert("Нельзя удалить последний проект");
      return;
    }
    if (!window.confirm("Удалить проект?")) return;
    const newProjects = projects.filter((p) => p.id !== activeProjectId);
    const next = newProjects[0];
    setProjects(newProjects);
    if (next) {
      setActiveProjectId(next.id);
      setNodes(next.data.nodes);
      setEdges(next.data.edges);
      setSelection({ nodes: [], edges: [] });
    }
  };

  const handleDuplicateProject = () => {
    const current = projects.find((p) => p.id === activeProjectId);
    if (!current) return;
    const clone: Project = {
      id: nextId(),
      name: `${current.name} копия`,
      updatedAt: Date.now(),
      data: {
        nodes: JSON.parse(JSON.stringify(current.data.nodes)),
        edges: JSON.parse(JSON.stringify(current.data.edges)),
      },
    };
    setProjects((ps) => ps.concat(clone));
    setActiveProjectId(clone.id);
    setNodes(clone.data.nodes);
    setEdges(clone.data.edges);
    setSelection({ nodes: [], edges: [] });
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-neutral-50 to-neutral-200 dark:from-neutral-950 dark:to-neutral-900">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-center py-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border bg-white/70 px-4 py-2 text-sm font-semibold shadow backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/70">
          {renaming ? (
            <input
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={finishRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") finishRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              className="rounded border px-1 text-sm dark:border-neutral-700 dark:bg-neutral-800"
              autoFocus
            />
          ) : (
            <select
              value={activeProjectId ?? ""}
              onChange={(e) => handleSelectProject(e.target.value)}
              className="rounded border px-1 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleNewProject}
            className="rounded border px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-800"
          >
            Новый
          </button>
          <button
            onClick={startRename}
            disabled={!activeProjectId}
            className="rounded border px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-800 disabled:opacity-50"
          >
            Переименовать
          </button>
          <button
            onClick={handleDeleteProject}
            className="rounded border px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-800"
          >
            Удалить
          </button>
        </div>
      </div>
      {selection.nodes.length >= 2 && (
        <div className="pointer-events-auto fixed top-12 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-2xl border bg-white/80 px-3 py-1 text-xs shadow backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/80">
          <button onClick={() => alignSelected("left")} className="px-1">L</button>
          <button onClick={() => alignSelected("centerX")} className="px-1">C</button>
          <button onClick={() => alignSelected("right")} className="px-1">R</button>
          <button onClick={() => alignSelected("top")} className="px-1">T</button>
          <button onClick={() => alignSelected("middle")} className="px-1">M</button>
          <button onClick={() => alignSelected("bottom")} className="px-1">B</button>
        </div>
      )}

      <Toolbar
        edgeKind={edgeKind}
        setEdgeKind={setEdgeKind}
        onClear={onClear}
        onOpenImportExport={() => setShowIE(true)}
        onAutoLayout={onAutoLayout}
        onDuplicateProject={handleDuplicateProject}
      />

      <Inspector
        selection={{ node: selection.nodes[0], edge: selection.edges[0] }}
        updateNode={updateNode}
        updateEdge={updateEdge}
      />
      <ValidationPanel
        open={showValidation}
        setOpen={setShowValidation}
        nodes={nodes}
        edges={edges}
        rf={rf}
        setSelection={selectSingle}
      />

      <div className="h-full w-full">
        <ErrorBoundary>
          <ReactFlow
            nodeTypes={nodeTypes}
            nodes={nodes}
            edges={edges.map((e) => ({ ...e, animated: (e.data as CRTEdgeData | undefined)?.kind === "assumption" }))}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRf}
            fitView
            onDrop={onDrop}
            onDragOver={onDragOver}
            onSelectionChange={(s) =>
              setSelection({ nodes: s.nodes as Node[], edges: s.edges as Edge<CRTEdgeData>[] })
            }
            onNodeContextMenu={(e, n) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, target: { type: "node", id: n.id } });
            }}
            onEdgeContextMenu={(e, ed) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, target: { type: "edge", id: ed.id } });
            }}
            onPaneClick={() => setContextMenu(null)}
            onNodeDragStart={onNodeDragStart}
            selectionOnDrag
            snapToGrid
            snapGrid={[20, 20]}
            proOptions={{ hideAttribution: true }}
          >
            <MiniMap zoomable pannable className="!bg-white/50 dark:!bg-neutral-950/60" />
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          </ReactFlow>
        </ErrorBoundary>
      </div>

      <ImportExportModal
        open={showIE}
        onClose={() => setShowIE(false)}
        graph={graphJson}
        onImport={onImportData}
        onImportAsNew={onImportAsNew}
      />
      {contextMenu && (
        <div
          className="fixed z-50 rounded-md border bg-white text-xs shadow dark:border-neutral-700 dark:bg-neutral-800"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <ul>
            {contextMenu.target.type === "node" && (
              <>
                <li
                  className="cursor-pointer px-2 py-1 hover:bg-neutral-100"
                  onClick={() => {
                    duplicateNode(contextMenu.target.id);
                    setContextMenu(null);
                  }}
                >
                  Дублировать
                </li>
                <li
                  className="cursor-pointer px-2 py-1 hover:bg-neutral-100"
                  onClick={() => {
                    changeType(contextMenu.target.id);
                    setContextMenu(null);
                  }}
                >
                  Изменить тип
                </li>
                <li
                  className="cursor-pointer px-2 py-1 hover:bg-neutral-100"
                  onClick={() => {
                    quickTags(contextMenu.target.id);
                    setContextMenu(null);
                  }}
                >
                  Быстрые теги
                </li>
                <li
                  className="cursor-pointer px-2 py-1 hover:bg-neutral-100"
                  onClick={() => {
                    deleteNodes([contextMenu.target.id]);
                    setContextMenu(null);
                  }}
                >
                  Удалить
                </li>
              </>
            )}
            {contextMenu.target.type === "edge" && (
              <li
                className="cursor-pointer px-2 py-1 hover:bg-neutral-100"
                onClick={() => {
                  deleteEdges([contextMenu.target.id]);
                  setContextMenu(null);
                }}
              >
                Удалить
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
