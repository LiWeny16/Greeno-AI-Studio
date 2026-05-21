import * as Tone from "tone";
import type { MusicIr } from "@cc-music/music-ir";

// ---------------------------------------------------------------------------
// Feature detection: Tone.js requires a browser AudioContext. When running
// in Node.js (vitest, CI, SSR) the Transport singleton may not be fully
// initialised. All public functions guard with this flag so callers can
// safely import the module in any environment.
// ---------------------------------------------------------------------------

const toneReady: boolean = (() => {
  try {
    return (
      typeof Tone?.Transport?.stop === "function" &&
      typeof Tone?.Transport?.start === "function"
    );
  } catch {
    return false;
  }
})();

// ---------------------------------------------------------------------------
// Singleton audio state
// ---------------------------------------------------------------------------

let polySynth: Tone.PolySynth | null = null;
let metronomeSynth: Tone.MembraneSynth | null = null;
let metronomeEventId: number | null = null;
let tickInterval: ReturnType<typeof setInterval> | null = null;
let running = false;
let generation = 0;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isRunning(): boolean {
  return running;
}

export async function startPlayback(
  musicIr: MusicIr,
  onTick: (beat: number) => void,
  metronomeEnabled: boolean,
): Promise<void> {
  if (running || !toneReady) return;

  // Claim immediately so double-play guards work even before the first await.
  running = true;
  const gen = ++generation;

  // Resume AudioContext (browser autoplay policy). Tone.start is a no-op on
  // subsequent calls so guard against aborts first.
  await Tone.start();

  // If stopPlayback was called while we were awaiting, bail out.
  if (gen !== generation) return;

  // ------------------------------------------------------------------
  // Configure transport
  // ------------------------------------------------------------------
  const beatSec = 60 / musicIr.tempo;
  Tone.Transport.bpm.value = musicIr.tempo;

  // ------------------------------------------------------------------
  // Create poly synth (piano-like)
  // ------------------------------------------------------------------
  polySynth = new Tone.PolySynth({
    voice: Tone.Synth,
    maxPolyphony: 8,
    options: { volume: -8 },
  }).toDestination();

  if (gen !== generation) {
    polySynth.dispose();
    polySynth = null;
    return;
  }

  // ------------------------------------------------------------------
  // Schedule motif notes
  // ------------------------------------------------------------------
  for (const motif of musicIr.motifs) {
    for (const note of motif.notes) {
      const startTime = note.startBeat * beatSec;
      const dur = note.durationBeats * beatSec;
      Tone.Transport.schedule((audioTime) => {
        polySynth?.triggerAttackRelease(
          note.pitch,
          dur,
          audioTime,
          note.velocity,
        );
      }, startTime);
    }
  }

  // ------------------------------------------------------------------
  // Schedule track clip notes
  // ------------------------------------------------------------------
  for (const track of musicIr.tracks) {
    for (const clip of track.clips) {
      for (const note of clip.notes) {
        const startTime = note.startBeat * beatSec;
        const dur = note.durationBeats * beatSec;
        Tone.Transport.schedule((audioTime) => {
          polySynth?.triggerAttackRelease(
            note.pitch,
            dur,
            audioTime,
            note.velocity,
          );
        }, startTime);
      }
    }
  }

  if (gen !== generation) {
    Tone.Transport.cancel(0);
    polySynth.dispose();
    polySynth = null;
    return;
  }

  // ------------------------------------------------------------------
  // Metronome
  // ------------------------------------------------------------------
  if (metronomeEnabled) {
    enableMetronome(beatSec);
  }

  // ------------------------------------------------------------------
  // Start transport & playhead tick
  // ------------------------------------------------------------------
  Tone.Transport.start(0);

  tickInterval = setInterval(() => {
    if (!running) return;
    const beat = Tone.Transport.seconds / beatSec;
    onTick(beat);
  }, 100); // ~10 fps
}

export function stopPlayback(): void {
  generation++; // Invalidate any in-flight startPlayback
  running = false;

  if (!toneReady) return;

  Tone.Transport.stop();
  Tone.Transport.cancel(0);

  if (polySynth) {
    polySynth.dispose();
    polySynth = null;
  }

  disableMetronome();

  if (tickInterval !== null) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

export function enableMetronome(beatSec: number): void {
  if (!toneReady || metronomeSynth) return;

  metronomeSynth = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 4,
    volume: -12,
  }).toDestination();

  metronomeEventId = Tone.Transport.scheduleRepeat((time) => {
    metronomeSynth?.triggerAttackRelease("C2", 0.05, time);
  }, beatSec, 0);
}

export function disableMetronome(): void {
  if (metronomeEventId !== null) {
    Tone.Transport.clear(metronomeEventId);
    metronomeEventId = null;
  }
  if (metronomeSynth) {
    metronomeSynth.dispose();
    metronomeSynth = null;
  }
}

export function setTempo(bpm: number): void {
  if (!toneReady) return;
  Tone.Transport.bpm.value = bpm;
}
