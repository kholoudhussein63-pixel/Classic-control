import { useEffect, useMemo } from 'react';
import { X, CopyCheck } from 'lucide-react';
import type { CircuitDoc, LadderRung, SimResult } from '../types';
import { toLadder } from '../utils/ladder';

interface Props {
  circuit: CircuitDoc;
  sim: SimResult;
  onClose: () => void;
}

// Classic schematic → IEC 61131-3 ladder: one rung per coil/load,
// series contact chains as branches, parallel branches stacked.

const CONTACT_W = 74;
const RUNG_H = 66;
const BRANCH_H = 34;
const PAD_L = 60;
const PAD_R = 90;

export function LadderModal({ circuit, sim, onClose }: Props) {
  const rungs = useMemo(() => toLadder(circuit, sim), [circuit, sim]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const mnemonics = useMemo(() => buildMnemonics(rungs), [rungs]);
  const W = PAD_L + PAD_R + Math.max(5, ...rungs.map((r) => Math.max(...r.paths.map((p) => p.length)))) * CONTACT_W;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-indigo-600/80 px-5 py-3">
          <div>
            <h2 className="text-base font-bold text-white">Classic Control → PLC Ladder Logic</h2>
            <p className="text-[11px] text-indigo-100/80">auto-translated from the live schematic · contacts mirror real states</p>
          </div>
          <button className="rounded-md p-1.5 text-white hover:bg-black/25" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="grid flex-1 gap-3 overflow-y-auto p-4 lg:grid-cols-[1fr_280px]">
          <div className="overflow-x-auto rounded-lg bg-ink-900 p-2">
            {rungs.length === 0 && (
              <p className="p-6 text-center text-sm text-slate-500">
                No coils found in the schematic yet — place a relay/contactor/timer or a load and wire at least one contact path from L.
              </p>
            )}
            <svg width={W} height={Math.max(120, rungs.length * (RUNG_H + 26) + 40)}>
              {/* rails */}
              <line x1={PAD_L} y1={12} x2={PAD_L} y2={rungs.length * (RUNG_H + 26) + 20} stroke="#64748b" strokeWidth={3} />
              <line x1={W - PAD_R} y1={12} x2={W - PAD_R} y2={rungs.length * (RUNG_H + 26) + 20} stroke="#64748b" strokeWidth={3} />
              <text x={PAD_L} y={9} textAnchor="middle" fontSize={9} fill="#f87171">L ─ (|%CPU|)</text>
              <text x={W - PAD_R} y={9} textAnchor="middle" fontSize={9} fill="#60a5fa">M ─ /</text>

              {rungs.map((r, ri) => {
                const hgt = Math.max(1, r.paths.length) * BRANCH_H + 26;
                const top = 24 + ri * (RUNG_H + 26);
                return (
                  <g key={ri}>
                    <text x={6} y={top + 12} fontSize={9} fill="#facc15" fontFamily="monospace">R{ri + 1}</text>
                    {r.paths.map((path, bi) => {
                      const y = top + 14 + bi * BRANCH_H;
                      const xEnd = W - PAD_R;
                      return (
                        <g key={bi}>
                          <line x1={PAD_L} y1={y} x2={xEnd} y2={y} stroke={r.energized && bi === 0 ? '#4ade80' : '#334155'} strokeWidth={1.4} />
                          {path.map((lit, ci) => {
                            const x = PAD_L + 26 + ci * CONTACT_W;
                            const active = lit.closed;
                            return (
                              <g key={ci}>
                                <line x1={x - 26} y1={y} x2={x - 12} y2={y} stroke="#94a3b8" strokeWidth={1.4} />
                                {/* two vertical rails of the contact */}
                                <line x1={x - 12} y1={y - 10} x2={x - 12} y2={y + 10} stroke={active ? '#4ade80' : '#64748b'} strokeWidth={2.4} />
                                {lit.polarity === 'NC'
                                  ? <line x1={x - 15} y1={y + 10} x2={x + 15} y2={y - 10} stroke={active ? '#f87171' : '#64748b'} strokeWidth={2.4} />
                                  : <line x1={x + 12} y1={y - 10} x2={x + 12} y2={y + 10} stroke={active ? '#4ade80' : '#64748b'} strokeWidth={2.4} />}
                                <line x1={x + 12} y1={y} x2={x + 26} y2={y} stroke="#94a3b8" strokeWidth={1.4} />
                                <text x={x} y={y - 15} textAnchor="middle" fontSize={8.5} fill={active ? '#4ade80' : '#7d8aa3'} fontFamily="monospace">
                                  {lit.device}
                                </text>
                                <text x={x} y={y + 22} textAnchor="middle" fontSize={7.5} fill="#475569" fontFamily="monospace">
                                  {lit.polarity === 'NO' ? '-| |-' : '-|/|'} {lit.contact}
                                </text>
                              </g>
                            );
                          })}
                          {/* coil / box at end */}
                          <g>
                            <line x1={W - PAD_R - 26} y1={y} x2={W - PAD_R} y2={y} stroke="#94a3b8" strokeWidth={1.4} />
                            {r.targetKind === 'load' ? (
                              <rect x={W - PAD_R - 40} y={y - 11} width={22} height={22} rx={11} fill="none" stroke={r.energized ? '#4ade80' : '#64748b'} strokeWidth={2} />
                            ) : (
                              <>
                                <circle cx={W - PAD_R - 29} cy={y} r={11} fill="none" stroke={r.energized ? '#4ade80' : '#64748b'} strokeWidth={2} />
                                {(r.targetKind === 'timer' || r.targetKind === 'counter') && (
                                  <rect x={W - PAD_R - 52} y={y - 12} width={12} height={24} rx={2} fill="none" stroke="#a78bfa" strokeWidth={1.4} />
                                )}
                              </>
                            )}
                            <text x={W - PAD_R - 29} y={y - 16} textAnchor="middle" fontSize={8.5} fill={r.energized ? '#4ade80' : '#94a3b8'} fontFamily="monospace">
                              ({r.target})
                            </text>
                          </g>
                        </g>
                      );
                    })}
                    {r.paths.length > 1 && (
                      <text x={PAD_L + 4} y={top + 12} fontSize={7.5} fill="#64748b">⫽ {r.paths.length} parallel branches</text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-ink-700/60 bg-ink-800/60 p-3">
              <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-volt"><CopyCheck size={12} />PLC mnemonic output</h3>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-slate-300">{mnemonics}</pre>
            </div>
            <div className="rounded-lg border border-ink-700/60 bg-ink-800/60 p-3 text-[11px] leading-relaxed text-slate-400">
              <b className="text-slate-200">Translation rules</b>
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                <li>Each coil/load becomes one rung ending in <code className="text-volt">-( )</code>.</li>
                <li>Series contact path → <code className="text-volt">LD</code>/<code className="text-volt">AND</code> chain.</li>
                <li>Parallel wire branch (seal-in) → stacked branch with <code className="text-volt">OR</code>.</li>
                <li>NC wired contact → <code className="text-volt">-|/|-</code> normally-closed instruction.</li>
                <li>Timer coils → <code className="text-volt">TON</code>, counter pulse → <code className="text-volt">CTU</code>.</li>
                <li>Green = currently conducting in the live simulation.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildMnemonics(rungs: LadderRung[]): string {
  if (!rungs.length) return '// nothing to translate yet';
  const lines: string[] = [];
  let step = 0;
  rungs.forEach((r, ri) => {
    lines.push(`// ── Rung ${ri + 1}: ${r.target}${r.energized ? '  [ENERGIZED]' : ''}`);
    r.paths.forEach((path, bi) => {
      path.forEach((lit, ci) => {
        const op = ci === 0 && bi === 0 ? 'LD   ' : bi === 0 ? 'AND  ' : 'OR   ';
        const m = lit.polarity === 'NO' ? 'NO' : 'NC';
        lines.push(`${String(step++).padStart(3, '0')} ${op}${lit.device}.${m} (${lit.contact})`);
      });
      if (!path.length) lines.push(`${String(step++).padStart(3, '0')} LD    TRUE`);
    });
    const out = r.targetKind === 'timer' ? 'TON  ' : r.targetKind === 'counter' ? 'CTU  ' : r.targetKind === 'load' ? 'OUT  ' : 'OUT  ';
    lines.push(`${String(step++).padStart(3, '0')} ${out}${r.target}`);
    lines.push('');
  });
  return lines.join('\n');
}
