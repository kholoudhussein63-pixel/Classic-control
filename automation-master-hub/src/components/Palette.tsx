import { useState } from 'react';
import { ChevronDown, ChevronRight, Info, Plus } from 'lucide-react';
import { PALETTE_GROUPS, COMPONENT_MAP } from '../data/componentsData';
import type { ComponentDef } from '../types';

const CAT_ICON: Record<string, string> = {
  supply: '⚡', switch: '🔘', pushbutton: '⭕', relay: '🔁', timer: '⏱',
  counter: '🔢', contactor: '🧲', overload: '🌡', sensor: '📡', load: '⚙',
};

interface Props {
  onAdd: (typeId: string) => void;
  onInspect: (def: ComponentDef) => void;
}

export function Palette({ onAdd, onInspect }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');

  const groups = PALETTE_GROUPS
    .map((g) => ({
      ...g,
      typeIds: g.typeIds.filter((id) => {
        const d = COMPONENT_MAP[id];
        return !query || `${d.name} ${d.keywords.join(' ')} ${d.mnemonic}`.toLowerCase().includes(query.toLowerCase());
      }),
    }))
    .filter((g) => g.typeIds.length);

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-ink-700/60 bg-ink-900/80">
      <div className="border-b border-ink-700/60 p-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-volt">Component Palette</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search: NO, timer, sensor…"
          className="mt-2 w-full rounded-md border border-ink-600 bg-ink-800 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-volt/60"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {groups.map((g) => (
          <div key={g.title} className="mb-1">
            <button
              className="flex w-full items-center gap-1 rounded px-1 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400 hover:text-slate-200"
              onClick={() => setCollapsed((c) => ({ ...c, [g.title]: !c[g.title] }))}
            >
              {collapsed[g.title] ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
              {g.title}
            </button>
            {!collapsed[g.title] && g.typeIds.map((id) => {
              const def = COMPONENT_MAP[id];
              return (
                <div
                  key={id}
                  className="group mb-1 flex cursor-pointer items-center gap-2 rounded-lg border border-ink-700/70 bg-ink-800/70 px-2 py-1.5 hover:border-volt/50 hover:bg-ink-700/60"
                  onClick={() => onAdd(id)}
                  title="Click to add to the workspace"
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm ${def.accent}`}>
                    {CAT_ICON[def.category] ?? '◆'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold text-slate-100">{def.name}</span>
                    <span className="block truncate text-[9px] text-slate-500">{def.shortDesc}</span>
                  </span>
                  <button
                    className="rounded p-1 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:text-volt"
                    title="Open knowledge base entry"
                    onClick={(e) => { e.stopPropagation(); onInspect(def); }}
                  ><Info size={13} /></button>
                  <Plus size={13} className="text-slate-600 group-hover:text-volt" />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="border-t border-ink-700/60 p-3 text-[10px] leading-relaxed text-slate-500">
        <b className="text-slate-400">How to wire:</b> click a terminal dot on one component, then click the target terminal on another. Click the ✕ on a wire to delete it. Hover any pin for its live explanation.
      </div>
    </aside>
  );
}
