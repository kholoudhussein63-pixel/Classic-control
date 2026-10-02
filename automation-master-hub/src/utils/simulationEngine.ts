import { COMPONENT_MAP } from '../data/componentsData';
import type { CircuitDoc, ComponentDef, NodeInstance, NodeState, SimResult, ValidationIssue, Wire } from '../types';

// ── helpers ──────────────────────────────────────────────────────────────────

export const tk = (node: string, term: string) => `${node}|${term}`;

export function defaultState(typeId: string): NodeState {
  const def = COMPONENT_MAP[typeId];
  return {
    pos: 0,
    pressed: false,
    tripped: false,
    elapsed: 0,
    count: 0,
    preset: def?.defaultDelay ?? (def?.category === 'counter' ? 5 : 3),
  };
}

export function wiredTerminalKeys(wires: Wire[]): Set<string> {
  const s = new Set<string>();
  for (const w of wires) {
    s.add(tk(w.a.node, w.a.term));
    s.add(tk(w.b.node, w.b.term));
  }
  return s;
}

class UF {
  private p = new Map<string, string>();
  find(x: string): string {
    let r = this.p.get(x) ?? x;
    if (r !== x) r = this.find(r);
    this.p.set(x, r);
    return r;
  }
  union(a: string, b: string) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.p.set(ra, rb);
  }
}

// ── pair condition per actuation class ───────────────────────────────────────

function pairCond(
  def: ComponentDef, node: NodeInstance, pairIdx: number,
  energized: Record<string, boolean>, powered: Record<string, boolean>,
  time: number, forcePressed?: Record<string, boolean>,
): boolean {
  const st = node.state;
  const pressed = st.pressed || !!forcePressed?.[node.id];
  switch (def.actuation) {
    case 'none': return true;
    case 'state':
      if (def.momentary) return pressed;
      if ((def.positions ?? 2) === 3) return st.pos === pairIdx + 1;
      return st.pos >= 1;
    case 'coil': return !!energized[node.id];
    case 'overload': return st.tripped;
    case 'sensor': return !!powered[node.id] && pressed;
    case 'timer': {
      const p = st.preset > 0 ? st.preset : 1;
      if (def.typeId === 'timer_on') return st.elapsed >= p && st.elapsed > 0;
      if (def.typeId === 'timer_off') return !!energized[node.id] || st.elapsed > 0;
      return !!energized[node.id] && Math.floor((time % (2 * p)) / p) === 0; // pulse/flasher
    }
    case 'counter': {
      const p = st.preset > 0 ? st.preset : 1;
      return pairIdx === 0 && st.count > 0 && st.count >= p;
    }
  }
}

// ── core: fixed-point energization solver ────────────────────────────────────

export interface WarmState {
  energized: Record<string, boolean>;
  powered: Record<string, boolean>;
}

export interface SimOpts {
  time?: number;
  warm?: WarmState;
  forcePressed?: Record<string, boolean>; // latch-analysis: treat buttons as held
  validate?: boolean;
}

export function simulate(circuit: CircuitDoc, opts: SimOpts = {}): SimResult {
  const { nodes, wires } = circuit;
  const time = opts.time ?? 0;
  const defOf = (n: NodeInstance) => COMPONENT_MAP[n.typeId];

  const supplies = nodes.filter((n) => defOf(n)?.category === 'supply');
  const lKeys = new Set<string>();
  const nKeys = new Set<string>();
  for (const s of supplies) {
    for (const t of defOf(s).terminals) {
      if (t.role === 'line') lKeys.add(tk(s.id, t.id));
      if (t.role === 'neutral') nKeys.add(tk(s.id, t.id));
    }
  }

  let energized: Record<string, boolean> = { ...(opts.warm?.energized ?? {}) };
  let powered: Record<string, boolean> = { ...(opts.warm?.powered ?? {}) };
  let uf = new UF();
  let Lroots = new Set<string>();
  let Nroots = new Set<string>();
  let roots = new Map<string, string>();
  let pairClosed: Record<string, boolean[]> = {};
  let stable = false;

  for (let iter = 0; iter < 30 && !stable; iter++) {
    uf = new UF();
    for (const w of wires) uf.union(tk(w.a.node, w.a.term), tk(w.b.node, w.b.term));
    for (const nd of nodes) {
      const def = defOf(nd);
      if (!def) continue;
      pairClosed[nd.id] = def.contacts.map((p, i) => {
        const cond = pairCond(def, nd, i, energized, powered, time, opts.forcePressed);
        const target = cond ? p.no : p.nc;
        if (target) uf.union(tk(nd.id, p.com), tk(nd.id, target));
        return cond;
      });
    }
    Lroots = new Set([...lKeys].map((k) => uf.find(k)));
    Nroots = new Set([...nKeys].map((k) => uf.find(k)));
    roots = new Map();
    for (const nd of nodes) {
      const def = defOf(nd);
      if (!def) continue;
      for (const t of def.terminals) roots.set(tk(nd.id, t.id), uf.find(tk(nd.id, t.id)));
    }

    const nextE: Record<string, boolean> = {};
    const nextP: Record<string, boolean> = {};
    for (const nd of nodes) {
      const def = defOf(nd);
      if (!def) continue;
      if (def.coil) {
        const [a, b] = def.coil.map((x) => tk(nd.id, x));
        const ra = roots.get(a), rb = roots.get(b);
        nextE[nd.id] =
          (!!ra && !!rb && ((Lroots.has(ra) && Nroots.has(rb)) || (Lroots.has(rb) && Nroots.has(ra))));
      }
      if (def.actuation === 'sensor') {
        const bn = roots.get(tk(nd.id, 'BN'));
        const bu = roots.get(tk(nd.id, 'BU'));
        nextP[nd.id] = !!bn && !!bu && Lroots.has(bn) && Nroots.has(bu);
      }
    }
    stable = sameMap(nextE, energized) && sameMap(nextP, powered);
    energized = nextE;
    powered = nextP;
  }

  // terminal live flags + live wires
  const live: Record<string, Record<string, boolean>> = {};
  for (const nd of nodes) {
    const def = defOf(nd);
    if (!def) continue;
    live[nd.id] = {};
    for (const t of def.terminals) {
      const r = roots.get(tk(nd.id, t.id));
      live[nd.id][t.id] = !!r && Lroots.has(r);
    }
  }
  const liveWires: Record<string, boolean> = {};
  for (const w of wires) {
    const r = roots.get(tk(w.a.node, w.a.term));
    liveWires[w.id] = !!r && Lroots.has(r);
  }

  // short circuit = some L rail root also an N rail root
  const intersect = [...Lroots].filter((r) => Nroots.has(r));
  let shortPath: string[] = [];
  if (intersect.length) shortPath = traceShortPath(nodes, wires, pairClosed, lKeys, nKeys);

  const timerProgress: Record<string, number> = {};
  const counts: Record<string, number> = {};
  const motorSpin: Record<string, boolean> = {};
  for (const nd of nodes) {
    const def = defOf(nd);
    if (!def) continue;
    if (def.category === 'timer') {
      const p = nd.state.preset || 1;
      if (def.typeId === 'timer_on') timerProgress[nd.id] = Math.min(1, nd.state.elapsed / p);
      else if (def.typeId === 'timer_off') timerProgress[nd.id] = Math.min(1, nd.state.elapsed / p);
      else timerProgress[nd.id] = (time % (2 * p)) / p;
    }
    if (def.category === 'counter') counts[nd.id] = nd.state.count;
    if (def.isLoad) motorSpin[nd.id] = !!energized[nd.id];
  }

  const base: SimResult = {
    energized, live, liveWires, pairs: pairClosed, timerProgress, counts,
    poweredSensors: powered,
    shortCircuit: intersect.length > 0, shortPath,
    unstable: !stable,
    motorSpin,
    errors: stable ? [] : [{
      id: 'unstable', severity: 'error',
      title: 'Unstable circuit (relay chatter)',
      detail: 'The energization state never settles — oscillating coil/contact loop. Check flasher wiring and cross-coupled contacts.',
    }],
  };

  if (opts.validate !== false) base.errors = validate(circuit, base, time, opts.warm);
  return base;
}

function sameMap(a: Record<string, boolean>, b: Record<string, boolean>) {
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => a[k] === b[k]);
}

// BFS through the final topology to describe the short path
function traceShortPath(
  nodes: NodeInstance[], wires: Wire[], pairClosed: Record<string, boolean[]>,
  lKeys: Set<string>, nKeys: Set<string>,
): string[] {
  const adj = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push(b);
  };
  const defOf = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    return n ? COMPONENT_MAP[n.typeId] : undefined;
  };
  for (const w of wires) {
    link(tk(w.a.node, w.a.term), tk(w.b.node, w.b.term));
    link(tk(w.b.node, w.b.term), tk(w.a.node, w.a.term));
  }
  for (const nd of nodes) {
    const def = defOf(nd.id);
    if (!def) continue;
    const conds = pairClosed[nd.id] ?? [];
    def.contacts.forEach((p, i) => {
      const target = conds[i] ? p.no : p.nc;
      if (target) {
        link(tk(nd.id, p.com), tk(nd.id, target));
        link(tk(nd.id, target), tk(nd.id, p.com));
      }
    });
  }
  const prev = new Map<string, string>();
  const q = [...lKeys];
  const seen = new Set(q);
  let hit: string | undefined;
  while (q.length && !hit) {
    const cur = q.shift()!;
    if (nKeys.has(cur)) { hit = cur; break; }
    for (const nb of adj.get(cur) ?? []) {
      if (!seen.has(nb)) { seen.add(nb); prev.set(nb, cur); q.push(nb); }
    }
  }
  if (!hit) return [];
  const path: string[] = [];
  let c: string | undefined = hit;
  while (c) { path.unshift(c); c = prev.get(c); }
  return path;
}

// ── smart logic validation ───────────────────────────────────────────────────

function validate(circuit: CircuitDoc, sim: SimResult, time: number, warm?: WarmState): ValidationIssue[] {
  const { nodes, wires } = circuit;
  const issues: ValidationIssue[] = [];
  const defOf = (n: NodeInstance) => COMPONENT_MAP[n.typeId];
  const name = (n: NodeInstance) => n.state.label || defOf(n).name;
  const wired = wiredTerminalKeys(wires);

  if (!nodes.some((n) => defOf(n)?.category === 'supply')) {
    issues.push({ id: 'no-supply', severity: 'info', title: 'No control power supply', detail: 'Drop a Control Power Supply (L/N) so the simulation engine can energize the circuit.' });
  }

  // 1 ── short circuit
  if (sim.shortCircuit) {
    const pathNames = sim.shortPath
      .map((k) => { const [nd] = k.split('|'); const n = nodes.find((x) => x.id === nd); return n ? `${name(n)}:${k.split('|')[1]}` : k; });
    issues.push({
      id: 'short', severity: 'error',
      title: 'SHORT CIRCUIT — Phase (L) tied to Neutral (N)',
      detail: `A closed path exists with NO load between L and N: ${pathNames.slice(0, 8).join(' → ')} … Trips the MCB / burns the supply.`,
      nodes: sim.shortPath.map((k) => k.split('|')[0]),
    });
  }

  // scenario: every NO pushbutton held down (start-button analysis)
  const pbs = nodes.filter((n) => defOf(n)?.typeId === 'pb_no');
  let pressedSim: SimResult | null = null;
  let persistSim: SimResult | null = null;
  if (pbs.length) {
    pressedSim = simulate(circuit, {
      time, warm,
      forcePressed: Object.fromEntries(pbs.map((p) => [p.id, true])),
      validate: false,
    });
    // buttons released again, warm-started from the pressed state:
    // devices that STAY on are genuinely latched by the circuit itself
    persistSim = simulate(circuit, {
      time,
      warm: { energized: pressedSim.energized, powered: pressedSim.poweredSensors },
      validate: false,
    });
  }

  // 2 ── missing latch / seal-in: coil dies the moment the button is released
  for (const n of nodes) {
    const def = defOf(n);
    if (!def?.coil || def.isLoad) continue;
    if (!(def.category === 'contactor' || def.category === 'relay' || def.category === 'timer' || def.category === 'counter')) continue;
    const baseOn = !!sim.energized[n.id];
    const pressedOn = !!pressedSim?.energized[n.id];
    const staysOn = !!persistSim?.energized[n.id];
    if (!baseOn && pressedOn && !staysOn) {
      issues.push({
        id: `latch-${n.id}`, severity: 'warning',
        title: `Missing latch (seal-in) on ${name(n)}`,
        detail: `${name(n)}'s coil only stays energized while the START button is physically held — the circuit does not latch. Wire one of its own NO auxiliary contacts in parallel with the start contact.`,
        nodes: [n.id, ...pbs.map((p) => p.id)],
      });
    }
  }

  // 3 ── contactor interlocks (star/delta, fwd/rev)
  const kms = nodes.filter((n) => defOf(n)?.category === 'contactor');
  const scenarios: Array<Record<string, boolean>> = [sim.energized, pressedSim?.energized ?? {}];
  for (let i = 0; i < kms.length; i++) {
    for (let j = i + 1; j < kms.length; j++) {
      const a = kms[i], b = kms[j];
      const bothSomewhere = scenarios.some((s) => s[a.id] && s[b.id]);
      if (!bothSomewhere) continue;
      const ncWired = (c: NodeInstance) => {
        const d = defOf(c);
        return d.contacts.some((p) => p.nc && wired.has(tk(c.id, p.com)) && wired.has(tk(c.id, p.nc)));
      };
      const aWired = ncWired(a), bWired = ncWired(b);
      if (!aWired && !bWired) {
        issues.push({
          id: `interlock-${a.id}-${b.id}`, severity: 'error',
          title: `No electrical interlock: ${name(a)} / ${name(b)}`,
          detail: `Both contactors can be energized at the same time and neither NC auxiliary contact is wired. In a star-delta or forward-reverse scheme that means a phase-to-phase short through the motor windings. Insert each contactor's NC aux (21–22) in series with the other's coil.`,
          nodes: [a.id, b.id],
        });
      } else if (aWired && bWired) {
        // both NCs are wired yet both coils still close → the interlock is bypassed
        issues.push({
          id: `interlockfail-${a.id}-${b.id}`, severity: 'error',
          title: `Interlock defeated: ${name(a)} AND ${name(b)} both energized`,
          detail: `Even with both NC auxiliary contacts wired, the simulation still shows the two coils closed simultaneously — check that each coil's feed really passes through the opposite contactor's 21–22 pair.`,
          nodes: [a.id, b.id],
        });
      }
      // mixed (one side wired): a legitimate series/sequence pair (e.g. line vs star contactor)
    }
  }

  return issues;
}

// ── time-step: timers / counters advance while the simulation runs ──────────

export function stepCircuit(
  circuit: CircuitDoc, sim: SimResult, dt: number, prevInLive: Record<string, boolean>,
): CircuitDoc {
  let changed = false;
  const nodes = circuit.nodes.map((nd) => {
    const def = COMPONENT_MAP[nd.typeId];
    if (!def) return nd;
    let s = nd.state;
    if (def.category === 'timer') {
      const on = !!sim.energized[nd.id];
      if (def.typeId === 'timer_on') {
        if (on) s = { ...s, elapsed: Math.min(s.preset, s.elapsed + dt) };
        else if (s.elapsed !== 0) s = { ...s, elapsed: 0 };
      } else if (def.typeId === 'timer_off') {
        if (on) s = { ...s, elapsed: s.preset };
        else if (s.elapsed > 0) s = { ...s, elapsed: Math.max(0, s.elapsed - dt) };
      }
    }
    if (def.category === 'counter') {
      // remote reset via RST terminal
      if (sim.live[nd.id]?.RST && s.count !== 0) s = { ...s, count: 0 };
      const inNow = !!sim.live[nd.id]?.IN;
      if (inNow && !prevInLive[nd.id]) {
        s = { ...s, count: Math.min(9999, s.count + 1) };
      }
    }
    // thermal auto-reset when RST (remote reset) is energized
    if (def.typeId === 'overload' && sim.live[nd.id]?.RST && s.tripped) {
      s = { ...s, tripped: false };
    }
    if (s !== nd.state) { changed = true; return { ...nd, state: s }; }
    return nd;
  });
  return changed ? { ...circuit, nodes } : circuit;
}

export function snapshotInLive(circuit: CircuitDoc, sim: SimResult): Record<string, boolean> {
  const m: Record<string, boolean> = {};
  for (const nd of circuit.nodes) {
    if (COMPONENT_MAP[nd.typeId]?.category === 'counter') m[nd.id] = !!sim.live[nd.id]?.IN;
  }
  return m;
}
