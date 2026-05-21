import { create } from "zustand";

interface AgentUiState {
  activeSessionId: string | null;
  draftPrompt: string;
  streamVisible: boolean;
  expandedProposalIds: string[];

  setActiveSessionId: (id: string | null) => void;
  setDraftPrompt: (prompt: string) => void;
  setStreamVisible: (visible: boolean) => void;
  setExpandedProposalIds: (ids: string[]) => void;
  toggleProposalExpanded: (id: string) => void;
  reset: () => void;
}

const initialAgentUiState = {
  activeSessionId: null as string | null,
  draftPrompt: "",
  streamVisible: false,
  expandedProposalIds: [] as string[],
};

export const useAgentUiStore = create<AgentUiState>()((set) => ({
  ...initialAgentUiState,

  setActiveSessionId: (id) => set({ activeSessionId: id }),

  setDraftPrompt: (prompt) => set({ draftPrompt: prompt }),

  setStreamVisible: (visible) => set({ streamVisible: visible }),

  setExpandedProposalIds: (ids) => set({ expandedProposalIds: ids }),

  toggleProposalExpanded: (id) =>
    set((s) => ({
      expandedProposalIds: s.expandedProposalIds.includes(id)
        ? s.expandedProposalIds.filter((x) => x !== id)
        : [...s.expandedProposalIds, id],
    })),

  reset: () => set(initialAgentUiState),
}));
