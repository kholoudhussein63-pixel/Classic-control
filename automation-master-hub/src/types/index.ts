// ── Automation Master Hub — core type definitions ────────────────────────────

export type TerminalRole =
  | 'line'      // phase / +V source
  | 'neutral'   // N / 0V
  | 'coil'      // coil or load terminal
  | 'common'    // moving contact of a switch pair
  | 'no'        // normally-open fixed contact
  | 'nc'        // normally-closed fixed contact
  | 'signal';   // sensor signal output

export interface TerminalDef {
  id: string;
  label: string;
  role: TerminalRole;
  desc: string; // hover-tooltip explanation
}

/** Internal switching pair. Pair with `no` closes when the condition is TRUE.
 *  Pair with only `nc` closes when the condition is FALSE (break contact).
 *  Pair with both is a changeover (COM→NO when true, COM→NC when false). */
export interface ContactPair {
  com: string;
  no?: string;
  nc?: string;
}

/** What drives this component's contacts. */
export type Actuation =
  | 'state'    // manual: toggle / selector position / pressed
  | 'coil'     // relay & contactor aux contacts follow coil energization
  | 'timer'    // timer output follows elapsed-time condition
  | 'counter'  // output follows count >= preset
  | 'sensor'   // output follows powered && detected
  | 'overload' // NC opens when tripped
  | 'none';    // wires through everything (supply, pure load)

export type ComponentCategory =
  | 'supply' | 'switch' | 'pushbutton' | 'relay' | 'timer'
  | 'counter' | 'contactor' | 'overload' | 'sensor' | 'load';

export interface Nameplate {
  RatedVoltage?: string;
  RatedCurrent?: string;
  UtilizationCategory?: string;
  CoilSupply?: string;
  Insulation?: string;
  Contacts?: string;
  IP?: string;
  Standard?: string;
  [extra: string]: string | undefined;
}

export interface ComponentDef {
  typeId: string;
  name: string;
  mnemonic: string;       // IEC reference designator prefix: QS, SB, KM...
  category: ComponentCategory;
  accent: string;         // tailwind bg class for the node header strip
  shortDesc: string;      // tooltip one-liner
  workingLogic: string;   // modal: how it works (NO vs NC etc.)
  wiringNote: string;     // modal: field wiring guidance
  terminals: TerminalDef[];
  coil?: [string, string];        // coil / load terminal pair (non pass-through)
  contacts: ContactPair[];        // internal switching pairs, ordered as drawn
  actuation: Actuation;
  positions?: number;     // selector switches: 0 .. positions-1
  momentary?: boolean;    // push buttons & limit switches
  defaultDelay?: number;  // timer preset seconds / counter preset
  isLoad?: boolean;       // motor, lamp, solenoid, bell
  nameplate: Nameplate;
  pinoutNote: string;     // modal: pinout commentary
  keywords: string[];
}

export interface NodeState {
  pos: number;        // selector/toggle position (1 = ON) or 0
  pressed: boolean;   // momentary pushbutton / limit actuator / sensor target
  tripped: boolean;   // thermal overload latched trip
  elapsed: number;    // timer running clock (s)
  count: number;      // counter accumulated
  preset: number;     // timer delay (s) or counter preset
  label?: string;     // user rename, e.g. "KM1"
}

export interface NodeInstance {
  id: string;
  typeId: string;
  x: number;
  y: number;
  state: NodeState;
}

export interface WireEndpoint {
  node: string;
  term: string;
}

export interface Wire {
  id: string;
  a: WireEndpoint;
  b: WireEndpoint;
}

export interface CircuitDoc {
  nodes: NodeInstance[];
  wires: Wire[];
}

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  severity: IssueSeverity;
  title: string;
  detail: string;
  nodes?: string[];   // involved node ids (click to highlight)
}

export interface SimResult {
  /** coil/load devices that are energized (true) */
  energized: Record<string, boolean>;
  /** per node: which terminal ids are phase-live (connected to L through closed paths) */
  live: Record<string, Record<string, boolean>>;
  /** per wire id: carries current (one side live and circuit not shorted) */
  liveWires: Record<string, boolean>;
  /** per node: closed flag for each contact pair index */
  pairs: Record<string, boolean[]>;
  /** timer 0..1 progress for HUD */
  timerProgress: Record<string, number>;
  /** counter current value */
  counts: Record<string, number>;
  /** sensors: powered? */
  poweredSensors: Record<string, boolean>;
  /** L directly reaches N with no load in between */
  shortCircuit: boolean;
  shortPath: string[];
  unstable: boolean;   // relay chatter / oscillation
  errors: ValidationIssue[];
  motorSpin: Record<string, boolean>;
}

// ── Calculator types ─────────────────────────────────────────────────────────

export type StartMethod = 'dol' | 'star-delta';
export type BreakerCurve = 'C' | 'D';

export interface MotorParams {
  powerKw: number;
  voltage: number;          // line voltage V (380 / 400 / 415 / 690)
  cosPhi: number;           // power factor
  efficiency: number;       // η 0..1
  startMethod: StartMethod;
  breakerCurve: BreakerCurve;
  inrushFactor: number;     // Istart/In, typical 6..8
}

export interface MotorResults {
  flc: number;              // full-load current A
  phaseCurrent: number;     // winding current in star connection
  startCurrentLine: number; // line current at start
  startTorquePct: number;   // % of DOL starting torque
  overloadSetting: number;  // thermal relay setting A
  breakerIn: number;        // chosen magnetic-circuit rating A
  breakerTripMin: number;   // instantaneous magnetic trip range A
  breakerTripMax: number;
  contactorAc3: number;     // required AC-3 rating A
  contactorAc3Next: number; // next standard frame A
  cableFactor: number;
  powerKw: number;
  powerHp: number;
  voltage: number;
}

// ── Ladder conversion ────────────────────────────────────────────────────────

export interface LadderLiteral {
  nodeId: string;
  device: string;    // display name KM1, SB2...
  contact: string;   // terminals "13-14"
  polarity: 'NO' | 'NC';
  closed: boolean;   // current state (for highlighting)
}

export interface LadderRung {
  target: string;        // coil / load display name
  targetKind: 'coil' | 'load' | 'timer' | 'counter';
  paths: LadderLiteral[][]; // each path = series chain; paths in parallel
  energized: boolean;
}

// ── Templates ────────────────────────────────────────────────────────────────

export interface WalkStep {
  action: string;              // what to click
  narration: string;           // what happens & why
  set?: { node: string; patch: Partial<NodeState> }; // programmatic state apply
}

// ── UI shared ────────────────────────────────────────────────────────────────

export interface TipState {
  x: number;
  y: number;
  title: string;
  body: string;
  kind?: string;
}

export interface CircuitTemplate {
  id: string;
  name: string;
  subtitle: string;
  icon: 'settings-2' | 'repeat' | 'zap';
  description: string;
  highlights: string[];
  circuit: CircuitDoc;
  steps: WalkStep[];
}
