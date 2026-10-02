import type * as React from 'react';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { ComponentDef, NodeInstance, SimResult } from '../types';

interface Props {
  def: ComponentDef;
  node?: NodeInstance | null;
  sim?: SimResult | null;
  onClose: () => void;
}

const ROLE_COLOR: Record<string, string> = {
  line: '#f87171', neutral: '#60a5fa', coil: '#facc15', common: '#e2e8f0',
  no: '#4ade80', nc: '#f472b6', signal: '#22d3ee',
};

export function DetailModal({ def, node, sim, onClose }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const pairs = node && sim ? sim.pairs[node.id] ?? [] : [];
  const live = node && sim ? sim.live[node.id] ?? {} : {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="card flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between px-5 py-3 ${def.accent}`}>
          <div>
            <h2 className="text-base font-bold text-white">{def.name}</h2>
            <p className="text-[11px] text-white/80">{def.mnemonic} · {def.category.toUpperCase()} · IEC classic control library</p>
          </div>
          <button className="rounded-md p-1.5 text-white hover:bg-black/25" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-2">
          {/* left: visuals */}
          <div className="space-y-4">
            <Section title="Real-world representation">
              <ComponentPhoto def={def} />
            </Section>
            <Section title="Interactive pinout & terminal setup">
              <PinoutSvg def={def} live={live} pairs={pairs} />
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{def.pinoutNote}</p>
            </Section>
            {node && (
              <Section title="Instant status (this canvas instance)">
                <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                  {def.contacts.map((c, i) => (
                    <span key={i} className={`rounded px-2 py-1 ${pairs[i] ? 'bg-emerald-500/20 text-emerald-300' : 'bg-ink-700 text-slate-400'}`}>
                      {c.com}–{c.no ?? c.nc}: {pairs[i] ? 'CLOSED' : 'OPEN'}
                    </span>
                  ))}
                  {def.coil && (
                    <span className={`rounded px-2 py-1 ${sim?.energized[node.id] ? 'bg-emerald-500/20 text-emerald-300' : 'bg-ink-700 text-slate-400'}`}>
                      coil {def.coil.join('–')}: {sim?.energized[node.id] ? 'ENERGIZED' : 'OFF'}
                    </span>
                  )}
                  {def.actuation === 'state' && (
                    <span className="rounded bg-volt/15 px-2 py-1 text-volt">
                      {node.state.pressed ? 'ACTUATED' : node.state.pos > 0 ? `POSITION ${node.state.pos}` : 'AT REST'}
                    </span>
                  )}
                </div>
              </Section>
            )}
          </div>

          {/* right: knowledge */}
          <div className="space-y-4">
            <Section title="Industrial nameplate">
              <table className="w-full text-[11px]">
                <tbody>
                  {Object.entries(def.nameplate).map(([k, v]) => (
                    <tr key={k} className="border-b border-ink-700/60 last:border-0">
                      <td className="py-1.5 pr-2 font-semibold text-slate-400">{k}</td>
                      <td className="py-1.5 font-mono text-volt/90">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
            <Section title="Working logic — explained">
              <p className="text-[12px] leading-relaxed text-slate-300">{def.workingLogic}</p>
            </Section>
            <Section title="Field wiring guidance">
              <p className="text-[12px] leading-relaxed text-slate-300">{def.wiringNote}</p>
            </Section>
            <Section title="Internal contact map">
              <div className="space-y-1 font-mono text-[10.5px] text-slate-400">
                {def.contacts.length === 0 && <span>no switching contacts — pure {def.isLoad ? 'load' : def.category} element.</span>}
                {def.contacts.map((c, i) => {
                  const kind = c.no && c.nc ? 'changeover (CO)' : c.no ? 'normally-open (NO)' : 'normally-closed (NC)';
                  const driver = def.actuation === 'state' ? (def.momentary ? 'manual press (momentary)' : 'manual position (maintain)')
                    : def.actuation === 'coil' ? 'coil energization' : def.actuation === 'timer' ? 'preset-time condition'
                    : def.actuation === 'counter' ? 'count ≥ preset condition' : def.actuation === 'sensor' ? 'powered + target detected'
                    : def.actuation === 'overload' ? 'trip latch' : 'always conductive';
                  return (
                    <div key={i} className="rounded bg-ink-700/40 px-2 py-1">
                      <b className="text-slate-200">{c.com}</b> → {c.no && <span className="text-emerald-400">{c.no} (NO)</span>}
                      {c.no && c.nc && ' / '}{c.nc && <span className="text-pink-400">{c.nc} (NC)</span>}
                      <span className="text-slate-500"> · {kind}, driven by {driver}</span>
                    </div>
                  );
                })}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-lg border border-ink-700/60 bg-ink-800/60 p-3">
    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-volt">{title}</h3>
    {children}
  </div>
);

// ── stylized product photo ──────────────────────────────────────────────────

function ComponentPhoto({ def }: { def: ComponentDef }) {
  const c = def.category;
  return (
    <svg viewBox="0 0 300 150" className="w-full rounded-lg bg-gradient-to-b from-ink-700 to-ink-900">
      <defs>
        <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#64748b" /><stop offset="1" stopColor="#1e293b" />
        </linearGradient>
      </defs>
      {c === 'pushbutton' && (
        <g>
          <circle cx={150} cy={75} r={52} fill="#0f172a" stroke="url(#metal)" strokeWidth={5} />
          <circle cx={150} cy={75} r={38} fill={def.typeId === 'pb_no' ? '#16a34a' : '#dc2626'} />
          <circle cx={150} cy={75} r={38} fill="none" stroke="#0006" strokeWidth={8} />
          <ellipse cx={138} cy={60} rx={13} ry={8} fill="#ffffff33" />
          <text x={150} y={140} textAnchor="middle" fontSize={9} fill="#94a3b8">Ø22 mm illuminated head · spring return</text>
        </g>
      )}
      {(c === 'switch' && def.typeId.startsWith('selector')) && (
        <g>
          <circle cx={150} cy={78} r={50} fill="#111827" stroke="url(#metal)" strokeWidth={5} />
          <rect x={143} y={26} width={14} height={52} rx={6} fill="url(#metal)" />
          <circle cx={150} cy={32} r={11} fill="#f1f5f9" />
          <text x={92} y={62} fontSize={10} fill="#94a3b8">0</text>
          <text x={200} y={62} fontSize={10} fill="#94a3b8">{def.positions === 3 ? 'A' : '1'}</text>
          {def.positions === 3 && <text x={146} y={16} fontSize={10} fill="#94a3b8">2</text>}
          <text x={150} y={142} textAnchor="middle" fontSize={9} fill="#94a3b8">rotary cam · detented shaft · contact block behind</text>
        </g>
      )}
      {(def.typeId === 'toggle_no' || def.typeId === 'toggle_nc') && (
        <g>
          <rect x={110} y={55} width={80} height={60} rx={8} fill="#111827" stroke="url(#metal)" strokeWidth={3} />
          <path d="M150 105 L150 62" stroke="#cbd5e1" strokeWidth={8} strokeLinecap="round" />
          <circle cx={150} cy={58} r={8} fill="#e2e8f0" />
        </g>
      )}
      {(c === 'relay' || c === 'timer' || c === 'counter') && (
        <g>
          <rect x={95} y={30} width={110} height={92} rx={6} fill={c === 'relay' ? '#1e3a5f' : '#312e81'} stroke="#475569" strokeWidth={2} />
          <rect x={104} y={40} width={92} height={34} rx={3} fill="#0f172a" />
          <text x={150} y={62} textAnchor="middle" fontSize={13} fontFamily="monospace" fill={c === 'counter' ? '#4ade80' : '#facc15'}>
            {c === 'counter' ? 'C 000000' : c === 'timer' ? 'T  0.0 s' : 'K'}
          </text>
          {[0, 1, 2, 3].map((i) => <rect key={i} x={112 + i * 22} y={86} width={12} height={26} rx={2} fill="#64748b" />)}
          <text x={150} y={140} textAnchor="middle" fontSize={9} fill="#94a3b8">{c === 'relay' ? 'transparent housing · test button · LED' : c === 'timer' ? 'front preset potentiometer · 4 LEDs' : '7-segment PV / SV · mode jumpers'}</text>
        </g>
      )}
      {c === 'contactor' && (
        <g>
          <rect x={85} y={45} width={130} height={80} rx={5} fill="#263238" stroke="#455a64" strokeWidth={2} />
          <rect x={97} y={30} width={26} height={20} rx={2} fill="#37474f" />
          <rect x={137} y={30} width={26} height={20} rx={2} fill="#37474f" />
          <rect x={177} y={30} width={26} height={20} rx={2} fill="#37474f" />
          <text x={150} y={92} textAnchor="middle" fontSize={12} fill="#90a4ae" fontFamily="monospace">AC-3</text>
          <rect x={105} y={100} width={90} height={12} rx={3} fill="#111" />
          <text x={150} y={140} textAnchor="middle" fontSize={9} fill="#94a3b8">arc chutes · coil terminals A1/A2 · side aux block</text>
        </g>
      )}
      {c === 'overload' && (
        <g>
          <rect x={95} y={40} width={110} height={82} rx={5} fill="#3b1d1d" stroke="#475569" strokeWidth={2} />
          <circle cx={125} cy={82} r={13} fill="#0f172a" stroke="#f87171" strokeWidth={2} />
          <text x={125} y={86} textAnchor="middle" fontSize={9} fill="#fca5a5">R</text>
          <rect x={155} y={70} width={34} height={10} rx={2} fill="#64748b" />
          <text x={172} y={78} textAnchor="middle" fontSize={7} fill="#0f172a">SET</text>
          <text x={150} y={140} textAnchor="middle" fontSize={9} fill="#94a3b8">bimetal · trip indicator · manual/auto reset</text>
        </g>
      )}
      {c === 'sensor' && (
        <g>
          <rect x={70} y={58} width={120} height={34} rx={17} fill={def.typeId === 'sensor_photo' ? '#6d28d9' : def.typeId === 'sensor_capacitive' ? '#4338ca' : '#0e7490'} />
          <ellipse cx={190} cy={75} rx={9} ry={17} fill="#0f172a" stroke="#94a3b8" strokeWidth={2} />
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M70 ${64 + i * 8} q -28 ${i % 2 ? 6 : -4} -40 ${i * 2 - 2}`}
              stroke={['#a16207', '#1d4ed8', '#111827'][i]} strokeWidth={5} fill="none" strokeLinecap="round" />
          ))}
          <circle cx={110} cy={66} r={4} fill="#4ade80" />
          <text x={150} y={120} textAnchor="middle" fontSize={9} fill="#94a3b8">BN = +VDC · BU = 0V · BK = PNP signal</text>
          <path d="M205 75 h 30" stroke="#facc15" strokeWidth={2} strokeDasharray="4 4" />
          <text x={240} y={70} fontSize={8} fill="#facc15">Sr</text>
        </g>
      )}
      {c === 'load' && def.typeId === 'motor_3ph' && (
        <g>
          <circle cx={140} cy={75} r={46} fill="#334155" stroke="url(#metal)" strokeWidth={4} />
          {[...Array(8)].map((_, i) => (
            <rect key={i} x={138} y={33} width={4} height={12} fill="#1e293b" transform={`rotate(${i * 45} 140 75)`} />
          ))}
          <rect x={186} y={63} width={26} height={24} rx={3} fill="#475569" />
          <text x={140} y={80} textAnchor="middle" fontSize={16} fill="#cbd5e1" fontFamily="serif">M</text>
          <text x={150} y={140} textAnchor="middle" fontSize={9} fill="#94a3b8">frame · cooling fan · terminal box (link plates for Δ/Y)</text>
        </g>
      )}
      {(def.typeId === 'lamp_pilot' || def.typeId === 'bell_horn' || def.typeId === 'solenoid_valve') && (
        <g>
          <circle cx={150} cy={70} r={34} fill={def.typeId === 'lamp_pilot' ? '#713f12' : '#44403c'} stroke="url(#metal)" strokeWidth={4} />
          <circle cx={150} cy={70} r={20} fill={def.typeId === 'lamp_pilot' ? '#facc15' : '#111827'} opacity={0.9} />
          <rect x={135} y={104} width={30} height={18} rx={3} fill="#334155" />
          <text x={150} y={142} textAnchor="middle" fontSize={9} fill="#94a3b8">bezel mount · DIN terminals behind</text>
        </g>
      )}
      {c === 'supply' && (
        <g>
          <rect x={80} y={45} width={140} height={70} rx={6} fill="#1e293b" stroke="#475569" strokeWidth={2} />
          <rect x={95} y={58} width={30} height={44} rx={3} fill="#7f1d1d" />
          <rect x={175} y={58} width={30} height={44} rx={3} fill="#1e40af" />
          <text x={110} y={84} textAnchor="middle" fontSize={12} fill="#fecaca" fontFamily="monospace">L</text>
          <text x={190} y={84} textAnchor="middle" fontSize={12} fill="#bfdbfe" fontFamily="monospace">N</text>
          <text x={150} y={140} textAnchor="middle" fontSize={9} fill="#94a3b8">control transformer secondary · fused · earthed N per scheme</text>
        </g>
      )}
    </svg>
  );
}

// ── pinout diagrams ─────────────────────────────────────────────────────────

function PinoutSvg({ def, live, pairs }: { def: ComponentDef; live: Record<string, boolean>; pairs: boolean[] }) {
  const round = def.typeId.includes('pin');
  if (round) return <RoundBase def={def} live={live} pairs={pairs} />;
  return <TerminalStrip def={def} live={live} pairs={pairs} />;
}

function RoundBase({ def, live, pairs }: { def: ComponentDef; live: Record<string, boolean>; pairs: boolean[] }) {
  const n = def.terminals.length;
  const R = 62, cx = 105, cy = 88;
  return (
    <svg viewBox="0 0 300 180" className="w-full rounded bg-ink-900">
      <circle cx={cx} cy={cy} r={R + 16} fill="#111827" stroke="#334155" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={R} fill="#0b1220" stroke="#475569" />
      <path d={`M ${cx + R * 0.55} ${cy - R * 0.83} a ${R} ${R} 0 0 0 -${R * 0.28} ${R * 0.06}`} stroke="#94a3b8" strokeWidth={5} fill="none" />
      {def.terminals.map((t, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        const col = live[t.id] ? '#4ade80' : ROLE_COLOR[t.role] ?? '#64748b';
        return (
          <g key={t.id}>
            <circle cx={x} cy={y} r={7.5} fill={col} stroke="#0f172a" strokeWidth={1.5} />
            <text x={x + Math.cos(a) * 16} y={y + Math.sin(a) * 16 + 3.5} textAnchor="middle" fontSize={10.5} fill="#cbd5e1" fontFamily="monospace">{t.id}</text>
          </g>
        );
      })}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={10} fill="#64748b">{def.typeId === 'relay_8pin' ? '8-PIN' : '11-PIN'}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={8} fill="#475569">socket top view</text>
      {/* legend right */}
      <g fontFamily="monospace" fontSize={8.5}>
        {def.contacts.map((c, i) => {
          const closed = pairs[i];
          const y = 26 + i * 30;
          return (
            <g key={i}>
              <text x={205} y={y} fill="#94a3b8">COM {c.com}</text>
              <line x1={238} y1={y - 3} x2={268} y2={closed && c.no ? y - 9 : y + 7} stroke={closed ? '#4ade80' : '#64748b'} strokeWidth={1.6} />
              <line x1={232} y1={y - 3} x2={238} y2={y - 3} stroke="#e2e8f0" strokeWidth={1.6} />
              {c.no && <text x={272} y={y - 6} fill={closed ? '#4ade80' : '#3f6212'}>{c.no} NO</text>}
              {c.nc && <text x={272} y={y + 13} fill={!closed ? '#f472b6' : '#831843'}>{c.nc} NC</text>}
              <circle cx={232} cy={y - 3} r={2} fill="#e2e8f0" />
            </g>
          );
        })}
        {def.coil && (
          <text x={205} y={26 + Math.max(1, def.contacts.length) * 30} fill="#facc15">COIL {def.coil[0]}–{def.coil[1]}</text>
        )}
      </g>
    </svg>
  );
}

function TerminalStrip({ def, live, pairs }: { def: ComponentDef; live: Record<string, boolean>; pairs: boolean[] }) {
  const H = 30 + def.terminals.length * 26;
  return (
    <svg viewBox={`0 0 300 ${H}`} className="w-full rounded bg-ink-900">
      {def.terminals.map((t, i) => {
        const y = 22 + i * 26;
        const col = live[t.id] ? '#4ade80' : ROLE_COLOR[t.role] ?? '#64748b';
        const pi = def.contacts.findIndex((c) => c.com === t.id || c.no === t.id || c.nc === t.id);
        const inPairClosed = pi >= 0 && pairs[pi] && def.contacts[pi].com !== t.id;
        return (
          <g key={t.id}>
            <rect x={18} y={y - 10} width={150} height={20} rx={4} fill="#111827" stroke="#334155" />
            <circle cx={12} cy={y} r={6} fill={col} stroke="#0f172a" strokeWidth={1.5} />
            <text x={26} y={y + 3.5} fontSize={10} fill="#cbd5e1" fontFamily="monospace">{t.label}</text>
            <text x={100} y={y + 3.5} fontSize={8} fill={inPairClosed ? '#4ade80' : '#475569'} fontFamily="monospace">
              {t.role.toUpperCase()}
            </text>
            {pi >= 0 && def.contacts[pi].com === t.id && (
              <line x1={172} y1={y} x2={200} y2={pairs[pi] && def.contacts[pi].no ? y - 8 : y + 8} stroke="#e2e8f0" strokeWidth={1.4} />
            )}
          </g>
        );
      })}
      {def.contacts.map((c, i) => {
        const ci = def.terminals.findIndex((t) => t.id === c.com);
        if (ci < 0) return null;
        const y = 22 + ci * 26;
        return (
          <g key={i} fontFamily="monospace" fontSize={8.5}>
            <line x1={172} y1={y} x2={224} y2={y} stroke="#1f2937" strokeWidth={1} />
            {c.no && <text x={228} y={y - 4} fill={pairs[i] ? '#4ade80' : '#365314'}>{c.no} {pairs[i] ? '●' : '○'}</text>}
            {c.nc && <text x={228} y={y + 8} fill={!pairs[i] ? '#f472b6' : '#831843'}>{c.nc} {!pairs[i] ? '●' : '○'}</text>}
          </g>
        );
      })}
    </svg>
  );
}
