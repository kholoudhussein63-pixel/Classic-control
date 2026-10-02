import { useState } from 'react';
import { Settings2, Repeat, Zap, Play, ChevronDown, ChevronUp, ListChecks } from 'lucide-react';
import type { CircuitDoc, CircuitTemplate } from '../types';
import { TEMPLATES } from '../data/templates';

const ICONS = { 'settings-2': Settings2, repeat: Repeat, zap: Zap } as const;

interface Props {
  onLoad: (t: CircuitTemplate) => void;
}

export function TemplatesView({ onLoad }: Props) {
  const [open, setOpen] = useState<string | null>(TEMPLATES[0].id);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-100">Pre-built Application Circuits</h2>
        <p className="mt-1 text-xs text-slate-500">
          Field-proven classic-control schemes with step-by-step logic playback. Loading one replaces the playground canvas — then press RUN and walk the sequence.
        </p>
      </div>

      {TEMPLATES.map((tpl) => {
        const Icon = ICONS[tpl.icon];
        const isOpen = open === tpl.id;
        return (
          <div key={tpl.id} className="card overflow-hidden">
            <button className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-ink-700/30" onClick={() => setOpen(isOpen ? null : tpl.id)}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600/30 text-indigo-300"><Icon size={24} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-100">{tpl.name}</span>
                <span className="block truncate text-[11px] text-slate-500">{tpl.subtitle}</span>
              </span>
              <span className="hidden gap-1.5 md:flex">
                {tpl.highlights.slice(0, 3).map((h) => (
                  <span key={h} className="rounded-full border border-ink-600 bg-ink-800 px-2.5 py-1 text-[9.5px] text-slate-400">{h}</span>
                ))}
              </span>
              {isOpen ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
            </button>

            {isOpen && (
              <div className="grid gap-5 border-t border-ink-700/60 p-5 lg:grid-cols-[1fr_1.1fr]">
                <div>
                  <p className="text-xs leading-relaxed text-slate-400">{tpl.description}</p>
                  <ul className="mt-3 space-y-1 text-[11px] text-slate-300">
                    {tpl.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-volt" />{h}</li>
                    ))}
                  </ul>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={() => onLoad(tpl)}
                      className="flex items-center gap-2 rounded-lg bg-volt px-4 py-2.5 text-xs font-bold text-black shadow-[0_0_18px_rgba(250,204,21,.35)] transition hover:brightness-110"
                    >
                      <Play size={14} /> Load into simulator ({tpl.circuit.nodes.length} components · {tpl.circuit.wires.length} wires)
                    </button>
                  </div>
                  <p className="mt-3 font-mono text-[10px] text-slate-600">
                    {tpl.circuit.nodes.map((n) => n.state.label).filter(Boolean).join(' · ')}
                  </p>
                </div>

                <div>
                  <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-volt"><ListChecks size={13} /> Walkthrough sequence</h4>
                  <ol className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {tpl.steps.map((s, i) => (
                      <li key={i} className="rounded-lg border border-ink-700/70 bg-ink-800/60 p-2.5">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-600 font-mono text-[9px] text-volt">{i + 1}</span>
                          <div>
                            <div className="text-[11px] font-bold text-slate-200">{s.action}</div>
                            <div className="mt-0.5 text-[10.5px] leading-relaxed text-slate-500">{s.narration}</div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 text-[10px] text-slate-600">
                    The steps are also available as an auto-player at the bottom of the simulator once loaded.
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function applyStepToCircuit(circuit: CircuitDoc, tpl: CircuitTemplate, step: number): CircuitDoc {
  const s = tpl.steps[step];
  if (!s?.set) return circuit;
  return {
    ...circuit,
    nodes: circuit.nodes.map((n) => (n.id === s.set!.node ? { ...n, state: { ...n.state, ...s.set!.patch } } : n)),
  };
}
