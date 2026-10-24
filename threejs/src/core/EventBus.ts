import { GameEventMap } from '../types/EventTypes';

type EventCallback<T> = (data: T) => void;

/**
 * Strongly-typed lightweight event bus for cross-system communication
 */
export class EventBus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners: Map<keyof GameEventMap, Set<EventCallback<any>>> = new Map();

  on<K extends keyof GameEventMap>(event: K, callback: EventCallback<GameEventMap[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off<K extends keyof GameEventMap>(event: K, callback: EventCallback<GameEventMap[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(callback);
  }

  emit<K extends keyof GameEventMap>(event: K, data: GameEventMap[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        cb(data);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const GlobalEventBus = new EventBus();
