import { useSyncExternalStore } from "react";

// Одно действие в AE за раз: пока оно идёт, плитки неактивны.
let busy = false;
const ls = new Set<() => void>();
export const getStatusBusy = () => busy;
export function setBusy(v: boolean) { busy = v; ls.forEach((l) => l()); }
export const useBusy = () => useSyncExternalStore((l) => { ls.add(l); return () => ls.delete(l); }, () => busy);
