import { COMPONENT_MAP } from '../data/componentsData';
import type { CircuitDoc, LadderLiteral, LadderRung, NodeInstance, SimResult } from '../types';
import { tk } from './simulationEngine';

// ── Classic control schematic → PLC ladder logic conversion ─────────────────
// Every coil / load terminal reachable from the L rail through switchable
// contact pairs becomes a rung: each series path is one branch, parallel
// branches stack in the rung.

interface Edge { to: string; lit?: LadderLiteral }

export function toLadder(circuit: CircuitDoc, sim: SimResult): LadderRung[] {
  const { nodes, wires } = circuit;
  const defOf = (n: NodeInstance) => COMPONENT_MAP[n.typeId];

  const adj = new Map<string, Edge[]>();
  const link = (a: string, b: string, lit?: LadderLiteral) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push({ to: b, lit });
  };

  for (const w of wires) {
    link(tk(w.a.node, w.a.term), tk(w.b.node, w.b.term));
    link(tk(w.b.node, w.b.term), tk(w.a.node, w.a.term));
  }

  for (const nd of nodes) {
    const def = defOf(nd);
    if (!def) continue;
    const dev = nd.state.label ?? def.mnemonic;
    def.contacts.forEach((p, i) => {
      const closed = !!(sim.pairs[nd.id] ?? [])[i];
      if (p.no) {
        const lit: LadderLiteral = { nodeId: nd.id, device: dev, contact: `${p.com}-${p.no}`, polarity: 'NO', closed };
        link(tk(nd.id, p.com), tk(nd.id, p.no), lit);
        link(tk(nd.id, p.no), tk(nd.id, p.com), lit);
      }
      if (p.nc) {
        const lit: LadderLiteral = { nodeId: nd.id, device: dev, contact: `${p.com}-${p.nc}`, polarity: 'NC', closed };
        link(tk(nd.id, p.com), tk(nd.id, p.nc), lit);
        link(tk(nd.id, p.nc), tk(nd.id, p.com), lit);
      }
    });
  }

  const supply = nodes.find((n) => defOf(n)?.category === 'supply');
  if (!supply) return [];
  const lKey = tk(supply.id, 'L');

  const rungs: LadderRung[] = [];
  for (const nd of nodes) {
    const def = defOf(nd);
    if (!def?.coil || def.category === 'supply') continue;
    const [a, b] = def.coil;
    let paths = collectPaths(lKey, tk(nd.id, a), adj);
    let targetTerm = a;
    if (!paths.length) {
      paths = collectPaths(lKey, tk(nd.id, b), adj);
      targetTerm = b;
    }
    if (!paths.length) continue;

    const kind: LadderRung['targetKind'] =
      def.category === 'timer' ? 'timer' : def.category === 'counter' ? 'counter' : def.isLoad ? 'load' : 'coil';
    const devName = nd.state.label ?? def.mnemonic;
    const otherTerm = targetTerm === a ? b : a;

    rungs.push({
      target: `${devName} (${targetTerm}\u2013${otherTerm})`,
      targetKind: kind,
      paths,
      energized: !!sim.energized[nd.id],
    });
  }
  return rungs;
}

function collectPaths(start: string, goal: string, adj: Map<string, Edge[]>): LadderLiteral[][] {
  const out: LadderLiteral[][] = [];
  let steps = 0;
  const dfs = (cur: string, visited: Set<string>, chain: LadderLiteral[]) => {
    if (steps++ > 4000 || out.length >= 4) return;
    if (cur === goal) { out.push([...chain]); return; }
    for (const e of adj.get(cur) ?? []) {
      if (visited.has(e.to)) continue;
      visited.add(e.to);
      if (e.lit) chain.push(e.lit);
      dfs(e.to, visited, chain);
      if (e.lit) chain.pop();
      visited.delete(e.to);
    }
  };
  dfs(start, new Set([start]), []);
  return out.sort((a, b) => a.length - b.length).slice(0, 4);
}
