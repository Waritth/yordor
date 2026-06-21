import { EventEmitter } from "node:events";

// In-memory pub/sub for round changes (docs/04 §6). Fine for a single Railway
// instance; swap for Postgres LISTEN/NOTIFY or Redis when scaling out.
type Global = typeof globalThis & { _yordorEE?: EventEmitter };
const g = globalThis as Global;
const ee = g._yordorEE ?? (g._yordorEE = new EventEmitter());
ee.setMaxListeners(0);

export const roundEvents = {
  emit(roundId: string, updatedAt: Date): void {
    ee.emit(roundId, updatedAt);
  },
  subscribe(roundId: string, onChange: (updatedAt: Date) => void): () => void {
    ee.on(roundId, onChange);
    return () => ee.off(roundId, onChange);
  },
};
