import type * as React from 'react';
import { useMemo, useState } from 'react';
import { Calculator as CalcIcon, Gauge, Zap, Shield, CircleAlert, ArrowDownUp } from 'lucide-react';
import type { MotorParams } from '../types';
import {
  breakerStartCheck, calcMotor, fmt, hpToKw, kwToHp, OVERLOAD_RANGES, pickOverloadRange,
} from '../utils/electricalMath';

const VOLTAGES = [380, 400, 415, 690];
const STD_MOTORS: [number, number][] = [ // kW, HP
  [0.37, 0.5], [0.55, 0.75], [0.75, 1], [1.1, 1.5], [1.5, 2], [2.2, 3], [3, 4],
  [4, 5.5], [5.5, 7.5], [7.5, 10], [11, 15], [15, 20], [18.5, 25], [22, 30],
  [30, 40], [37, 50], [45, 60], [55, 75], [75, 100], [90, 120], [110, 150], [132, 180], [160, 215], [200, 270],
];

export function Calculator() {
  const [unit, setUnit] = useState<'kW' | 'HP'>('kW');
  const [p, setP] = useState<MotorParams>({
    powerKw: 5.5, voltage: 400, cosPhi: 0.84, efficiency: 0.88,
    startMethod: 'dol', breakerCurve: 'D', inrushFactor: 7,
  });

  const r = useMemo(() => calcMotor(p), [p]);
  const chk = useMemo(() => breakerStartCheck(p, r), [p, r]);
  const olRange = pickOverloadRange(r.overloadSetting);

  const set = (patch: Partial<MotorParams>) => setP((x) => ({ ...x, ...patch }));
  const powerDisplay = unit === 'kW' ? p.powerKw : kwToHp(p.powerKw);

  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[380px_1fr]">
      {/* inputs */}
      <div className="card h-fit p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-volt"><CalcIcon size={16} /> Motor & Protection Calculator</h2>
        <p className="mb-4 mt-1 text-[11px] text-slate-500">IEC 60947 sizing for 3-phase squirrel-cage motors.</p>

        <Field label="Rated power">
          <div className="flex gap-2">
            <input
              type="number" step="0.01" min="0.05" value={Number(powerDisplay.toFixed(2))}
              onChange={(e) => {
                const v = Math.max(0.05, Number(e.target.value) || 0.05);
                set({ powerKw: unit === 'kW' ? v : hpToKw(v) });
              }}
              className="w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-volt"
            />
            <button
              onClick={() => setUnit(unit === 'kW' ? 'HP' : 'kW')}
              className="flex items-center gap-1 rounded-md border border-ink-600 px-3 text-xs font-bold text-slate-300 hover:border-volt"
              title="toggle kW / HP"
            ><ArrowDownUp size={12} />{unit}</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {STD_MOTORS.filter((_, i) => i % 3 === 0).map(([kw, hp]) => (
              <button key={kw} onClick={() => set({ powerKw: kw })}
                className={`rounded px-1.5 py-0.5 text-[9px] font-mono ${Math.abs(p.powerKw - kw) < 0.01 ? 'bg-volt text-black' : 'bg-ink-700 text-slate-400 hover:bg-ink-600'}`}>
                {kw}kW/{hp}HP
              </button>
            ))}
          </div>
        </Field>

        <Field label="Line voltage U (V)">
          <div className="flex gap-1.5">
            {VOLTAGES.map((v) => (
              <button key={v} onClick={() => set({ voltage: v })}
                className={`flex-1 rounded-md border py-1.5 font-mono text-xs ${p.voltage === v ? 'border-volt bg-volt/15 text-volt' : 'border-ink-600 text-slate-400 hover:border-slate-500'}`}>
                {v}
              </button>
            ))}
          </div>
        </Field>

        <Field label={`Power factor cos φ = ${p.cosPhi.toFixed(2)}`}>
          <input type="range" min={0.6} max={0.95} step={0.01} value={p.cosPhi}
            onChange={(e) => set({ cosPhi: Number(e.target.value) })} className="w-full accent-yellow-400" />
        </Field>

        <Field label={`Efficiency η = ${(p.efficiency * 100).toFixed(0)} %`}>
          <input type="range" min={0.6} max={0.97} step={0.01} value={p.efficiency}
            onChange={(e) => set({ efficiency: Number(e.target.value) })} className="w-full accent-yellow-400" />
        </Field>

        <Field label="Starting method">
          <div className="grid grid-cols-2 gap-1.5">
            {(['dol', 'star-delta'] as const).map((m) => (
              <button key={m} onClick={() => set({ startMethod: m })}
                className={`rounded-md border py-2 text-xs font-bold ${p.startMethod === m ? 'border-volt bg-volt/15 text-volt' : 'border-ink-600 text-slate-400 hover:border-slate-500'}`}>
                {m === 'dol' ? 'DOL direct-on-line' : 'STAR–DELTA'}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Breaker curve">
          <div className="grid grid-cols-3 gap-1.5">
            {(['C', 'D'] as const).map((c) => (
              <button key={c} onClick={() => set({ breakerCurve: c })}
                className={`rounded-md border py-1.5 font-mono text-xs font-bold ${p.breakerCurve === c ? 'border-volt bg-volt/15 text-volt' : 'border-ink-600 text-slate-400'}`}>
                {c}
              </button>
            ))}
            <span className="self-center text-[10px] text-slate-500">C: 5–10·In · D: 10–20·In</span>
          </div>
        </Field>

        <Field label={`Inrush k = Istart/In = ${p.inrushFactor}`}>
          <input type="range" min={4} max={10} step={0.5} value={p.inrushFactor}
            onChange={(e) => set({ inrushFactor: Number(e.target.value) })} className="w-full accent-yellow-400" />
        </Field>

        <div className="mt-3 rounded-lg border border-ink-700 bg-ink-800/70 p-3 font-mono text-[10.5px] leading-relaxed text-slate-400">
          <div className="text-volt/90">I_FL = P·1000 / (√3 · U · cosφ · η)</div>
          <div>I_FL = {p.powerKw}·1000 / (1.732·{p.voltage}·{p.cosPhi.toFixed(2)}·{p.efficiency.toFixed(2)}) = <b className="text-emerald-300">{fmt(r.flc)} A</b></div>
          <div className="mt-1">rule of thumb ≈ 2 A/HP at 400 V → {fmt(kwToHp(p.powerKw) * 2)} A</div>
        </div>
      </div>

      {/* results */}
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card icon={<Gauge size={16} className="text-emerald-400" />} title="Full-load current FLC" value={`${fmt(r.flc)} A`} sub={`winding: ${fmt(r.phaseCurrent)} A ${p.startMethod === 'star-delta' ? '(star = line/√3)' : ''}`} />
          <Card icon={<Zap size={16} className="text-volt" />} title="Starting current (line)" value={`${fmt(r.startCurrentLine)} A`}
            sub={p.startMethod === 'dol' ? `${p.inrushFactor}× FLC inrush` : `${p.inrushFactor}× FLC ÷ 3 — star winding sees 230 V`} accent />
          <Card icon={<CircleAlert size={16} className="text-orange-400" />} title="Starting torque" value={`${r.startTorquePct} %`}
            sub={p.startMethod === 'dol' ? 'full voltage' : '1/3 of DOL — no loaded starts'} />
          <Card icon={<Shield size={16} className="text-sky-400" />} title="Thermal overload setting" value={`${fmt(r.overloadSetting)} A`}
            sub={p.startMethod === 'dol' ? '1.0 × FLC in the line' : '0.58 × FLC — relay sits in the winding branch'} />
          <Card icon={<Shield size={16} className="text-red-400" />} title="MCB / breaker" value={`${r.breakerIn} A curve ${p.breakerCurve}`}
            sub={`instantaneous trip ${fmt(r.breakerTripMin, 0)}…${fmt(r.breakerTripMax, 0)} A`} />
          <Card icon={<Gauge size={16} className="text-indigo-400" />} title="Contactor AC-3" value={`${r.contactorAc3Next} A`}
            sub={`required ≥ ${fmt(r.contactorAc3)} A (AC-3 = making/braking a running motor)`} />
        </div>

        <div className={`rounded-xl border p-4 text-xs leading-relaxed ${chk.ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}>
          <b>{chk.ok ? '✓ Coordination OK' : '⚠ Coordination warning'}</b>
          <p className="mt-1 text-slate-300">{chk.note}</p>
          {olRange && (
            <p className="mt-1 text-slate-300">
              Nearest thermal relay setting band: <b className="font-mono">{olRange[0]} – {olRange[1]} A</b> — dial to {fmt(r.overloadSetting)} A ≈ motor FLC
              {p.startMethod === 'star-delta' && ' (the star point contactor KMY is only rated 0.58× — delta contactor at full FLC)'}.
            </p>
          )}
        </div>

        <div className="card overflow-hidden">
          <h3 className="border-b border-ink-700/60 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-volt">Reference — standard AC-3 frames & relay bands</h3>
          <div className="grid gap-0 text-[11px] md:grid-cols-2">
            <table className="w-full">
              <tbody>
                <tr className="border-b border-ink-700/50 bg-ink-800/60 text-slate-400"><th className="px-3 py-1.5 text-left">FLC band</th><th className="px-3 py-1.5 text-left">typical motor 400V</th><th className="px-3 py-1.5 text-left">KM / F / MCB</th></tr>
                {STD_MOTORS.slice(3, 15).map(([kw, hp]) => {
                  const rr = calcMotor({ ...p, powerKw: kw });
                  return (
                    <tr key={kw} className="border-b border-ink-800/70 font-mono">
                      <td className="px-3 py-1 text-slate-300">{fmt(rr.flc)} A</td>
                      <td className="px-3 py-1 text-slate-400">{kw} kW / {hp} HP</td>
                      <td className="px-3 py-1 text-volt/90">{rr.contactorAc3Next}A · dial {fmt(rr.overloadSetting)}A · {rr.breakerIn}A {p.breakerCurve}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-ink-700/50 p-4 text-slate-400 md:border-l md:border-t-0">
              <p><b className="text-slate-200">DOL:</b> I_start = 4…10 × FLC, torque 100%. Relay at <b className="text-volt">1.0 × FLC</b>. Breaker curve D mandatory when 8×FLC approaches 10×In.</p>
              <p className="mt-2"><b className="text-slate-200">Star-Delta:</b> line I_start ≈ I_DOL/3, torque/3. Winding current in star = FLC/√3 ≈ <b className="text-volt">0.58 × FLC</b> → the star contactor and its relay dial use that value; transition surge Δ ≈ 1.3×FLC.</p>
              <p className="mt-2 font-mono text-[10px]">Setting bands: {OVERLOAD_RANGES.filter((_, i) => i % 4 === 0).map(([a, b]) => `${a}–${b}`).join(' · ')} A</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="mb-4">
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</label>
    {children}
  </div>
);

const Card = ({ icon, title, value, sub, accent }: { icon: React.ReactNode; title: string; value: string; sub: string; accent?: boolean }) => (
  <div className={`card p-3 ${accent ? 'border-volt/40' : ''}`}>
    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{icon}{title}</div>
    <div className={`mt-1.5 font-mono text-xl font-bold ${accent ? 'text-volt' : 'text-slate-100'}`}>{value}</div>
    <div className="mt-1 text-[10.5px] leading-snug text-slate-500">{sub}</div>
  </div>
);
