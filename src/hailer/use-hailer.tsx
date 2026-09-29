import { HailerApi, Config, Settings, Signal, ApiInfo } from '@hailer/app-sdk';
import { useSyncExternalStore } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventHandler = (data: any) => void;

export class EventEmitter {
  events: { [event: string]: EventHandler[] } = {};

  on(event: string, listener: EventHandler) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event: string, listenerToRemove: EventHandler) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter((listener) => listener !== listenerToRemove);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(event: string, data: any) {
    if (!this.events[event]) return;
    this.events[event].forEach((listener) => listener(data));
  }
}

// Shared external store (React 18 useSyncExternalStore pattern) — every
// component calling useHailer() reads the SAME state instead of its own
// useState, which is what the scaffold's original per-component state was
// silently breaking (children permanently saw inside:false).
interface HailerStoreState {
  inside: boolean;
  info: ApiInfo | null;
  config: Config | null;
  settings: Settings | null;
}

interface HailerStore {
  state: HailerStoreState;
  listeners: Set<() => void>;
  event: EventEmitter;
  hailer: HailerApi | null;
  subscribe(listener: () => void): () => void;
  getSnapshot(): HailerStoreState;
  setState(partial: Partial<HailerStoreState>): void;
}

function getStore(): HailerStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (!w.__copysetHailerStore) {
    const store: HailerStore = {
      state: { inside: false, info: null, config: null, settings: null },
      listeners: new Set(),
      event: new EventEmitter(),
      hailer: null,
      subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
      },
      getSnapshot() {
        return this.state;
      },
      setState(partial) {
        this.state = { ...this.state, ...partial };
        this.listeners.forEach((l) => l());
      },
    };

    store.hailer = new HailerApi({
      connected: async () => {
        store.setState({ inside: true });
      },
      outside: async () => {
        store.setState({ inside: false });
      },
      config: (config: Config) => {
        store.setState({ config, info: store.hailer ? store.hailer.info() : null });
      },
      settings: (settings: Settings) => store.setState({ settings }),
      signals: (signal: Signal) => {
        store.event.emit(signal.name, signal.data);
      },
    });

    w.__copysetHailerStore = store;
  }
  return w.__copysetHailerStore as HailerStore;
}

const useHailer = () => {
  const store = getStore();
  const state = useSyncExternalStore(store.subscribe.bind(store), store.getSnapshot.bind(store));

  return {
    inside: state.inside,
    info: state.info,
    config: state.config,
    settings: state.settings,
    event: store.event,
    hailer: store.hailer as HailerApi,
  };
};

export default useHailer;
