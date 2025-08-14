"use client";
import { useEffect, useState } from "react";
import { Node, Edge } from "reactflow";
import type { CRTNodeData } from "./NodeView";
import type { CRTEdgeData } from "./Toolbar";
import { useToast } from "./Toast";

export function ImportExportModal({
  open,
  onClose,
  graph,
  onImport,
  onImportAsNew,
}: {
  open: boolean;
  onClose: () => void;
  graph: string;
  onImport: (data: { nodes: Node<CRTNodeData>[]; edges: Edge<CRTEdgeData>[] }) => void;
  onImportAsNew?: (data: { nodes: Node<CRTNodeData>[]; edges: Edge<CRTEdgeData>[] }) => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<"export" | "import">("export");
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setTab("export");
      setText("");
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(graph);
      toast("Экспорт скопирован");
    } catch {}
  };

  const parseText = () => {
    try {
      const parsed = JSON.parse(text);
      if (parsed.nodes && parsed.edges) {
        return parsed as { nodes: Node<CRTNodeData>[]; edges: Edge<CRTEdgeData>[] };
      }
    } catch {}
    return null;
  };

  const handleImport = () => {
    const parsed = parseText();
    if (parsed) {
      onImport(parsed);
      toast("Импорт выполнен");
      onClose();
    } else {
      setError("Некорректный JSON");
      toast("Ошибка импорта");
    }
  };

  const handleImportAsNew = () => {
    const parsed = parseText();
    if (parsed && onImportAsNew) {
      onImportAsNew(parsed);
      toast("Импорт выполнен");
      onClose();
    } else {
      setError("Некорректный JSON");
      toast("Ошибка импорта");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border bg-white p-4 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
        <div className="mb-4 flex border-b dark:border-neutral-700">
          <button
            className={`flex-1 pb-2 text-sm ${tab === "export" ? "border-b-2 font-semibold border-blue-500" : "text-neutral-500"}`}
            onClick={() => setTab("export")}
          >
            Экспорт
          </button>
          <button
            className={`flex-1 pb-2 text-sm ${tab === "import" ? "border-b-2 font-semibold border-blue-500" : "text-neutral-500"}`}
            onClick={() => setTab("import")}
          >
            Импорт
          </button>
        </div>
        {tab === "export" ? (
          <div>
            <textarea
              readOnly
              value={graph}
              className="h-64 w-full rounded border p-2 text-xs font-mono dark:border-neutral-700 dark:bg-neutral-950"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleCopy}
                className="rounded border px-3 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800"
              >
                Скопировать
              </button>
            </div>
          </div>
        ) : (
          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="h-64 w-full rounded border p-2 text-xs font-mono dark:border-neutral-700 dark:bg-neutral-950"
            />
            {error && <div className="mt-1 text-xs text-red-500">{error}</div>}
            <div className="mt-2 flex justify-end gap-2">
              {onImportAsNew && (
                <button
                  onClick={handleImportAsNew}
                  className="rounded border px-3 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                >
                  Импортировать как новый
                </button>
              )}
              <button
                onClick={handleImport}
                className="rounded border px-3 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800"
              >
                Загрузить
              </button>
            </div>
          </div>
        )}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
