import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Factory, Play, Pause, Network, RotateCcw, Trash2, Workflow, LayoutTemplate,
  Calculator as CalcIcon, ShieldAlert, TriangleAlert, ZapOff, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { CircuitDoc, ComponentDef, NodeInstance, NodeState, TipState, WireEndpoint } from './types';
import { COMPONENT_MAP } from './data/componentsData';
import { TEMPLATES, cloneCircuit } from './data/templates';
import type { CircuitTemplate } from './types';
import { simulate, snapshotInLive, stepCircuit, defaultState } from './utils/simulationEngine';
import type { WarmState } from './utils/simulationEngine';
import { Workspace } from './components/Workspace';
import { Palette } from './components/Palette';
import { ValidationPanel } from './components/ValidationPanel';
import { DetailModal } from './components/DetailModal';
import { LadderModal } from './components/LadderModal';
import { Calculator } from './components/Calculator';
import { TemplatesView, applyStepToCircuit } from './components/TemplatesView';

type Tab = 'playground' | 'templates' | 'calculator';
const LS_KEY = 'amh-circuit-v1';

const eq = (a: WireEndpoint, b: WireEndpoint) => a.node === b.node && a.term === b.term;

function loadInitial(): { circuit: CircuitDoc; tpl: string | null } {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d?.circuit?.nodes && d?.circuit?.wires) return d;
    }
  } catch { /* fresh boot */ }
  return { circuit: cloneCircuit(TEMPLATES[0].circuit), tpl: TEMPLATES[0].id };
}

export default function App() {
  const [{ circuit, tpl }, setState] = useState(loadInitial);
  const [tab, setTab] = useState<Tab>('playground');
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [modal, setModal] = useState<{ typeId: string; nodeId?: string } | null>(null);
  const [ladder, setLadder] = useState(false);
  const [tip, setTip] = useState<TipState | null>(null);
  const [highlight, setHighlight] = useState<string[]>([]);
  const [step, setStep] = useState(0);

  const warmRef = useRef<WarmState>({ energized: {}, powered: {} });
  const prevInRef = useRef<Record<string, boolean>>({});
  const wireSeq = useRef(0);

  const setCircuit = useCallback((fn: (c: CircuitDoc) => CircuitDoc) => {
    setState((s) => ({ ...s, circuit: fn(s.circuit) }));
  }, []);

  // ── simulation loop ────────────────────────────────────────────────────────
  const sim = useMemo(
    () => simulate(circuit, { time, warm: warmRef.current }),
    [circuit, time],
  );
  const simRef = useRef(sim);
  simRef.current = sim;

  useEffect(() => {
    warmRef.current = { energized: sim.energized, powered: sim.poweredSensors };
    prevInRef.current = snapshotInLive(circuit, sim);
  }, [sim, circuit]);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      setTime((t) => +(t + 0.1).toFixed(2));
      setCircuit((c) => stepCircuit(c, simRef.current, 0.1, prevInRef.current));
    }, 100);
    return () => clearInterval(iv);
  }, [running]);

  // momentary buttons snap back when the finger lifts anywhere
  useEffect(() => {
    const up = () => {
      setCircuit((c) => {
        const held = c.nodes.filter((n) => COMPONENT_MAP[n.typeId]?.momentary && COMPONENT_MAP[n.typeId]?.category === 'pushbutton' && n.state.pressed);
        if (!held.length) return c;
        return { ...c, nodes: c.nodes.map((n) => (held.includes(n) ? { ...n, state: { ...n.state, pressed: false } } : n)) };
      });
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  // persistence
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify({ circuit, tpl })); } catch { /* quota */ } }, 250);
    return () => clearTimeout(t);
  }, [circuit, tpl]);

  // ── handlers ───────────────────────────────────────────────────────────────
  const addNode = (typeId: string) => {
    const i = circuit.nodes.length;
    const n: NodeInstance = {
      id: `n${Date.now().toString(36)}${i}`,
      typeId,
      x: 90 + (i * 47) % 520,
      y: 60 + (i * 131) % 380,
      state: defaultState(typeId),
    };
    setCircuit((c) => ({ ...c, nodes: [...c.nodes, n] }));
  };

  const patchNode = (id: string, patch: Partial<NodeState>) =>
    setCircuit((c) => ({ ...c, nodes: c.nodes.map((n) => (n.id === id ? { ...n, state: { ...n.state, ...patch } } : n)) }));

  const moveNode = (id: string, x: number, y: number) =>
    setCircuit((c) => ({ ...c, nodes: c.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) }));

  const addWire = (a: WireEndpoint, b: WireEndpoint) => {
    if (eq(a, b)) return;
    setCircuit((c) => {
      if (c.wires.some((w) => (eq(w.a, a) && eq(w.b, b)) || (eq(w.a, b) && eq(w.b, a)))) return c;
      return { ...c, wires: [...c.wires, { id: `w${Date.now().toString(36)}${wireSeq.current++}`, a, b }] };
    });
  };

  const removeWire = (id: string) => setCircuit((c) => ({ ...c, wires: c.wires.filter((w) => w.id !== id) }));

  const removeNode = (id: string) =>
    setCircuit((c) => ({
      nodes: c.nodes.filter((n) => n.id !== id),
      wires: c.wires.filter((w) => w.a.node !== id && w.b.node !== id),
    }));

  const clearAll = () => {
    if (!window.confirm('Clear the entire workspace?')) return;
    setCircuit(() => ({ nodes: [], wires: [] }));
    setRunning(false);
  };

  const resetSim = () => {
    setRunning(false);
    setTime(0);
    setStep(0);
    warmRef.current = { energized: {}, powered: {} };
    setCircuit((c) => ({ ...c, nodes: c.nodes.map((n) => ({ ...n, state: { ...n.state, elapsed: 0, count: 0, pressed: false } })) }));
  };

  const loadTemplate = (t: CircuitTemplate) => {
    warmRef.current = { energized: {}, powered: {} };
    setState({ circuit: cloneCircuit(t.circuit), tpl: t.id });
    setStep(0);
    setTime(0);
    setRunning(false);
    setTab('playground');
  };

  const activeTpl = TEMPLATES.find((t) => t.id === tpl) ?? null;
  const applyNextStep = () => {
    if (!activeTpl || step >= activeTpl.steps.length) return;
    const s = activeTpl.steps[step];
    setCircuit((c) => applyStepToCircuit(c, activeTpl, step));
    setStep((x) => x + 1);
    setRunning(true);
    void s;
  };

  const jumpToNodes = (ids: string[]) => {
    setTab('playground');
    setHighlight(ids);
    window.setTimeout(() => setHighlight([]), 2600);
  };

  const modalDef: ComponentDef | null = modal ? COMPONENT_MAP[modal.typeId] ?? null : null;
  const modalNode = modal?.nodeId ? circuit.nodes.find((n) => n.id === modal.nodeId) ?? null : null;
  const fatal = sim.errors.filter((e) => e.severity === 'error').length;
  const warns = sim.errors.filter((e) => e.severity === 'warning').length;
  const anyEnergized = Object.values(sim.energized).some(Boolean);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ── header ─────────────────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-ink-700/70 bg-ink-900/95 px-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-volt to-orange-600 text-black shadow-[0_0_16px_rgba(250,204,21,.35)]">
            <Factory size={19} strokeWidth={2.4} />
          </span>
          <div className="leading-tight">
            <h1 className="text-sm font-black tracking-wide text-slate-100">AUTOMATION MASTER HUB</h1>
            <p className="text-[9.5px] uppercase tracking-[0.18em] text-slate-500">Classic Control · Simulation · PLC · Motor Sizing</p>
          </div>
        </div>

        <nav className="ml-6 flex items-center gap-1">
          <TabBtn active={tab === 'playground'} onClick={() => setTab('playground')} icon={<Workflow size={14} />}>Simulator</TabBtn>
          <TabBtn active={tab === 'templates'} onClick={() => setTab('templates')} icon={<LayoutTemplate size={14} />}>Templates</TabBtn>
          <TabBtn active={tab === 'calculator'} onClick={() => setTab('calculator')} icon={<CalcIcon size={14} />}>Calculator</TabBtn>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {sim.shortCircuit && (
            <span className="flex items-center gap-1 animate-pulse rounded-full border border-red-500/60 bg-red-500/15 px-2.5 py-1 text-[10px] font-bold text-red-300">
              <ZapOff size={12} /> SHORT CIRCUIT
            </span>
          )}
          <span className={`hidden items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold sm:flex ${anyEnergized ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-ink-600 text-slate-500'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${anyEnergized ? 'animate-pulse bg-emerald-400' : 'bg-slate-600'}`} />
            {Object.values(sim.energized).filter(Boolean).length} ACTIVE · t={time.toFixed(1)}s
          </span>

          <button
            onClick={() => setRunning((r) => !r)}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${running ? 'bg-orange-500 text-black hover:brightness-110' : 'bg-emerald-500 text-black hover:brightness-110'}`}
          >
            {running ? <Pause size={14} /> : <Play size={14} />}
            {running ? 'PAUSE SIMULATION' : 'RUN SIMULATION'}
          </button>
          <button onClick={() => setLadder(true)} title="Convert schematic to PLC ladder"
            className="flex items-center gap-1.5 rounded-lg border border-indigo-400/50 bg-indigo-500/15 px-3 py-2 text-xs font-bold text-indigo-300 hover:bg-indigo-500/25">
            <Network size={14} /> <span className="hidden md:inline">→ LADDER</span>
          </button>
          <button onClick={resetSim} title="Reset timers / counters / states" className="rounded-lg border border-ink-600 p-2 text-slate-400 hover:border-volt hover:text-volt"><RotateCcw size={14} /></button>
          <button onClick={clearAll} title="Clear workspace" className="rounded-lg border border-ink-600 p-2 text-slate-400 hover:border-red-400 hover:text-red-400"><Trash2 size={14} /></button>
          {(fatal > 0 || warns > 0) && tab !== 'playground' && (
            <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${fatal ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
              {fatal ? <ShieldAlert size={12} /> : <TriangleAlert size={12} />} {fatal}E {warns}W
            </span>
          )}
        </div>
      </header>

      {/* ── body ───────────────────────────────────────────────────────────── */}
      <main className="flex min-h-0 flex-1">
        {tab === 'playground' && (
          <>
            <Palette onAdd={addNode} onInspect={(def) => setModal({ typeId: def.typeId })} />
            <div className="relative min-w-0 flex-1">
              <Workspace
                circuit={circuit}
                sim={sim}
                highlight={highlight}
                onMove={moveNode}
                onAddWire={addWire}
                onRemoveWire={removeWire}
                onRemoveNode={removeNode}
                onOpenInfo={(nd) => setModal({ typeId: nd.typeId, nodeId: nd.id })}
                onPatch={patchNode}
                setTip={setTip}
              />
              {activeTpl && (
                <div className="absolute bottom-3 left-3 right-3 z-20 mx-auto max-w-3xl">
                  <div className="card flex items-start gap-3 p-3 shadow-2xl">
                    <div className="flex items-center gap-1 pt-0.5">
                      <button
                        className="rounded-md border border-ink-600 p-1.5 text-slate-400 hover:text-volt disabled:opacity-30"
                        disabled={step === 0}
                        onClick={() => setStep((s) => Math.max(0, s - 1))}
                      ><ChevronLeft size={14} /></button>
                      <span className="w-12 text-center font-mono text-[11px] text-volt">{step}/{activeTpl.steps.length}</span>
                      <button
                        className="rounded-md border border-ink-600 p-1.5 text-slate-400 hover:text-volt disabled:opacity-30"
                        disabled={step >= activeTpl.steps.length}
                        onClick={applyNextStep}
                      ><ChevronRight size={14} /></button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-slate-200">
                        {activeTpl.name} · {step < activeTpl.steps.length ? <>step {step + 1}: <span className="text-volt">{activeTpl.steps[step].action}</span></> : 'sequence complete — experiment freely'}
                      </div>
                      <div className="mt-0.5 max-h-14 overflow-y-auto text-[10.5px] leading-relaxed text-slate-400">
                        {step > 0 ? activeTpl.steps[step - 1].narration : 'Press NEXT to begin the guided logic playback (it also starts the live simulation).'}
                      </div>
                    </div>
                    <button className="text-slate-600 hover:text-slate-300" onClick={() => setState((s) => ({ ...s, tpl: null }))} title="detach guide"><X size={14} /></button>
                  </div>
                </div>
              )}
            </div>
            <ValidationPanel sim={sim} running={running} onJump={jumpToNodes} />
          </>
        )}

        {tab === 'templates' && <div className="min-w-0 flex-1 overflow-y-auto"><TemplatesView onLoad={loadTemplate} /></div>}
        {tab === 'calculator' && <div className="min-w-0 flex-1 overflow-y-auto"><Calculator /></div>}
      </main>

      {/* ── floating terminal tooltip ──────────────────────────────────────── */}
      {tip && (
        <div
          className="pointer-events-none fixed z-[60] max-w-xs rounded-lg border border-volt/40 bg-ink-900/97 p-2.5 text-[10.5px] leading-relaxed shadow-[0_8px_30px_rgba(0,0,0,.6)]"
          style={{ left: Math.min(tip.x, window.innerWidth - 300), top: Math.min(tip.y, window.innerHeight - 140) }}
        >
          <div className="mb-1 font-bold text-volt">{tip.title}</div>
          <div className="text-slate-300">{tip.body}</div>
        </div>
      )}

      {modalDef && (
        <DetailModal def={modalDef} node={modalNode} sim={sim} onClose={() => setModal(null)} />
      )}
      {ladder && <LadderModal circuit={circuit} sim={sim} onClose={() => setLadder(false)} />}
    </div>
  );
}

const TabBtn = ({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${active ? 'bg-volt/15 text-volt' : 'text-slate-400 hover:bg-ink-700 hover:text-slate-200'}`}
  >
    {icon}{children}
  </button>
);
