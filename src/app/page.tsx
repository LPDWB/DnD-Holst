"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { CRTNodeData } from "@/components/NodeView";
import { Toolbar, CRTEdgeKind, CRTEdgeData } from "@/components/Toolbar";
import { Inspector } from "@/components/Inspector";
import { ImportExportModal } from "@/components/ImportExportModal";
import { useToast } from "@/components/Toast";
import * as dagre from "dagre";

type CRTNode = Node<CRTNodeData>;

type Project = {
  id: string;
  name: string;
  updatedAt: number;
  data: { nodes: CRTNode[]; edges: Edge<CRTEdgeData>[] };
};

const LS_PROJECTS_KEY = "crt_projects_v1";
const LS_ACTIVE_ID_KEY = "crt_active_project_v1";

const nodeTypes = { crt: CrtNode };

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
  const [nodes, setNodes, onNodesChange] = useNodesState<CRTNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CRTEdgeData>([]);
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);
  const [edgeKind, setEdgeKind] = useState<CRTEdgeKind>("sufficiency");
  const [selection, setSelection] = useState<{ node?: Node<CRTNodeData>; edge?: Edge<CRTEdgeData> }>({});
  const [showIE, setShowIE] = useState(false);
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [tempName, setTempName] = useState("");

  const graphJson = useMemo(() => JSON.stringify({ nodes, edges }, null, 2), [nodes, edges]);

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
      let category: CRTNodeData["category"];
      try {
        ({ category } = JSON.parse(payload) as { category: CRTNodeData["category"] });
      } catch {
        return;
      }
      const position = rf.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const newNode: CRTNode = { id: nextId(), position, data: { title: "Новый узел", category, confidence: 100 }, type: "crt" };
      setNodes((nds) => nds.concat(newNode));
    },
    [rf, setNodes]
  );

  const updateNode = useCallback(
    (id: string, data: Partial<CRTNodeData>) => {
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)));
    },
    [setNodes]
  );

  const updateEdge = useCallback(
    (id: string, patch: Partial<Edge<CRTEdgeData>>) => {
      setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    },
    [setEdges]
  );

  const onDeleteSelected = useCallback(() => {
    if (selection.node) {
      const nodeId = selection.node.id;
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelection({});
    } else if (selection.edge) {
      const edgeId = selection.edge.id;
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      setSelection({});
    }
  }, [selection, setEdges, setNodes]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.key === "Backspace" || e.key === "Delete") && (selection.node || selection.edge)) {
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
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [graphJson, onDeleteSelected, selection.edge, selection.node, toast]);

  const onImportData = useCallback(
    ({ nodes: n, edges: e }: { nodes: CRTNode[]; edges: Edge<CRTEdgeData>[] }) => {
      setNodes(n);
      setEdges(e);
      setSelection({});
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
      setSelection({});
    },
    [projects.length, setEdges, setNodes]
  );

  const onClear = useCallback(() => {
    if (!window.confirm("Точно очистить холст? Действие необратимо.")) return;
    setNodes([]);
    setEdges([]);
    setSelection({});
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
      setSelection({});
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
    setSelection({});
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
      setSelection({});
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
    setSelection({});
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

      <Toolbar
        edgeKind={edgeKind}
        setEdgeKind={setEdgeKind}
        onClear={onClear}
        onOpenImportExport={() => setShowIE(true)}
        onAutoLayout={onAutoLayout}
        onDuplicateProject={handleDuplicateProject}
      />

      <Inspector selection={selection} updateNode={updateNode} updateEdge={updateEdge} />

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
            onSelectionChange={(s) => setSelection({ node: s.nodes[0] as Node<CRTNodeData>, edge: s.edges[0] as Edge<CRTEdgeData> })}
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
    </div>
  );
}
