import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getFlow, putFlow } from "../../lib/api";
import type { FlowState } from "../../lib/types";
import { StepNode } from "../../components/StepNode";

function normalizeNodes(raw: unknown[]): Node[] {
  return raw.map((n) => {
    const node = n as Node;
    const type = node.type === "default" || !node.type ? "step" : node.type;
    const data = (node.data || {}) as { label?: string; hint?: string };
    return {
      ...node,
      type,
      data: {
        label: data.label ?? "Paso",
        hint: data.hint ?? "",
      },
    };
  });
}

function withHandlers(nodes: Node[], setNodes: ReturnType<typeof useNodesState<Node>>[1]): Node[] {
  return nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      onPatch: (patch: { label?: string; hint?: string }) => {
        setNodes((nds) =>
          nds.map((x) => (x.id === n.id ? { ...x, data: { ...x.data, ...patch } } : x)),
        );
      },
    },
  }));
}

export function FlowPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const f = await getFlow();
        if (cancelled) return;
        const nn = normalizeNodes(f.nodes as unknown[]);
        setNodes(withHandlers(nn, setNodes));
        setEdges((f.edges || []) as Edge[]);
      } catch (e) {
        setStatus(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setEdges, setNodes]);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, animated: true }, eds)),
    [setEdges],
  );

  const nodeTypes = useMemo(() => ({ step: StepNode }), []);

  const addStep = () => {
    const id = `n_${crypto.randomUUID().slice(0, 8)}`;
    setNodes((nds) =>
      withHandlers(
        [
          ...nds.map((x) => ({
            ...x,
            data: {
              label: (x.data as { label?: string }).label ?? "",
              hint: (x.data as { hint?: string }).hint ?? "",
            },
          })),
          {
            id,
            type: "step",
            position: { x: 80 + nds.length * 48, y: 80 + nds.length * 36 },
            data: { label: "Nuevo paso", hint: "Describe qué debe hacer el mesero aquí." },
          },
        ],
        setNodes,
      ),
    );
  };

  const save = async () => {
    setStatus("Guardando…");
    try {
      const strip = (list: Node[]) =>
        list.map(({ id, type, position, data }) => ({
          id,
          type,
          position,
          data: {
            label: (data as { label?: string }).label ?? "",
            hint: (data as { hint?: string }).hint ?? "",
          },
        }));
      const payload: FlowState = {
        nodes: strip(nodes),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      };
      await putFlow(payload);
      setStatus("Flujo guardado.");
    } catch (e) {
      setStatus(`Error: ${String(e)}`);
    }
  };

  if (loading) {
    return <div className="p-6 text-zinc-400">Cargando editor…</div>;
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addStep}
          className="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 ring-1 ring-zinc-600 hover:bg-zinc-700"
        >
          Añadir paso
        </button>
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
        >
          Guardar flujo
        </button>
        {status ? <span className="text-sm text-zinc-400">{status}</span> : null}
      </div>
      <div className="min-h-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <MiniMap pannable zoomable className="!bg-zinc-900" />
          <Controls className="!bg-zinc-900 !border-zinc-700 !shadow-none" />
          <Background gap={16} color="#27272a" />
        </ReactFlow>
      </div>
      <p className="text-xs text-zinc-500">
        Conecta los pasos arrastrando desde el punto derecho al izquierdo del siguiente. La IA usa este orden como guía
        conversacional.
      </p>
    </div>
  );
}
