import { create } from "zustand";

interface PanelState {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  bottomCollapsed: boolean;
  panelSizes: {
    left: number;
    right: number;
    bottom: number;
  };

  setLeftCollapsed: (collapsed: boolean) => void;
  toggleLeftCollapsed: () => void;
  setRightCollapsed: (collapsed: boolean) => void;
  toggleRightCollapsed: () => void;
  setBottomCollapsed: (collapsed: boolean) => void;
  toggleBottomCollapsed: () => void;
  setPanelSizes: (sizes: Partial<PanelState["panelSizes"]>) => void;
  reset: () => void;
}

const initialPanelState = {
  leftCollapsed: false,
  rightCollapsed: false,
  bottomCollapsed: false,
  panelSizes: {
    left: 260,
    right: 320,
    bottom: 220,
  },
};

export const usePanelStore = create<PanelState>()((set) => ({
  ...initialPanelState,

  setLeftCollapsed: (collapsed) => set({ leftCollapsed: collapsed }),
  toggleLeftCollapsed: () =>
    set((s) => ({ leftCollapsed: !s.leftCollapsed })),

  setRightCollapsed: (collapsed) => set({ rightCollapsed: collapsed }),
  toggleRightCollapsed: () =>
    set((s) => ({ rightCollapsed: !s.rightCollapsed })),

  setBottomCollapsed: (collapsed) => set({ bottomCollapsed: collapsed }),
  toggleBottomCollapsed: () =>
    set((s) => ({ bottomCollapsed: !s.bottomCollapsed })),

  setPanelSizes: (sizes) =>
    set((s) => ({
      panelSizes: { ...s.panelSizes, ...sizes },
    })),

  reset: () => set(initialPanelState),
}));
