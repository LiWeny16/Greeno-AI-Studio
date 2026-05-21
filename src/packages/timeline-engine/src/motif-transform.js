/**
 * NOTE: These transforms are for UI preview/display purposes only.
 * Canonical music transforms live in the Python engine:
 * src/workers/python/cc_music/music/transforms.py
 *
 * The mutation pipeline goes through:
 * Browser → Bridge → Python Engine → IrPatchProposal → Validate → Apply
 */
// ---------------------------------------------------------------------------
// Pitch helpers (internal)
// ---------------------------------------------------------------------------
const SEMITONE_FROM_C = {
    c: 0,
    "c#": 1,
    db: 1,
    d: 2,
    "d#": 3,
    eb: 3,
    e: 4,
    f: 5,
    "f#": 6,
    gb: 6,
    g: 7,
    "g#": 8,
    ab: 8,
    a: 9,
    "a#": 10,
    bb: 10,
    b: 11,
};
const MIDI_TO_NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function pitchToMidi(pitch) {
    const match = pitch.match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
    if (!match) {
        throw new Error(`Invalid pitch format: "${pitch}"`);
    }
    const [, letter, accidental, octaveStr] = match;
    const key = letter.toLowerCase() + (accidental ? accidental.toLowerCase() : "");
    const semitone = SEMITONE_FROM_C[key];
    if (semitone === undefined) {
        throw new Error(`Invalid pitch name: "${pitch}"`);
    }
    const octave = parseInt(octaveStr, 10);
    return (octave + 1) * 12 + semitone;
}
function midiToPitch(midi) {
    const octave = Math.floor(midi / 12) - 1;
    const idx = ((midi % 12) + 12) % 12;
    return `${MIDI_TO_NOTE[idx]}${octave}`;
}
// ---------------------------------------------------------------------------
// Project-level
// ---------------------------------------------------------------------------
export function countProjectNotes(project) {
    return project.tracks.reduce((trackTotal, track) => trackTotal +
        track.clips.reduce((clipTotal, clip) => clipTotal + clip.notes.length, 0), 0);
}
// ---------------------------------------------------------------------------
// Motif transforms
// ---------------------------------------------------------------------------
/** Shift every note in the motif by `semitones` (positive = up, negative = down). */
export function transposeMotif(motif, semitones) {
    if (!Number.isFinite(semitones)) {
        throw new Error("semitones must be a finite number");
    }
    return {
        ...motif,
        notes: motif.notes.map((note) => ({
            ...note,
            pitch: midiToPitch(pitchToMidi(note.pitch) + semitones),
        })),
        source: { type: "transform" },
    };
}
/** Duplicate the motif's note pattern `times` times, concatenated end-to-end. */
export function repeatMotif(motif, times) {
    if (!Number.isInteger(times) || times < 0) {
        throw new Error("times must be a nonnegative integer");
    }
    if (times === 0) {
        return { ...motif, notes: [], source: { type: "transform" } };
    }
    if (motif.notes.length === 0) {
        return { ...motif, notes: [], source: { type: "transform" } };
    }
    const patternDuration = motif.notes.reduce((max, n) => Math.max(max, n.startBeat + n.durationBeats), 0);
    const notes = [];
    for (let i = 0; i < times; i++) {
        const offset = i * patternDuration;
        for (const note of motif.notes) {
            notes.push({
                ...note,
                startBeat: note.startBeat + offset,
            });
        }
    }
    return { ...motif, notes, source: { type: "transform" } };
}
/**
 * Invert pitch contour around `centerPitch` (e.g. "C4").
 * Every pitch P becomes center + (center - P).
 */
export function invertMotif(motif, centerPitch) {
    const center = pitchToMidi(centerPitch);
    return {
        ...motif,
        notes: motif.notes.map((note) => ({
            ...note,
            pitch: midiToPitch(center + (center - pitchToMidi(note.pitch))),
        })),
        source: { type: "transform" },
    };
}
/** Scale all note start-beat positions and durations by `factor`. */
export function stretchMotifRhythm(motif, factor) {
    if (!Number.isFinite(factor) || factor <= 0) {
        throw new Error("factor must be a positive finite number");
    }
    return {
        ...motif,
        notes: motif.notes.map((note) => ({
            ...note,
            startBeat: note.startBeat * factor,
            durationBeats: note.durationBeats * factor,
        })),
        source: { type: "transform" },
    };
}
/** Scale all velocities by `factor`, clamped to [0, 1]. */
export function scaleMotifVelocity(motif, factor) {
    if (!Number.isFinite(factor) || factor < 0) {
        throw new Error("factor must be a nonnegative finite number");
    }
    return {
        ...motif,
        notes: motif.notes.map((note) => ({
            ...note,
            velocity: Math.min(1, Math.max(0, note.velocity * factor)),
        })),
        source: { type: "transform" },
    };
}
/** Shift all note start-beat positions by `offsetBeats`. Negative values are clamped to 0. */
export function shiftMotifBeats(motif, offsetBeats) {
    if (!Number.isFinite(offsetBeats)) {
        throw new Error("offsetBeats must be a finite number");
    }
    return {
        ...motif,
        notes: motif.notes.map((note) => ({
            ...note,
            startBeat: Math.max(0, note.startBeat + offsetBeats),
        })),
        source: { type: "transform" },
    };
}
