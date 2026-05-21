import { create } from "zustand";

export interface AgentProposal {
  id: string;
  summary: string;
  notesAdded: number;
  notesRemoved: number;
  barsChanged: number;
  preservedMotifs: number;
}

export interface AgentMessage {
  role: "agent" | "tool" | "error" | "proposal";
  text?: string;
  timestamp: string;
  proposal?: AgentProposal;
}

interface AgentUiState {
  activeSessionId: string | null;
  draftPrompt: string;
  streamVisible: boolean;
  expandedProposalIds: string[];
  messages: AgentMessage[];
  isStreaming: boolean;

  setActiveSessionId: (id: string | null) => void;
  setDraftPrompt: (prompt: string) => void;
  setStreamVisible: (visible: boolean) => void;
  setExpandedProposalIds: (ids: string[]) => void;
  toggleProposalExpanded: (id: string) => void;
  addMessage: (msg: AgentMessage) => void;
  clearMessages: () => void;
  setStreaming: (v: boolean) => void;
  reset: () => void;
}

const initialAgentUiState = {
  activeSessionId: null as string | null,
  draftPrompt: "",
  streamVisible: false,
  expandedProposalIds: [] as string[],
  messages: [] as AgentMessage[],
  isStreaming: false,
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

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  clearMessages: () => set({ messages: [] }),

  setStreaming: (v) => set({ isStreaming: v }),

  reset: () => set(initialAgentUiState),
}));
