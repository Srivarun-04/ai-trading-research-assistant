"use client";

/**
 * Flow state management using React Context + localStorage.
 * Keeps the multi-step research flow state across page navigations.
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useSyncExternalStore,
  ReactNode,
} from "react";
import type { FlowState } from "./types";

const STORAGE_KEY = "trading_research_flow";

interface FlowContextValue {
  state: FlowState;
  setQuestion: (q: string) => void;
  setAnalysis: (a: FlowState["analysis"]) => void;
  setConfirmedParams: (
    params: FlowState["confirmedParams"],
    sources: FlowState["fieldSources"]
  ) => void;
  setExperiment: (e: FlowState["experiment"]) => void;
  setBacktestResult: (r: FlowState["backtestResult"]) => void;
  setExplanation: (e: FlowState["explanation"]) => void;
  reset: () => void;
}

const FlowContext = createContext<FlowContextValue | null>(null);

const INITIAL_STATE: FlowState = { question: "" };

function loadFromStorage(): FlowState {
  if (typeof window === "undefined") return INITIAL_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FlowState) : INITIAL_STATE;
  } catch {
    return INITIAL_STATE;
  }
}

function saveToStorage(state: FlowState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

let memoryState: FlowState | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function getStoredState(): FlowState {
  if (memoryState === null) {
    memoryState = loadFromStorage();
  }
  return memoryState;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      memoryState = loadFromStorage();
      listener();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

function getSnapshot(): FlowState {
  return getStoredState();
}

function getServerSnapshot(): FlowState {
  return INITIAL_STATE;
}

export function FlowProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const update = useCallback((patch: Partial<FlowState>) => {
    const current = getStoredState();
    const next = { ...current, ...patch };
    memoryState = next;
    saveToStorage(next);
    emitChange();
  }, []);

  const reset = useCallback(() => {
    memoryState = INITIAL_STATE;
    saveToStorage(INITIAL_STATE);
    emitChange();
  }, []);

  const value: FlowContextValue = useMemo(
    () => ({
      state,
      setQuestion: (q) => update({ question: q }),
      setAnalysis: (analysis) => update({ analysis }),
      setConfirmedParams: (confirmedParams, fieldSources) =>
        update({ confirmedParams, fieldSources }),
      setExperiment: (experiment) => update({ experiment }),
      setBacktestResult: (backtestResult) => update({ backtestResult }),
      setExplanation: (explanation) => update({ explanation }),
      reset,
    }),
    [state, update, reset]
  );

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow(): FlowContextValue {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error("useFlow must be used inside FlowProvider");
  return ctx;
}
