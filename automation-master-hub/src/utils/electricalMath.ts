import type { BreakerCurve, MotorParams, MotorResults } from '../types';

// ── Motor sizing per IEC 60947 / common field practice ──────────────────────

const SQRT3 = Math.sqrt(3);

/** Standard thermal-magnetic MCB ratings (A) */
export const BREAKER_SIZES = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160];

/** Standard AC-3 contactor frames (A) */
export const CONTACTOR_SIZES = [7, 9, 12, 18, 25, 32, 40, 50, 65, 80, 95, 115, 140, 170, 185, 225, 265, 300, 330];

/** Standard overload relay setting ranges (A) */
export const OVERLOAD_RANGES: [number, number][] = [
  [0.1, 0.17], [0.16, 0.25], [0.23, 0.37], [0.34, 0.55], [0.5, 0.8], [0.72, 1.1],
  [1.0, 1.6], [1.6, 2.5], [2.3, 3.7], [3.4, 5.5], [4.8, 7.5], [7, 10], [9.5, 13],
  [12, 17], [16, 23], [21, 28], [25, 32], [30, 40], [38, 49], [48, 65], [63, 80],
  [80, 95], [96, 110], [125, 140], [140, 160],
];

export const kwToHp = (kw: number) => kw / 0.7457;
export const hpToKw = (hp: number) => hp * 0.7457;

export function pickStandard(sizes: number[], min: number): number {
  return sizes.find((s) => s >= min) ?? sizes[sizes.length - 1];
}

export function pickOverloadRange(setting: number): [number, number] | null {
  return OVERLOAD_RANGES.find(([lo, hi]) => setting >= lo && setting <= hi) ?? null;
}

/** Curve multipliers: IEC thermal-magnetic instantaneous trip bands */
export const CURVE_MULTIPLIERS: Record<BreakerCurve, [number, number]> = {
  C: [5, 10],
  D: [10, 20],
};

export function calcMotor(p: MotorParams): MotorResults {
  const { powerKw, voltage, cosPhi, efficiency, startMethod, breakerCurve, inrushFactor } = p;

  // FLC = P·1000 / (√3 · U · cosφ · η)
  const flc = (powerKw * 1000) / (SQRT3 * voltage * cosPhi * efficiency);

  const isStar = startMethod === 'star-delta';

  // In star, winding (phase) current = line / √3 ≈ 0.58 × FLC
  const phaseCurrent = isStar ? flc / SQRT3 : flc;

  // Starting line current: DOL = k·FLC ; star connection = k·FLC/3
  const startCurrentLine = isStar ? (inrushFactor * flc) / 3 : inrushFactor * flc;

  // Torque ∝ U² : star reduces winding voltage to 1/√3 → 1/3 of DOL torque
  const startTorquePct = isStar ? 33 : 100;

  // Thermal relay: DOL → 1.00 × FLC ; star-delta → 0.58 × FLC (sees winding current)
  const overloadSetting = isStar ? 0.58 * flc : flc;

  // Breaker: motor feeders use ≥1.25×FLC (curve C) / ≥1.4×FLC (curve D)
  const breakerIn = pickStandard(BREAKER_SIZES, flc * (breakerCurve === 'D' ? 1.4 : 1.25));
  const [cmin, cmax] = CURVE_MULTIPLIERS[breakerCurve];
  const breakerTripMin = breakerIn * cmin;
  const breakerTripMax = breakerIn * cmax;

  const contactorAc3 = flc;
  const contactorAc3Next = pickStandard(CONTACTOR_SIZES, flc);

  return {
    flc,
    phaseCurrent,
    startCurrentLine,
    startTorquePct,
    overloadSetting,
    breakerIn,
    breakerTripMin,
    breakerTripMax,
    contactorAc3,
    contactorAc3Next,
    cableFactor: flc,
    powerKw,
    powerHp: kwToHp(powerKw),
    voltage,
  };
}

/** Does the chosen breaker curve clear the starting current without nuisance trip? */
export function breakerStartCheck(p: MotorParams, r: MotorResults): { ok: boolean; note: string } {
  if (r.startCurrentLine <= r.breakerTripMin) {
    return { ok: true, note: `Curve ${p.breakerCurve}: peak starting current ${r.startCurrentLine.toFixed(1)} A stays below the ${r.breakerTripMin.toFixed(0)} A magnetic threshold — no nuisance trip.` };
  }
  return {
    ok: false,
    note: `Starting current ${r.startCurrentLine.toFixed(1)} A exceeds the curve ${p.breakerCurve} instantaneous floor (${r.breakerTripMin.toFixed(0)} A). Move to curve D, upsize the breaker, or use a motor-protection breaker (MCCB/MSF) or soft-starter.`,
  };
}

export const fmt = (v: number, d = 1) =>
  Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—';
