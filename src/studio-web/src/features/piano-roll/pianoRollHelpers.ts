// ---------------------------------------------------------------------------
// Piano Roll pure helper functions
// ---------------------------------------------------------------------------

export const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

const MIDI_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

// ---------------------------------------------------------------------------
// Layout constants (shared with component)
// ---------------------------------------------------------------------------

export const PIANO_ROLL_MIN_HEIGHT = 360;
export const BASE_BEAT_WIDTH = 40;
export const ROW_HEIGHT = 20;
export const MIN_PITCH = 48; // C3
export const MAX_PITCH = 83; // B5
export const NOTE_CORNER_RADIUS = 3;
export const LEFT_MARGIN = 56;
export const DEFAULT_DURATION = 0.5;
export const DEFAULT_VELOCITY = 0.8;
export const MIN_DURATION = 0.0625; // 1/16 note
export const GRID_SNAP = 0.25; // snap to 16th note grid
export const RESIZE_HANDLE_WIDTH = 6;

// ---------------------------------------------------------------------------
// Pitch <-> MIDI conversion
// ---------------------------------------------------------------------------

export function pitchToMidi(pitch: string): number {
  const match = pitch.match(/^([A-G][#b]?)(\d+)$/);
  if (!match) throw new Error(`Invalid pitch string: "${pitch}"`);
  const semitone = NOTE_TO_SEMITONE[match[1]!];
  if (semitone === undefined) throw new Error(`Unknown note: "${match[1]}"`);
  return (parseInt(match[2]!, 10) + 1) * 12 + semitone;
}

export function midiToPitch(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${MIDI_NAMES[midi % 12]!}${octave}`;
}

// ---------------------------------------------------------------------------
// Key color detection
// ---------------------------------------------------------------------------

export function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(midi % 12);
}

// ---------------------------------------------------------------------------
// Coordinate conversion
// ---------------------------------------------------------------------------

export function pitchToY(midi: number): number {
  return (MAX_PITCH - midi) * ROW_HEIGHT;
}

export function yToMidi(y: number): number {
  const totalRows = MAX_PITCH - MIN_PITCH + 1;
  const row = Math.round(y / ROW_HEIGHT);
  return MAX_PITCH - Math.max(0, Math.min(totalRows - 1, row));
}

// ---------------------------------------------------------------------------
// Grid snapping
// ---------------------------------------------------------------------------

export function snapToGrid(value: number, snap: number): number {
  return Math.round(value / snap) * snap;
}

export function snapBeat(beat: number): number {
  return snapToGrid(Math.max(0, beat), GRID_SNAP);
}

// ---------------------------------------------------------------------------
// Note-to-canvas coordinate
// ---------------------------------------------------------------------------

export function noteX(startBeat: number, beatWidth: number): number {
  return LEFT_MARGIN + startBeat * beatWidth;
}

export function noteW(durationBeats: number, beatWidth: number): number {
  return durationBeats * beatWidth;
}
