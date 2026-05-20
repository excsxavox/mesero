import { Handle, Position, type NodeProps } from "@xyflow/react";

export type StepNodeData = {
  label: string;
  hint: string;
  onPatch?: (patch: Partial<Pick<StepNodeData, "label" | "hint">>) => void;
};

export function StepNode({ id, data, selected }: NodeProps) {
  const d = data as StepNodeData;
  return (
    <div
      className={`min-w-[200px] max-w-[260px] rounded-xl border bg-zinc-900/90 px-3 py-2 shadow-lg backdrop-blur ${
        selected ? "border-amber-400 ring-2 ring-amber-400/40" : "border-zinc-600"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-zinc-400" />
      <div className="text-xs uppercase tracking-wide text-zinc-500">Paso</div>
      <input
        className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm font-semibold text-zinc-100 outline-none focus:border-amber-500"
        value={d.label}
        aria-label={`Título nodo ${id}`}
        onChange={(e) => d.onPatch?.({ label: e.target.value })}
      />
      <textarea
        className="mt-2 w-full resize-none rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-300 outline-none focus:border-amber-500"
        rows={3}
        value={d.hint}
        aria-label={`Instrucción nodo ${id}`}
        onChange={(e) => d.onPatch?.({ hint: e.target.value })}
      />
      <Handle type="source" position={Position.Right} className="!bg-amber-400" />
    </div>
  );
}
