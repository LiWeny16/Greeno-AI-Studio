import { create } from "zustand";
import type { MusicIr } from "@cc-music/music-ir";
import { sampleMusicIr } from "@cc-music/music-ir";
import {
  startPlayback,
  stopPlayback,
  enableMetronome,
  disableMetronome,
  isRunning,
} from "../features/transport/audioEngine";

interface TransportState {
  isPlaying: boolean;
  playheadBeat: number;
  loopRange: [number, number] | null;
  metronomeEnabled: boolean;
  tempo: number;
  key: string;
  timeSignature: string;

  play: (musicIr?: MusicIr) => void;
  pause: () => void;
  stop: () => void;
  togglePlay: (musicIr?: MusicIr) => void;
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
  tempo: sampleMusicIr.tempo,
  key: sampleMusicIr.key,
  timeSignature: sampleMusicIr.timeSignature,
};

export const useTransportStore = create<TransportState>()((set, get) => ({
  ...initialTransportState,

  play: (musicIr?: MusicIr) => {
    if (isRunning()) return;

    const ir = musicIr ?? sampleMusicIr;
    const metronomeEnabled = get().metronomeEnabled;

    // Set isPlaying synchronously for immediate UI feedback.
    set({
      isPlaying: true,
      tempo: ir.tempo,
      key: ir.key,
      timeSignature: ir.timeSignature,
    });

    // Fire-and-forget async audio setup. On failure, clean up state.
    startPlayback(
      ir,
      (beat: number) => set({ playheadBeat: beat }),
      metronomeEnabled,
    ).catch((err: unknown) => {
      console.error("Transport playback failed:", err);
      stopPlayback();
      set({ isPlaying: false, playheadBeat: 0 });
    });
  },

  pause: () => {
    stopPlayback();
    set({ isPlaying: false, playheadBeat: 0 });
  },

  stop: () => {
    stopPlayback();
    set({ isPlaying: false, playheadBeat: 0 });
  },

  togglePlay: (musicIr?: MusicIr) => {
    if (get().isPlaying || isRunning()) {
      stopPlayback();
      set({ isPlaying: false, playheadBeat: 0 });
    } else {
      get().play(musicIr);
    }
  },

  setPlayheadBeat: (beat) => set({ playheadBeat: beat }),

  setLoopRange: (range) => set({ loopRange: range }),

  setMetronomeEnabled: (enabled) => {
    set({ metronomeEnabled: enabled });
    if (isRunning()) {
      const ir = sampleMusicIr; // Use sample defaults for beat duration
      const beatSec = 60 / ir.tempo;
      if (enabled) {
        enableMetronome(beatSec);
      } else {
        disableMetronome();
      }
    }
  },

  reset: () => {
    stopPlayback();
    set(initialTransportState);
  },
}));
