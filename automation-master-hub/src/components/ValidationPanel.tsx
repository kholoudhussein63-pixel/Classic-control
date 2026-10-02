import { ShieldAlert, ShieldCheck, TriangleAlert, Info as InfoIcon, ZapOff } from 'lucide-react';
import type { SimResult } from '../types';

interface Props {
  sim: SimResult;
  running: boolean;
  onJump: (nodeIds: string[]) => void;
}

export function ValidationPanel({ sim, running, onJump }: Props) {
  const errors = sim.errors;
  const fatal = errors.filter((e) => e.severity === 'error').length;
  const warns = errors.filter((e) => e.severity === 'warning').length;

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-ink-700/60 bg-ink-900/80">
      <div className="flex items-center gap-2 border-b border-ink-700/60 p-3">
        {fatal > 0 ? <ShieldAlert size={17} className="text-hazard" />
          : warns > 0 ? <TriangleAlert size={17} className="text-volt" />
          : <ShieldCheck size={17} className="text-live" />}
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-300">Logic Validation</h2>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${running ? 'bg-emerald-500/20 text-emerald-300' : 'bg-ink-600 text-slate-400'}`}>
          {running ? 'SIM RUNNING' : 'PAUSED'}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {errors.length === 0 && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-300">
            <b>No faults detected.</b>
            <p className="mt-1 text-emerald-400/70">Short-circuit scan, seal-in analysis and contactor interlock checks are clean for the current switching state.</p>
          </div>
        )}
        {errors.map((e) => (
          <button
            key={e.id}
            onClick={() => e.nodes?.length && onJump(e.nodes)}
            className={[
              'block w-full rounded-lg border p-3 text-left text-[11px] transition hover:brightness-125',
              e.severity === 'error' ? 'border-red-500/40 bg-red-500/10' :
              e.severity === 'warning' ? 'border-yellow-500/40 bg-yellow-500/10' :
              'border-sky-500/40 bg-sky-500/10',
            ].join(' ')}
          >
            <span className={['flex items-center gap-1.5 font-bold',
              e.severity === 'error' ? 'text-red-300' : e.severity === 'warning' ? 'text-yellow-300' : 'text-sky-300'].join(' ')}>
              {e.severity === 'error' ? <ShieldAlert size={13} /> : e.severity === 'warning' ? <TriangleAlert size={13} /> : <InfoIcon size={13} />}
              {e.title}
            </span>
            <p className="mt-1 leading-relaxed text-slate-400">{e.detail}</p>
            {e.nodes?.length ? <p className="mt-1 text-[9px] uppercase tracking-wide text-slate-500">click to locate on canvas</p> : null}
          </button>
        ))}
      </div>

      <div className="border-t border-ink-700/60 p-3 text-[10px] leading-relaxed text-slate-500">
        <div className="flex items-center gap-1.5"><ZapOff size={12} className="text-red-400" /><b className="text-slate-400">Engine checks:</b></div>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          <li>Phase-to-neutral short circuits (no load in path)</li>
          <li>Missing latch / seal-in on start-button circuits</li>
          <li>Star-Delta & FWD/REV contactor interlocks</li>
          <li>Relay chatter / unstable feedback loops</li>
        </ul>
      </div>
    </aside>
  );
}
