import React, { createContext, use, useState } from "react";

// Keep the goals editor's unsaved targets in memory while its estimate page is
// open. Measurements belong only to the estimator and never enter this context.
type GoalDraft = {
  goals: Record<string, string>;
  onApplied: () => void;
};
const Context = createContext<{
  draft: GoalDraft | null;
  setDraft: (draft: GoalDraft | null) => void;
} | null>(null);

export function GoalEstimateDraftProvider({
  children,
}: React.PropsWithChildren) {
  const [draft, setDraft] = useState<GoalDraft | null>(null);
  return <Context value={{ draft, setDraft }}>{children}</Context>;
}

export function useGoalEstimateDraft() {
  const context = use(Context);
  if (!context) throw new Error("GoalEstimateDraftProvider is missing");
  return context;
}
