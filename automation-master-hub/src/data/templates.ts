import type { CircuitDoc, CircuitTemplate, NodeInstance, NodeState, Wire } from '../types';
import { defaultState } from '../utils/simulationEngine';

let uid = 0;
const nd = (id: string, typeId: string, x: number, y: number, label?: string, patch?: Partial<NodeState>): NodeInstance => ({
  id, typeId, x, y, state: { ...defaultState(typeId), label, ...patch },
});
const w = (n1: string, t1: string, n2: string, t2: string): Wire => ({
  id: `tw${uid++}`, a: { node: n1, term: t1 }, b: { node: n2, term: t2 },
});

// ── 1. Star-Delta starter ────────────────────────────────────────────────────

const starDelta: CircuitDoc = {
  nodes: [
    nd('ps', 'ps_control', 40, 300, 'PS 230V'),
    nd('f1', 'overload', 40, 460, 'F1 Thermal'),
    nd('sb1', 'pb_nc', 40, 620, 'SB1 STOP'),
    nd('sb2', 'pb_no', 270, 300, 'SB2 START'),
    nd('km1', 'contactor', 270, 470, 'KM1 Line'),
    nd('kt', 'timer_on', 520, 300, 'KT 5s'),
    nd('kmy', 'contactor', 520, 500, 'KMY Star'),
    nd('kmd', 'contactor', 760, 500, 'KMD Delta'),
    nd('m', 'motor_3ph', 760, 700, 'M 3~ 5.5kW'),
    nd('h1', 'lamp_pilot', 1000, 700, 'H1 RUN'),
  ],
  wires: [
    w('ps', 'L', 'f1', '95'),
    w('f1', '96', 'sb1', '11'),
    w('sb1', '12', 'sb2', '13'),      // stop rail → start button in
    w('sb1', '12', 'km1', '13'),      // seal-in tap AFTER stop, BEFORE start
    w('sb2', '14', 'km1', 'A1'),
    w('km1', '14', 'km1', 'A1'),      // seal-in — KM1 latches itself
    w('km1', 'A2', 'ps', 'N'),
    w('km1', 'A1', 'kt', '15'),       // junction Z feeds timed output COM
    w('km1', 'A1', 'kt', 'A1'),       // timer coil starts with KM1
    w('kt', 'A2', 'ps', 'N'),
    w('km1', 'A1', 'kmd', '13'),      // delta main poles fed from line side
    w('kt', '16', 'kmd', '21'),       // star path: instant-closed NC of KT…
    w('kmd', '22', 'kmy', 'A1'),      // …gated by KMD NC interlock
    w('kmy', 'A2', 'ps', 'N'),
    w('kt', '18', 'kmy', '21'),       // delta path: delayed NO of KT…
    w('kmy', '22', 'kmd', 'A1'),      // …gated by KMY NC interlock
    w('kmd', 'A2', 'ps', 'N'),
    w('kmd', '14', 'm', 'U'),         // motor run contactor output
    w('m', 'W', 'ps', 'N'),
    w('kmd', '14', 'h1', 'X'),
    w('h1', 'Y', 'ps', 'N'),
  ],
};

const starDeltaSteps = [
  { action: 'Inspect the circuit', narration: 'F1 (NC 95–96) and SB1 (NC stop) guard the whole control string. Everything downstream is dead until START is pressed. Press RUN, keep simulation live.', set: undefined },
  { action: 'Press & HOLD SB2 (START)', narration: 'KM1 line contactor pulls in and seals through its own 13–14 NO contact. Junction Z is now live: KT on-delay coil energizes AND the star path runs Z → KT 15–16 (timed NC, still closed) → KMD 21–22 (NC interlock, KMD off) → KMY coil. Motor runs in STAR at 1/√3 voltage, 1/3 torque.', set: { node: 'sb2', patch: { pressed: true } } },
  { action: 'Release SB2', narration: 'Nothing changes — KM1 is latched by its seal-in contact, KT keeps counting toward 5 s. Watch the KT progress bar on the canvas.', set: { node: 'sb2', patch: { pressed: false } } },
  { action: 'Wait for KT to time out (5 s)', narration: 'At t = 5 s the timed changeover flips: KT 15–16 OPENS (KMY star coil drops) and KT 15–18 CLOSES → KMD coil path: Z → 18 → KMY 21–22 (NC, KMY now off) → KMD. Motor transitions to DELTA — full voltage. The two contactor NC interlocks guarantee star and delta can never overlap: that would short two phases through the winding.', set: undefined },
  { action: 'Press SB1 (STOP)', narration: 'The stop NC contact breaks the whole string: KM1, KT and KMD all drop, motor coasts free.', set: { node: 'sb1', patch: { pressed: true } } },
  { action: 'Release SB1, then trip F1', narration: 'Releasing stop re-arms nothing (no latch remains). Now press the TRIP button on F1: the bimetal latch opens 95–96 exactly like a real overload after the I²t integral trips. 97–98 closes to signal the fault. RESET closes only after F1 is reset.', set: { node: 'sb1', patch: { pressed: false } } },
  { action: 'Trip F1 with the TRIP button', narration: 'Click TRIP on the F1 node. Everything de-energizes. Click RESET to re-arm and the circuit is ready for another start.', set: { node: 'f1', patch: { tripped: true } } },
];

// ── 2. Automatic reversing conveyor ─────────────────────────────────────────

const conveyor: CircuitDoc = {
  nodes: [
    nd('ps', 'ps_control', 40, 320, 'PS 230V'),
    nd('f1', 'overload', 40, 480, 'F1'),
    nd('sb1', 'pb_nc', 40, 640, 'SB1 STOP'),
    nd('sa', 'selector_3pos_am', 270, 120, 'SA OFF/AUTO/MAN'),
    nd('sb2', 'pb_no', 270, 330, 'SB2 FWD'),
    nd('sb3', 'pb_no', 270, 540, 'SB3 REV'),
    nd('ls2', 'limit_switch', 520, 330, 'LS2 End'),
    nd('ls1', 'limit_switch', 520, 540, 'LS1 Home'),
    nd('b1', 'sensor_inductive', 520, 120, 'B1 Product'),
    nd('b2', 'sensor_photo', 760, 120, 'B2 Home mark'),
    nd('kmf', 'contactor', 780, 330, 'KM1 FWD'),
    nd('kmr', 'contactor', 1010, 330, 'KM2 REV'),
    nd('m', 'motor_3ph', 780, 560, 'M CONV'),
    nd('h2', 'lamp_pilot', 1010, 560, 'H2 FWD'),
    nd('h3', 'lamp_pilot', 1210, 560, 'H3 REV'),
  ],
  wires: [
    w('ps', 'L', 'f1', '95'),
    w('f1', '96', 'sb1', '11'),
    w('sb1', '12', 'sa', '13'),        // rail R → AUTO deck COM
    w('sb1', '12', 'sa', '23'),        // rail R → MANUAL deck COM
    // ---- manual feed into gates
    w('sa', '24', 'sb2', '13'),
    w('sa', '24', 'sb3', '13'),
    w('sb2', '13', 'kmf', '13'),       // seal-in COM tap
    w('sb3', '13', 'kmr', '13'),
    // ---- gate junctions (button out + seal out + auto sensor out)
    w('sb2', '14', 'kmf', '14'),
    w('sb2', '14', 'ls2', '21'),       // into end-stop NC
    w('kmf', '14', 'ls2', '21'),
    w('b1', 'BK', 'ls2', '21'),        // AUTO: product sensor feeds same gate
    // ---- reverse gate
    w('sb3', '14', 'kmr', '14'),
    w('sb3', '14', 'ls1', '21'),
    w('kmr', '14', 'ls1', '21'),
    w('b2', 'BK', 'ls1', '21'),        // AUTO: home marker feeds reverse gate
    // ---- interlocks after end-stops
    w('ls2', '22', 'kmr', '21'),
    w('kmr', '22', 'kmf', 'A1'),
    w('ls1', '22', 'kmf', '21'),
    w('kmf', '22', 'kmr', 'A1'),
    w('kmf', 'A2', 'ps', 'N'),
    w('kmr', 'A2', 'ps', 'N'),
    // ---- sensors: powered only in AUTO (BN from SA deck 1)
    w('sa', '14', 'b1', 'BN'),
    w('sa', '14', 'b2', 'BN'),
    w('b1', 'BU', 'ps', 'N'),
    w('b2', 'BU', 'ps', 'N'),
    // ---- motor & signalling driven off the coil rails
    w('kmf', 'A1', 'm', 'U'),
    w('kmr', 'A1', 'm', 'U'),
    w('m', 'W', 'ps', 'N'),
    w('kmf', 'A1', 'h2', 'X'),
    w('kmr', 'A1', 'h3', 'X'),
    w('h2', 'Y', 'ps', 'N'),
    w('h3', 'Y', 'ps', 'N'),
  ],
};

const conveyorSteps = [
  { action: 'Rotate SA to MANUAL (position 3)', narration: 'Only now do deck-2 contacts 23–24 close and feed the START buttons. In OFF nothing works — the mode selector is the master gate. Sensors stay unpowered because their BN (+V) hangs on the AUTO deck.', set: { node: 'sa', patch: { pos: 2 } } },
  { action: 'Press SB2 FWD', narration: 'Path: SA 24 → SB2 → KM1 13–14 (seal) → LS2 NC 21–22 (not hit yet) → KM2 21–22 NC interlock (KM2 off) → KM1 coil. Motor starts, H2 lights. Release the button — it seals.', set: { node: 'sb2', patch: { pressed: true } } },
  { action: 'Release SB2', narration: 'Belt keeps running on the seal-in. The pallet travels toward the end of the line.', set: { node: 'sb2', patch: { pressed: false } } },
  { action: 'Actuate LS2 (end stop)', narration: 'The roller pushes LS2: its NC 21–22 OPENS inside the seal loop → KM1 drops, belt stops at the end of travel. No mechanical crash — the limit switch is the electrical end-stop.', set: { node: 'ls2', patch: { pressed: true } } },
  { action: 'Release LS2, press SB3 REV', narration: 'Reverse mirrors the same chain with KM2, LS1-home stop and the KM1 21–22 interlock in its coil path. Try pressing SB2 and SB3 together: only the first one picked up by the solver can stay in — the cross NC interlocks forbid both.', set: { node: 'ls2', patch: { pressed: false } } },
  { action: 'Set SA to AUTO (position 2)', narration: 'Deck 1 closes 13–14: +V reaches the inductive sensor B1 (product) and photoelectric B2 (home marker). Now the belt is sensor-driven: BK switches +V to the gate junction — detection starts the run, end stops still guard it.', set: { node: 'sa', patch: { pos: 1 }, } },
  { action: 'Simulate product on B1', narration: 'Toggle B1 DETECT: BN→BK closes, current reaches the FWD gate, KM1 pulls in through LS2 + KM2 interlock. The box rides toward the end. When it trips LS2 the run stops. At the home station the marker triggers B2 → reverse loop. This is the automatic reversing conveyor.', set: { node: 'b1', patch: { pressed: true } } },
];

// ── 3. Automatic Transfer Switch (ATS) ──────────────────────────────────────

const ats: CircuitDoc = {
  nodes: [
    nd('ps', 'ps_control', 40, 320, 'PS 230V'),
    nd('sb1', 'pb_nc', 40, 480, 'SB1 INHIBIT'),
    nd('sa', 'selector_3pos_am', 270, 140, 'SA OFF/AUTO/MAN'),
    nd('b1', 'sensor_inductive', 270, 350, 'B1 GRID OK'),
    nd('k1', 'relay_8pin', 500, 350, 'K1 GridMon'),
    nd('kt', 'timer_on', 500, 120, 'KT 8s start delay'),
    nd('kmg', 'contactor', 760, 350, 'KM1 GRID'),
    nd('kmd', 'contactor', 1000, 350, 'KM2 GEN'),
    nd('m', 'motor_3ph', 880, 600, 'M LOAD'),
    nd('h1', 'lamp_pilot', 1120, 600, 'H1 GRID'),
    nd('h2', 'lamp_pilot', 1280, 600, 'H2 GEN'),
  ],
  wires: [
    w('ps', 'L', 'sb1', '11'),
    w('sb1', '12', 'sa', '13'),
    w('sb1', '12', 'sa', '23'),
    // grid presence sensing — sensor always powered, output to monitoring relay
    w('ps', 'L', 'b1', 'BN'),
    w('b1', 'BU', 'ps', 'N'),
    w('b1', 'BK', 'k1', '2'),
    w('k1', '7', 'ps', 'N'),
    // AUTO grid path: SA 14 → K1 NO (8–6) → gen NC interlock → grid coil
    w('sa', '14', 'k1', '8'),
    w('k1', '6', 'kmd', '21'),
    w('kmd', '22', 'kmg', 'A1'),
    // AUTO fail path: SA 14 → K1 NC (1–4) closes on grid failure → starts KT
    w('sa', '14', 'k1', '1'),
    w('k1', '4', 'kt', 'A1'),
    w('kt', 'A2', 'ps', 'N'),
    w('sa', '14', 'kt', '15'),
    w('kt', '18', 'kmg', '21'),        // timed output → grid NC interlock
    w('kmg', '22', 'kmd', 'A1'),
    // MANUAL: deck 2 feeds the same interlocked coil gates directly
    w('sa', '24', 'kmd', '21'),
    w('sa', '24', 'kmg', '21'),
    // coils return
    w('kmg', 'A2', 'ps', 'N'),
    w('kmd', 'A2', 'ps', 'N'),
    // power poles: grid & generator feed the load (never together — interlocked)
    w('ps', 'L', 'kmg', '13'),
    w('kmg', '14', 'm', 'U'),
    w('ps', 'L', 'kmd', '13'),
    w('kmd', '14', 'm', 'U'),
    w('m', 'W', 'ps', 'N'),
    w('kmg', '14', 'h1', 'X'),
    w('kmd', '14', 'h2', 'X'),
    w('h1', 'Y', 'ps', 'N'),
    w('h2', 'Y', 'ps', 'N'),
  ],
};

const atsSteps = [
  { action: 'Rotate SA to AUTO', narration: 'Deck 1 feeds the monitoring logic. B1 (grid-OK sensing) is energized from L: while the grid is healthy its output BK holds K1 (grid monitoring relay) picked up.', set: { node: 'sa', patch: { pos: 1 } } },
  { action: 'Force DETECT on B1 (grid present)', narration: 'K1 pulls in: NO 8–6 closes → KM1 grid coil path via KM2 21–22 interlock. Contactor closes the grid to the load, H1 lights. Notice the NC 1–4 of K1 opens — the generator timer is unpowered, dead-path by design.', set: { node: 'b1', patch: { pressed: true } } },
  { action: 'Remove B1 detection (GRID FAIL)', narration: 'Phase failure / grid down: K1 drops. 8–6 opens → KM1 GRID releases (supply disconnected from the load — the transfer break). 1–4 closes → KT 8 s coil starts: the generator gets a warm-up delay before it ever takes the bus.', set: { node: 'b1', patch: { pressed: false } } },
  { action: 'Wait 8 s for KT timeout', narration: 'KT 15–18 closes → KM2 GEN coil path via KM1 21–22 NC interlock (grid contactor now off). Generator picks up the load, H2 lights. The mechanical + electrical interlock between KM1 and KM2 is what makes an ATS safe: grid and generator phases can NEVER be paralleled.', set: undefined },
  { action: 'Restore grid — force DETECT on B1', narration: 'K1 picks again: 1–4 opens → KT drops → 15–18 opens → KM2 GEN releases (open transition). Then 8–6 closes → KM1 GRID re-engages. Load is back on the utility.', set: { node: 'b1', patch: { pressed: true } } },
  { action: 'Try MANUAL (position 3)', narration: 'Deck 2 pushes into the same interlock gates: you can force GRID or GEN by hand, but KM2 21–22 in the grid coil and KM1 21–22 in the gen coil still forbid the paralleled state.', set: { node: 'sa', patch: { pos: 2 } } },
];

export const TEMPLATES: CircuitTemplate[] = [
  {
    id: 'star-delta',
    name: 'Star-Delta Motor Starter',
    subtitle: '3-phase cage motor · reduced-voltage start · timed transition',
    icon: 'settings-2',
    description:
      "The most examined classic-control circuit. Reduces starting current to 1/3 by wiring the winding in star during acceleration, then transitions to delta on a preset timer. Both main contactors are electrically interlocked with each other's NC auxiliary.",
    highlights: ['KT on-delay transition', 'NC interlock KMY⇄KMD', 'Seal-in on KM1', 'Thermal relay in the stop string'],
    circuit: starDelta, steps: starDeltaSteps,
  },
  {
    id: 'conveyor',
    name: 'Automatic Reversing Conveyor',
    subtitle: 'FWD/REV contactors · end-stop limits · proximity auto mode',
    icon: 'repeat',
    description:
      'A belt that shuttles between home and end stations. Manual mode uses start buttons with seal-in contacts; the OFF/AUTO/MANUAL selector powers the sensors only in AUTO, where the inductive product sensor and photoelectric home marker drive the same interlocked contactor pair.',
    highlights: ['3-position mode selector', 'LS1/LS2 snap limit stops', 'Cross NC interlock KM1⇄KM2', '3-wire PNP sensors gated by AUTO'],
    circuit: conveyor, steps: conveyorSteps,
  },
  {
    id: 'ats',
    name: 'Automatic Transfer Switch (ATS)',
    subtitle: 'Grid ⇄ Generator · open transition · phase-failure sensing',
    icon: 'zap',
    description:
      'Monitors grid voltage with a sensing relay. On failure: grid contactor drops, an 8-second generator warm-up timer runs, then the generator closes onto the load. Grid restoration reverses the sequence. The two contactors are interlocked so source paralleling is impossible.',
    highlights: ['K1 monitoring relay changeover', 'KT generator delay', 'Electrical interlock KM1⇄KM2', 'Auto / OFF / Manual selector'],
    circuit: ats, steps: atsSteps,
  },
];

export const cloneCircuit = (src: CircuitDoc): CircuitDoc => ({
  nodes: src.nodes.map((n) => ({ ...n, state: { ...n.state } })),
  wires: src.wires.map((x) => ({ ...x, a: { ...x.a }, b: { ...x.b } })),
});
