import React from 'react';
import { Info, X, RotateCw, TriangleAlert } from 'lucide-react';
import type { ComponentDef, NodeInstance, NodeState, SimResult, TipState, WireEndpoint } from '../types';
import { HEADER_H, NODE_W, ROW_H } from './Workspace';

interface Props {
  node: NodeInstance;
  def: ComponentDef;
  sim: SimResult;
  selected: boolean;
  highlighted: boolean;
  pending: WireEndpoint | null;
  onHeaderDown: (e: React.PointerEvent) => void;
  onPortClick: (term: string) => void;
  onOpenInfo: () => void;
  onRemove: () => void;
  onPatch: (patch: Partial<NodeState>) => void;
  setTip: (t: TipState | null) => void;
}

export function CircuitNodeView(p: Props) {
  const { node, def, sim, selected, highlighted, pending, setTip } = p;
  const live = sim.live[node.id] ?? {};
  const pairs = sim.pairs[node.id] ?? [];
  const energized = !!sim.energized[node.id];
  const wired = (termId: string) => !!pending && pending.node === node.id && pending.term === termId;

  const pairIndexOf = (termId: string) =>
    def.contacts.findIndex((c) => c.com === termId || c.no === termId || c.nc === termId);

  const pairDesc = (termId: string): string => {
    const i = pairIndexOf(termId);
    if (i < 0) return '';
    const c = def.contacts[i];
    const kind = c.no && c.nc ? 'changeover contact' : c.no ? 'NO contact' : 'NC contact';
    const closed = pairs[i];
    return ` ${kind}, currently ${closed ? 'CLOSED (conducting)' : 'OPEN'}.`;
  };

  const isSwitch = def.actuation === 'state';
  const posLabel = def.momentary
    ? node.state.pressed ? 'ACTUATED' : 'AT REST'
    : def.positions === 3
      ? ['OFF', 'AUTO', 'MANUAL'][node.state.pos] ?? `P${node.state.pos}`
      : node.state.pos >= 1 ? 'ON' : 'OFF';

  const btn = 'rounded-md border border-ink-600 bg-ink-700 px-2 py-0.5 text-[10px] font-semibold text-slate-200 hover:border-volt/60 hover:text-volt active:scale-95 select-none';

  return (
    <div
      className={[
        'absolute rounded-lg border bg-ink-800/95 shadow-xl backdrop-blur-sm transition-shadow',
        energized ? 'border-emerald-400/70 energized-card' : 'border-ink-600/70',
        selected ? 'ring-2 ring-volt/70' : '',
        highlighted ? 'ring-2 ring-red-500/80' : '',
      ].join(' ')}
      style={{ left: node.x, top: node.y, width: NODE_W }}
    >
      {/* header */}
      <div
        className={[
          'flex items-center justify-between gap-1 rounded-t-lg px-2 text-[11px] font-bold text-white cursor-grab active:cursor-grabbing',
          def.accent,
        ].join(' ')}
        style={{ height: HEADER_H }}
        onPointerDown={p.onHeaderDown}
      >
        <span className="truncate">
          {node.state.label ?? `${def.mnemonic} · ${def.name.split('—')[0].trim()}`}
        </span>
        <div className="flex items-center gap-1">
          {def.isLoad && energized && def.typeId === 'motor_3ph' && (
            <RotateCw size={13} className="motor-spin text-white" />
          )}
          <button
            className="rounded p-0.5 hover:bg-white/25"
            title="Open knowledge base"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={p.onOpenInfo}
          ><Info size={13} /></button>
          <button
            className="rounded p-0.5 hover:bg-black/30"
            title="Remove from canvas"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={p.onRemove}
          ><X size={13} /></button>
        </div>
      </div>

      {/* terminals */}
      <div style={{ minHeight: def.terminals.length * ROW_H + 8 }} className="relative pt-2">
        {/* pair state mini-schematic */}
        <div className="absolute right-1.5 top-1.5 flex flex-col items-end gap-0.5">
          {def.contacts.map((c, i) => (
            <span key={i} className={`rounded px-1 text-[8px] font-mono leading-tight ${pairs[i] ? 'bg-emerald-500/25 text-emerald-300' : 'bg-ink-600/50 text-slate-400'}`}>
              {c.com}{c.no ? `–${c.no}` : ''}{c.nc ? ` / ${c.nc}` : ''} {pairs[i] ? '∎' : '□'}
            </span>
          ))}
        </div>

        {def.terminals.map((term, i) => {
          const g = i % 2 === 0;
          const isLive = !!live[term.id];
          return (
            <div
              key={term.id}
              className="relative flex items-center px-1"
              style={{ height: ROW_H }}
            >
              <button
                aria-label={`terminal ${term.id}`}
                className={[
                  'absolute z-10 h-3.5 w-3.5 rounded-full border-2 transition-colors',
                  wired(term.id) ? 'border-volt bg-volt animate-pulse' :
                  isLive ? 'border-emerald-300 bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,.9)]' :
                  'border-slate-500 bg-ink-800 hover:border-volt',
                ].join(' ')}
                style={g ? { left: -8 } : { right: -8 }}
                onClick={() => p.onPortClick(term.id)}
                onMouseEnter={(e) => setTip({
                  x: e.clientX + 14, y: e.clientY + 10,
                  title: `${node.state.label ?? def.mnemonic} — terminal ${term.label}`,
                  body: term.desc + pairDesc(term.id),
                })}
                onMouseLeave={() => setTip(null)}
              />
              <span
                className={`truncate font-mono text-[10px] ${isLive ? 'text-emerald-300' : 'text-slate-400'} ${g ? 'pl-4' : 'ml-auto pr-4'}`}
                onMouseEnter={(e) => setTip({
                  x: e.clientX + 14, y: e.clientY + 10,
                  title: `${node.state.label ?? def.mnemonic} — terminal ${term.label}`,
                  body: term.desc + pairDesc(term.id),
                })}
                onMouseLeave={() => setTip(null)}
              >
                {term.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* status */}
      <div className="border-t border-ink-600/50 px-2 py-1 font-mono text-[9px] leading-snug text-slate-400">
        {def.category === 'supply' && (<span className="text-red-400/90">L ● &nbsp;&nbsp; N ○ control rails</span>)}
        {(def.coil && !isSwitch && def.actuation !== 'sensor' && def.actuation !== 'overload') && (
          energized
            ? <span className="flex items-center gap-1 text-emerald-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />COIL ENERGIZED</span>
            : <span>coil de-energized</span>
        )}
        {isSwitch && <span>state: <b className={node.state.pressed || node.state.pos > 0 ? 'text-volt' : ''}>{posLabel}</b></span>}
        {def.actuation === 'sensor' && (
          <span className={sim.poweredSensors[node.id] ? '' : 'text-amber-500/80'}>
            {sim.poweredSensors[node.id] ? 'powered BN/BU ok · ' : 'unpowered (BN/BU missing) · '}
            {node.state.pressed ? <b className="text-emerald-400">TARGET DETECTED</b> : 'no target'}
          </span>
        )}
        {def.actuation === 'overload' && (
          node.state.tripped
            ? <span className="flex items-center gap-1 text-red-400"><TriangleAlert size={10} />TRIPPED — 95/96 OPEN</span>
            : <span>healthy · 95–96 closed · setting {node.state.preset} A</span>
        )}
        {def.category === 'timer' && (
          <span>
            {def.typeId === 'timer_pulse'
              ? <>flasher period {node.state.preset}s · out <b className={pairs[0] ? 'text-emerald-400' : ''}>{pairs[0] ? 'ON' : 'OFF'}</b></>
              : <>T = {node.state.elapsed.toFixed(1)}s / PT {node.state.preset}s</>}
            {def.typeId !== 'timer_pulse' && (
              <span className="mt-0.5 block h-1 w-full rounded bg-ink-600">
                <span className="block h-1 rounded bg-volt transition-all" style={{ width: `${(sim.timerProgress[node.id] ?? 0) * 100}%` }} />
              </span>
            )}
          </span>
        )}
        {def.category === 'counter' && (
          <span>PV <b className={node.state.count >= node.state.preset && node.state.count > 0 ? 'text-emerald-400' : 'text-volt'}>{node.state.count}</b> / preset {node.state.preset}
            {pairs[0] && <b className="ml-1 text-emerald-400">REACHED</b>}
          </span>
        )}
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-1 px-2 pb-2 pt-0.5">
        {def.actuation === 'state' && def.momentary && def.category === 'pushbutton' && (
          <button
            className={`${btn} ${node.state.pressed ? 'border-emerald-400 text-emerald-300' : ''}`}
            onPointerDown={(e) => { e.stopPropagation(); p.onPatch({ pressed: true }); }}
            onPointerUp={() => p.onPatch({ pressed: false })}
            onPointerLeave={() => node.state.pressed && p.onPatch({ pressed: false })}
          >HOLD TO PRESS</button>
        )}
        {def.actuation === 'state' && def.momentary && def.category !== 'pushbutton' && (
          <button
            className={`${btn} ${node.state.pressed ? 'border-emerald-400 text-emerald-300' : ''}`}
            onClick={() => p.onPatch({ pressed: !node.state.pressed })}
          >{node.state.pressed ? 'RELEASE ROLLER' : 'ACTUATE ROLLER'}</button>
        )}
        {def.actuation === 'state' && !def.momentary && (
          <button className={btn} onClick={() => p.onPatch({ pos: (node.state.pos + 1) % (def.positions ?? 2) })}>
            {posLabel} ▸ {def.positions === 3
              ? ['AUTO', 'MANUAL', 'OFF'][node.state.pos]
              : (node.state.pos >= 1 ? 'OFF' : 'ON')}
          </button>
        )}
        {def.actuation === 'overload' && (
          <>
            <button className={`${btn} text-red-300`} onClick={() => p.onPatch({ tripped: !node.state.tripped })}>
              {node.state.tripped ? 'RESET' : 'TRIP'}
            </button>
            <button className={btn} onClick={() => p.onPatch({ preset: Math.max(0.5, +(node.state.preset - 1).toFixed(1)) })}>−A</button>
            <button className={btn} onClick={() => p.onPatch({ preset: node.state.preset + 1 })}>+A</button>
          </>
        )}
        {def.category === 'timer' && (
          <>
            <button className={btn} onClick={() => p.onPatch({ preset: Math.max(1, node.state.preset - 1) })}>PT −</button>
            <button className={btn} onClick={() => p.onPatch({ preset: node.state.preset + 1 })}>PT +</button>
            <button className={btn} onClick={() => p.onPatch({ elapsed: 0 })}>↺</button>
          </>
        )}
        {def.category === 'counter' && (
          <button className={btn} onClick={() => p.onPatch({ count: 0 })}>CNT RESET</button>
        )}
        {def.actuation === 'sensor' && (
          <button
            className={`${btn} ${node.state.pressed ? 'border-emerald-400 text-emerald-300' : ''}`}
            onClick={() => p.onPatch({ pressed: !node.state.pressed })}
          >{node.state.pressed ? 'DETECTED' : 'DETECT'} </button>
        )}
      </div>
    </div>
  );
}
