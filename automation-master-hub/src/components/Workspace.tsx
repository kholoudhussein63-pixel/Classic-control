import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CircuitDoc, NodeInstance, SimResult, Wire, WireEndpoint } from '../types';
import { COMPONENT_MAP } from '../data/componentsData';
import { CircuitNodeView } from './CircuitNodeView';
import type { TipState } from '../types';

export const NODE_W = 208;
export const HEADER_H = 34;
export const ROW_H = 24;
const CANVAS_W = 2600;
const CANVAS_H = 1700;

export const portGeom = (node: NodeInstance, termIdx: number) => {
  const left = termIdx % 2 === 0;
  return {
    x: node.x + (left ? 0 : NODE_W),
    y: node.y + HEADER_H + 8 + termIdx * ROW_H + ROW_H / 2,
    left,
  };
};

const termIdxOf = (node: NodeInstance, term: string) => {
  const def = COMPONENT_MAP[node.typeId];
  return def ? def.terminals.findIndex((t) => t.id === term) : -1;
};

const wireEnd = (circuit: CircuitDoc, ep: WireEndpoint) => {
  const nd = circuit.nodes.find((n) => n.id === ep.node);
  if (!nd) return null;
  const i = termIdxOf(nd, ep.term);
  if (i < 0) return null;
  return portGeom(nd, i);
};

interface Props {
  circuit: CircuitDoc;
  sim: SimResult;
  highlight: string[];
  onMove: (id: string, x: number, y: number) => void;
  onAddWire: (a: WireEndpoint, b: WireEndpoint) => void;
  onRemoveWire: (id: string) => void;
  onRemoveNode: (id: string) => void;
  onOpenInfo: (node: NodeInstance) => void;
  onPatch: (id: string, patch: Partial<NodeInstance['state']>) => void;
  setTip: (t: TipState | null) => void;
}

export function Workspace(props: Props) {
  const { circuit, sim, highlight, onMove, onAddWire, onRemoveWire, onRemoveNode, onOpenInfo, onPatch, setTip } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [pending, setPending] = useState<WireEndpoint | null>(null);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);

  const canvasPoint = useCallback((e: { clientX: number; clientY: number }) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);

  // dragging nodes
  useEffect(() => {
    const mv = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const p = canvasPoint(e);
      onMove(d.id, Math.max(0, Math.round(p.x - d.ox)), Math.max(0, Math.round(p.y - d.oy)));
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
  }, [canvasPoint, onMove]);

  // keyboard delete
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        onRemoveNode(selected);
        setSelected(null);
      }
      if (e.key === 'Escape') setPending(null);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selected, onRemoveNode]);

  const startDrag = (node: NodeInstance, e: React.PointerEvent) => {
    const p = canvasPoint(e);
    dragRef.current = { id: node.id, ox: p.x - node.x, oy: p.y - node.y };
    setSelected(node.id);
  };

  const clickPort = (nodeId: string, term: string) => {
    if (!pending) { setPending({ node: nodeId, term }); return; }
    if (pending.node === nodeId && pending.term === term) { setPending(null); return; }
    onAddWire(pending, { node: nodeId, term });
    setPending(null);
  };

  const pendingPt = pending ? (() => {
    const nd = circuit.nodes.find((n) => n.id === pending.node);
    return nd ? portGeom(nd, termIdxOf(nd, pending.term)) : null;
  })() : null;

  return (
    <div
      ref={scrollRef}
      className="relative h-full w-full overflow-auto grid-bg"
      onPointerMove={(e) => setMouse(canvasPoint(e))}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg === '1') {
          setPending(null); setSelected(null);
        }
      }}
    >
      <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }} data-bg="1">
        {/* wire layer */}
        <svg ref={svgRef} width={CANVAS_W} height={CANVAS_H} className="absolute inset-0" style={{ pointerEvents: 'none' }}>
          {circuit.wires.map((w) => {
            const a = wireEnd(circuit, w.a);
            const b = wireEnd(circuit, w.b);
            if (!a || !b) return null;
            const mx = (a.x + b.x) / 2;
            const d = `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
            const live = !!sim.liveWires[w.id];
            const cls = sim.shortCircuit && live ? 'wire-short' : live ? 'wire-live' : 'wire-dead';
            return (
              <g key={w.id}>
                <path d={d} fill="none" strokeWidth={4.5} className={cls} strokeLinecap="round" />
                <g style={{ pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => onRemoveWire(w.id)}>
                  <circle cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r={7} fill="#0a101c" stroke="#ef4444" strokeWidth={1.2} />
                  <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 + 3.2} textAnchor="middle" fontSize={9} fill="#f87171">✕</text>
                </g>
              </g>
            );
          })}
          {pendingPt && mouse && (
            <line
              x1={pendingPt.x} y1={pendingPt.y} x2={mouse.x} y2={mouse.y}
              stroke="#facc15" strokeWidth={2} strokeDasharray="6 5"
            />
          )}
        </svg>

        {/* node layer */}
        {circuit.nodes.map((nd) => {
          const def = COMPONENT_MAP[nd.typeId];
          if (!def) return null;
          return (
            <CircuitNodeView
              key={nd.id}
              node={nd}
              def={def}
              sim={sim}
              selected={selected === nd.id}
              highlighted={highlight.includes(nd.id)}
              pending={pending}
              onHeaderDown={(e) => startDrag(nd, e)}
              onPortClick={(term) => clickPort(nd.id, term)}
              onOpenInfo={() => onOpenInfo(nd)}
              onRemove={() => onRemoveNode(nd.id)}
              onPatch={(patch) => onPatch(nd.id, patch)}
              setTip={setTip}
            />
          );
        })}

        {circuit.nodes.length === 0 && (
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 text-center text-ink-500">
            <p className="text-xl font-semibold">Empty workspace</p>
            <p className="mt-1 text-sm">Drag components from the palette. Start with a Control Power Supply (L/N).</p>
          </div>
        )}
      </div>

      {pending && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg border border-volt/50 bg-ink-800/95 px-4 py-2 text-xs text-volt shadow-xl">
          Wiring from <b>{pending.node}:{pending.term}</b> — click a second terminal to connect · ESC to cancel
        </div>
      )}
    </div>
  );
}
