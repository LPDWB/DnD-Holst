"use client";
import { CRTNodeCategory } from "./NodeView";

const categoryStyle: Record<CRTNodeCategory, string> = {
  UDE: "from-rose-500 to-red-600",
  Cause: "from-amber-500 to-yellow-600",
  RootCause: "from-sky-500 to-blue-600",
  Injection: "from-emerald-500 to-green-600",
  Note: "from-stone-500 to-neutral-600",
};

const categoryLabel: Record<CRTNodeCategory, string> = {
  UDE: "Нежелательный эффект",
  Cause: "Причина",
  RootCause: "Корневая причина",
  Injection: "Инъекция",
  Note: "Заметка",
};

export type CRTEdgeKind = "sufficiency" | "assumption";
export type CRTEdgeData = { kind: CRTEdgeKind };

export function Toolbar({
  edgeKind,
  setEdgeKind,
  onClear,
  onOpenImportExport,
  onAutoLayout,
  onDuplicateProject,
}: {
  edgeKind: CRTEdgeKind;
  setEdgeKind: (k: CRTEdgeKind) => void;
  onClear: () => void;
  onOpenImportExport: () => void;
  onAutoLayout: () => void;
  onDuplicateProject: () => void;
}) {
  const handleDragStart = (e: React.DragEvent, category: CRTNodeCategory) => {
    e.dataTransfer.setData("application/reactflow", JSON.stringify({ category }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragStartAnd = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/reactflow", JSON.stringify({ type: "and" }));
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="fixed left-3 top-3 z-50 w-64 rounded-2xl border bg-white/80 p-3 shadow-xl backdrop-blur-md dark:bg-neutral-900/80 dark:border-neutral-800">
      <div className="mb-2 text-sm font-semibold uppercase text-neutral-600 dark:text-neutral-300">
        Панель элементов
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["UDE","Cause","RootCause","Injection","Note"] as CRTNodeCategory[]).map((c) => (
          <div
            key={c}
            draggable
            onDragStart={(e) => handleDragStart(e, c)}
            className={`cursor-grab select-none rounded-xl bg-gradient-to-br ${categoryStyle[c]} p-2 text-center text-xs font-bold text-white shadow active:cursor-grabbing`}
            title="Перетащите на холст"
          >
            {categoryLabel[c]}
          </div>
        ))}
        <div
          draggable
          onDragStart={handleDragStartAnd}
          className="cursor-grab select-none rounded-xl bg-neutral-900 p-2 text-center text-xs font-bold text-white shadow active:cursor-grabbing"
          title="Перетащите на холст"
        >
          AND
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <label className="text-xs text-neutral-600 dark:text-neutral-300">Тип связи</label>
        <select
          value={edgeKind}
          onChange={(e) => setEdgeKind(e.target.value as CRTEdgeKind)}
          className="w-36 rounded-lg border border-neutral-300 bg-white p-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="sufficiency">Достаточность (→)</option>
          <option value="assumption">Допущение (╌╌→)</option>
        </select>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={onAutoLayout} className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
          Авто-раскладка
        </button>
        <button onClick={onClear} className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-sm hover:bg-red-50 dark:border-red-800/50 dark:bg-neutral-900 dark:hover:bg-neutral-800">
          Очистить
        </button>
        <button onClick={onOpenImportExport} className="col-span-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
          Импорт/Экспорт
        </button>
        <button onClick={onDuplicateProject} className="col-span-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
          Дубликат проекта
        </button>
      </div>

      <p className="mt-3 text-[10px] leading-tight text-neutral-500 dark:text-neutral-400">
        Подсказка: перетщите тип узла на холст. Соединяйте узлы мышью. Delete — удалить выделенное, Ctrl/Cmd+S — сохранить локально. Ctrl/Cmd+O — импорт/экспорт, Ctrl/Cmd+E — копировать JSON.
      </p>
    </div>
  );
}
