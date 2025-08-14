"use client";
export type CRTNodeCategory = "UDE" | "Cause" | "RootCause" | "Injection" | "Note";
export type CRTNodeData = {
  title: string;
  description?: string;
  category: CRTNodeCategory;
  confidence?: number; // 0..100
  tags?: string[];
};

const categoryStyle: Record<CRTNodeCategory, string> = {
  UDE: "from-rose-500 to-red-600",
  Cause: "from-amber-500 to-yellow-600",
  RootCause: "from-sky-500 to-blue-600",
  Injection: "from-emerald-500 to-green-600",
  Note: "from-stone-500 to-neutral-600",
};

export function NodeView({ data }: { data: CRTNodeData }) {
  return (
    <div className="min-w-[220px] max-w-[320px] rounded-2xl border border-white/40 bg-white/80 p-3 shadow-lg backdrop-blur-md ring-1 ring-black/5 dark:border-white/10 dark:bg-neutral-900/70">
      <div className={`mb-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white ${categoryStyle[data.category]}`}>
        <span>{data.category}</span>
        {typeof data.confidence === "number" && (
          <span className="rounded bg-white/20 px-1 text-[10px]">{data.confidence}%</span>
        )}
      </div>
      <div className="text-sm font-semibold leading-tight text-neutral-800 dark:text-neutral-100">
        {data.title || "Новый узел"}
      </div>
      {data.description && (
        <div className="mt-1 text-[12px] leading-snug text-neutral-600 dark:text-neutral-300">
          {data.description}
        </div>
      )}
      {data.tags && data.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {data.tags.map((t) => (
            <span key={t} className="rounded-full border border-neutral-200 px-2 py-[2px] text-[10px] text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
