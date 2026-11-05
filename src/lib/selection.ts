import { useSyncExternalStore } from "react";
import type { Selection } from "../presets/types";
import { callHost, inAE } from "./cep";
import { getStatusBusy } from "./busy";

// Живая сводка: активная композиция и что выделено. Опрашиваем AE раз в 1,5 с, пока панель видна.
let sel: Selection & { connected: boolean } = { connected: false, comp: null, selected: 0, text: 0, keys: 0 };
const ls = new Set<() => void>();
const set = (v: typeof sel) => { if (JSON.stringify(v) !== JSON.stringify(sel)) { sel = v; ls.forEach((l) => l()); } };

export function startSelectionPolling() {
  if (!inAE()) { set({ connected: false, comp: "Демо", selected: 2, text: 1, keys: 4 }); return () => {}; }
  let stop = false;
  const tick = async () => {
    if (stop) return;
    if (!document.hidden && !getStatusBusy()) {
      const r = await callHost("ae.selectionInfo");
      if (r.ok) set({ connected: true, comp: (r.comp as string) ?? null, selected: Number(r.selected ?? 0), text: Number(r.text ?? 0), keys: Number(r.keys ?? 0) });
      else set({ ...sel, connected: false });
    }
    setTimeout(tick, 1500);
  };
  tick();
  return () => { stop = true; };
}

export const useSelection = () => useSyncExternalStore((l) => { ls.add(l); return () => ls.delete(l); }, () => sel);
export const getSelection = () => sel;
