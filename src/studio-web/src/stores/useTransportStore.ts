import { create } from "zustand";

interface TransportState {
  isPlaying: boolean;
  playheadBeat: number;
  loopRange: [number, number] | null;
  metronomeEnabled: boolean;

  play: () => void;
  pause: () => void;
  stop: () => void;
  togglePlay: () => void;
  setPlayheadBeat: (beat: number) => void;
  setLoopRange: (range: [number, number] | null) => void;
  setMetronomeEnabled: (enabled: boolean) => void;
  reset: () => void;
}

const initialTransportState = {
  isPlaying: false,
  playheadBeat: 0,
  loopRange: null as [number, number] | null,
  metronomeEnabled: false,
};

export const useTransportStore = create<TransportState>()((set) => ({
  ...initialTransportState,

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  stop: () => set({ isPlaying: false, playheadBeat: 0 }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  setPlayheadBeat: (beat) => set({ playheadBeat: beat }),

  setLoopRange: (range) => set({ loopRange: range }),

  setMetronomeEnabled: (enabled) => set({ metronomeEnabled: enabled }),

  reset: () => set(initialTransportState),
}));
