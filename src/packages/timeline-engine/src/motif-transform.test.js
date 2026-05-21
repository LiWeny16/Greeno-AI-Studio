import { describe, it, expect } from "vitest";
import { transposeMotif, repeatMotif, invertMotif, stretchMotifRhythm, scaleMotifVelocity, shiftMotifBeats, } from "./motif-transform";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeMotif = (overrides) => ({
    id: "test-motif",
    notes: [
        { pitch: "C4", startBeat: 0, durationBeats: 1, velocity: 0.8 },
        { pitch: "E4", startBeat: 1, durationBeats: 1, velocity: 0.7 },
        { pitch: "G4", startBeat: 2, durationBeats: 2, velocity: 0.9 },
    ],
    source: { type: "manual" },
    lockStrength: 0.5,
    ...overrides,
});
const singleNoteMotif = (overrides) => makeMotif({ notes: [{ pitch: "A3", startBeat: 4, durationBeats: 0.5, velocity: 0.6 }], ...overrides });
const emptyNotesMotif = (overrides) => makeMotif({ notes: [], ...overrides });
// ---------------------------------------------------------------------------
// transposeMotif
// ---------------------------------------------------------------------------
describe("transposeMotif", () => {
    it("transposes all notes up by given semitones", () => {
        const result = transposeMotif(makeMotif(), 2);
        expect(result.notes[0].pitch).toBe("D4");
        expect(result.notes[1].pitch).toBe("F#4");
        expect(result.notes[2].pitch).toBe("A4");
    });
    it("transposes all notes down by given semitones", () => {
        const result = transposeMotif(makeMotif(), -3);
        expect(result.notes[0].pitch).toBe("A3");
        expect(result.notes[1].pitch).toBe("C#4");
        expect(result.notes[2].pitch).toBe("E4");
    });
    it("handles zero semitones (no-op)", () => {
        const result = transposeMotif(makeMotif(), 0);
        expect(result.notes[0].pitch).toBe("C4");
        expect(result.notes[1].pitch).toBe("E4");
        expect(result.notes[2].pitch).toBe("G4");
    });
    it("handles octave transposition (+12 semitones)", () => {
        const result = transposeMotif(makeMotif(), 12);
        expect(result.notes[0].pitch).toBe("C5");
        expect(result.notes[1].pitch).toBe("E5");
        expect(result.notes[2].pitch).toBe("G5");
    });
    it("handles large semitone values crossing multiple octaves", () => {
        const result = transposeMotif(makeMotif(), 30);
        expect(result.notes[0].pitch).toBe("F#6");
        expect(result.notes[1].pitch).toBe("A#6");
        expect(result.notes[2].pitch).toBe("C#7");
    });
    it("handles negative large semitone values", () => {
        const result = transposeMotif(makeMotif(), -14);
        expect(result.notes[0].pitch).toBe("A#2");
        expect(result.notes[1].pitch).toBe("D3");
        expect(result.notes[2].pitch).toBe("F3");
    });
    it("handles sharp and flat note names correctly", () => {
        const motif = makeMotif({
            notes: [
                { pitch: "C#4", startBeat: 0, durationBeats: 1, velocity: 0.8 },
                { pitch: "Bb3", startBeat: 1, durationBeats: 1, velocity: 0.7 },
                { pitch: "F#5", startBeat: 2, durationBeats: 1, velocity: 0.9 },
            ],
        });
        const result = transposeMotif(motif, 2);
        expect(result.notes[0].pitch).toBe("D#4");
        expect(result.notes[1].pitch).toBe("C4");
        expect(result.notes[2].pitch).toBe("G#5");
    });
    it("returns a new motif object (immutability)", () => {
        const original = makeMotif();
        const result = transposeMotif(original, 2);
        expect(result).not.toBe(original);
    });
    it("does not mutate original note objects", () => {
        const original = makeMotif();
        const originalFirstNote = original.notes[0];
        transposeMotif(original, 5);
        expect(original.notes[0]).toBe(originalFirstNote);
        expect(original.notes[0].pitch).toBe("C4");
    });
    it("preserves non-pitch note fields", () => {
        const result = transposeMotif(makeMotif(), 7);
        expect(result.notes[0].startBeat).toBe(0);
        expect(result.notes[0].durationBeats).toBe(1);
        expect(result.notes[0].velocity).toBe(0.8);
    });
    it("preserves motif id and lockStrength", () => {
        const result = transposeMotif(makeMotif({ id: "my-motif", lockStrength: 0.9 }), 3);
        expect(result.id).toBe("my-motif");
        expect(result.lockStrength).toBe(0.9);
    });
    it("sets source to transform", () => {
        const result = transposeMotif(makeMotif(), 2);
        expect(result.source).toEqual({ type: "transform" });
    });
    it("handles single-note motif", () => {
        const result = transposeMotif(singleNoteMotif(), 4);
        expect(result.notes).toHaveLength(1);
        expect(result.notes[0].pitch).toBe("C#4");
    });
    it("handles empty notes array", () => {
        const result = transposeMotif(emptyNotesMotif(), 5);
        expect(result.notes).toHaveLength(0);
    });
    it("throws on non-finite semitones (Infinity)", () => {
        expect(() => transposeMotif(makeMotif(), Infinity)).toThrow("semitones must be a finite number");
    });
    it("throws on non-finite semitones (-Infinity)", () => {
        expect(() => transposeMotif(makeMotif(), -Infinity)).toThrow("semitones must be a finite number");
    });
    it("throws on NaN semitones", () => {
        expect(() => transposeMotif(makeMotif(), NaN)).toThrow("semitones must be a finite number");
    });
});
// ---------------------------------------------------------------------------
// repeatMotif
// ---------------------------------------------------------------------------
describe("repeatMotif", () => {
    it("repeats the pattern twice", () => {
        const result = repeatMotif(makeMotif(), 2);
        expect(result.notes).toHaveLength(6);
        // Original notes
        expect(result.notes[0].pitch).toBe("C4");
        expect(result.notes[0].startBeat).toBe(0);
        expect(result.notes[1].pitch).toBe("E4");
        expect(result.notes[1].startBeat).toBe(1);
        expect(result.notes[2].pitch).toBe("G4");
        expect(result.notes[2].startBeat).toBe(2);
        // Repeated notes (offset by pattern duration = 4 beats)
        expect(result.notes[3].pitch).toBe("C4");
        expect(result.notes[3].startBeat).toBe(4);
        expect(result.notes[4].pitch).toBe("E4");
        expect(result.notes[4].startBeat).toBe(5);
        expect(result.notes[5].pitch).toBe("G4");
        expect(result.notes[5].startBeat).toBe(6);
    });
    it("repeats the pattern three times with correct offsets", () => {
        const result = repeatMotif(makeMotif(), 3);
        expect(result.notes).toHaveLength(9);
        // Third repetition starts at beat 8
        expect(result.notes[6].startBeat).toBe(8);
        expect(result.notes[7].startBeat).toBe(9);
        expect(result.notes[8].startBeat).toBe(10);
    });
    it("returns empty notes for 0 times", () => {
        const result = repeatMotif(makeMotif(), 0);
        expect(result.notes).toHaveLength(0);
    });
    it("preserves motif id and lockStrength", () => {
        const result = repeatMotif(makeMotif({ id: "repeat-me", lockStrength: 0.3 }), 2);
        expect(result.id).toBe("repeat-me");
        expect(result.lockStrength).toBe(0.3);
    });
    it("sets source to transform", () => {
        const result = repeatMotif(makeMotif(), 2);
        expect(result.source).toEqual({ type: "transform" });
    });
    it("returns a new motif object (immutability)", () => {
        const original = makeMotif();
        const result = repeatMotif(original, 2);
        expect(result).not.toBe(original);
    });
    it("does not mutate original notes array", () => {
        const original = makeMotif();
        const originalNotes = original.notes;
        repeatMotif(original, 2);
        expect(original.notes).toBe(originalNotes);
        expect(original.notes).toHaveLength(3);
    });
    it("preserves note fields (duration, velocity) in repeated copies", () => {
        const result = repeatMotif(makeMotif(), 2);
        expect(result.notes[3].durationBeats).toBe(1);
        expect(result.notes[3].velocity).toBe(0.8);
        expect(result.notes[5].durationBeats).toBe(2);
        expect(result.notes[5].velocity).toBe(0.9);
    });
    it("handles empty notes array (times > 0)", () => {
        const result = repeatMotif(emptyNotesMotif(), 5);
        expect(result.notes).toHaveLength(0);
    });
    it("handles empty notes array with times = 0", () => {
        const result = repeatMotif(emptyNotesMotif(), 0);
        expect(result.notes).toHaveLength(0);
    });
    it("handles single-note motif", () => {
        const result = repeatMotif(singleNoteMotif(), 3);
        expect(result.notes).toHaveLength(3);
        expect(result.notes[0].startBeat).toBe(4);
        expect(result.notes[1].startBeat).toBe(8.5); // 4 + 1 * 4.5
        expect(result.notes[2].startBeat).toBe(13); // 4 + 2 * 4.5
    });
    it("handles times = 1 (no actual repetition)", () => {
        const result = repeatMotif(makeMotif(), 1);
        expect(result.notes).toHaveLength(3);
        expect(result.notes[0].startBeat).toBe(0);
        expect(result.notes[1].startBeat).toBe(1);
        expect(result.notes[2].startBeat).toBe(2);
    });
    it("throws on negative times", () => {
        expect(() => repeatMotif(makeMotif(), -1)).toThrow("times must be a nonnegative integer");
    });
    it("throws on non-integer times", () => {
        expect(() => repeatMotif(makeMotif(), 2.5)).toThrow("times must be a nonnegative integer");
    });
    it("throws on NaN times", () => {
        expect(() => repeatMotif(makeMotif(), NaN)).toThrow("times must be a nonnegative integer");
    });
    it("throws on Infinity times", () => {
        expect(() => repeatMotif(makeMotif(), Infinity)).toThrow("times must be a nonnegative integer");
    });
});
// ---------------------------------------------------------------------------
// invertMotif
// ---------------------------------------------------------------------------
describe("invertMotif", () => {
    it("inverts pitch contour around given center pitch", () => {
        // C4(60), E4(64), G4(67), center = C4(60)
        // C4: 60 + (60 - 60) = 60 -> C4
        // E4: 60 + (60 - 64) = 56 -> G#3
        // G4: 60 + (60 - 67) = 53 -> F3
        const result = invertMotif(makeMotif(), "C4");
        expect(result.notes[0].pitch).toBe("C4");
        expect(result.notes[1].pitch).toBe("G#3");
        expect(result.notes[2].pitch).toBe("F3");
    });
    it("inverts around a different center pitch", () => {
        // center = E4(64)
        // C4(60): 64 + (64 - 60) = 68 -> G#4
        // E4(64): 64 + (64 - 64) = 64 -> E4
        // G4(67): 64 + (64 - 67) = 61 -> C#4
        const result = invertMotif(makeMotif(), "E4");
        expect(result.notes[0].pitch).toBe("G#4");
        expect(result.notes[1].pitch).toBe("E4");
        expect(result.notes[2].pitch).toBe("C#4");
    });
    it("preserves non-pitch fields", () => {
        const result = invertMotif(makeMotif(), "C4");
        expect(result.notes[0].startBeat).toBe(0);
        expect(result.notes[0].durationBeats).toBe(1);
        expect(result.notes[0].velocity).toBe(0.8);
    });
    it("preserves motif id and lockStrength", () => {
        const result = invertMotif(makeMotif({ id: "inv-motif", lockStrength: 0.7 }), "G4");
        expect(result.id).toBe("inv-motif");
        expect(result.lockStrength).toBe(0.7);
    });
    it("sets source to transform", () => {
        const result = invertMotif(makeMotif(), "C4");
        expect(result.source).toEqual({ type: "transform" });
    });
    it("returns a new motif object (immutability)", () => {
        const original = makeMotif();
        const result = invertMotif(original, "C4");
        expect(result).not.toBe(original);
    });
    it("does not mutate original note objects", () => {
        const original = makeMotif();
        invertMotif(original, "C4");
        expect(original.notes[0].pitch).toBe("C4");
        expect(original.notes[1].pitch).toBe("E4");
        expect(original.notes[2].pitch).toBe("G4");
    });
    it("handles single-note motif", () => {
        // A3(57), center = A3(57): 57 + (57 - 57) = 57 -> A3
        const result = invertMotif(singleNoteMotif(), "A3");
        expect(result.notes).toHaveLength(1);
        expect(result.notes[0].pitch).toBe("A3");
    });
    it("handles single note at different center", () => {
        // A3(57), center = C4(60): 60 + (60 - 57) = 63 -> D#4
        const result = invertMotif(singleNoteMotif(), "C4");
        expect(result.notes[0].pitch).toBe("D#4");
    });
    it("handles empty notes array", () => {
        const result = invertMotif(emptyNotesMotif(), "C4");
        expect(result.notes).toHaveLength(0);
    });
    it("handles inversion producing very low notes", () => {
        const motif = makeMotif({ notes: [{ pitch: "C8", startBeat: 0, durationBeats: 1, velocity: 0.5 }] });
        const result = invertMotif(motif, "C4");
        expect(result.notes[0].pitch).toBe("C0");
    });
    it("handles inversion producing notes below MIDI 0 (negative MIDI)", () => {
        // C0 (MIDI 12), center C0: C0 -> C0, C1(24) -> C-1(0)
        const motif = makeMotif({ notes: [{ pitch: "C1", startBeat: 0, durationBeats: 1, velocity: 0.5 }] });
        const result = invertMotif(motif, "C0");
        expect(result.notes[0].pitch).toBe("C-1");
    });
    it("throws on invalid center pitch format", () => {
        expect(() => invertMotif(makeMotif(), "not-a-pitch")).toThrow();
    });
});
// ---------------------------------------------------------------------------
// stretchMotifRhythm
// ---------------------------------------------------------------------------
describe("stretchMotifRhythm", () => {
    it("scales startBeat and durationBeats by factor", () => {
        const result = stretchMotifRhythm(makeMotif(), 2);
        expect(result.notes[0].startBeat).toBe(0);
        expect(result.notes[0].durationBeats).toBe(2);
        expect(result.notes[1].startBeat).toBe(2);
        expect(result.notes[1].durationBeats).toBe(2);
        expect(result.notes[2].startBeat).toBe(4);
        expect(result.notes[2].durationBeats).toBe(4);
    });
    it("compresses rhythm with factor < 1", () => {
        const result = stretchMotifRhythm(makeMotif(), 0.5);
        expect(result.notes[0].startBeat).toBe(0);
        expect(result.notes[0].durationBeats).toBe(0.5);
        expect(result.notes[1].startBeat).toBe(0.5);
        expect(result.notes[1].durationBeats).toBe(0.5);
        expect(result.notes[2].startBeat).toBe(1);
        expect(result.notes[2].durationBeats).toBe(1);
    });
    it("handles factor = 1 (no-op)", () => {
        const result = stretchMotifRhythm(makeMotif(), 1);
        expect(result.notes[0].startBeat).toBe(0);
        expect(result.notes[1].startBeat).toBe(1);
        expect(result.notes[2].startBeat).toBe(2);
    });
    it("handles very small factor close to zero", () => {
        const result = stretchMotifRhythm(makeMotif(), 0.001);
        expect(result.notes[0].startBeat).toBe(0);
        expect(result.notes[0].durationBeats).toBeCloseTo(0.001, 10);
        expect(result.notes[1].startBeat).toBeCloseTo(0.001, 10);
    });
    it("handles very large factor", () => {
        const result = stretchMotifRhythm(makeMotif(), 1000);
        expect(result.notes[0].startBeat).toBe(0);
        expect(result.notes[0].durationBeats).toBe(1000);
        expect(result.notes[2].startBeat).toBe(2000);
    });
    it("preserves pitch and velocity", () => {
        const result = stretchMotifRhythm(makeMotif(), 2);
        expect(result.notes[0].pitch).toBe("C4");
        expect(result.notes[0].velocity).toBe(0.8);
    });
    it("preserves motif id and lockStrength", () => {
        const result = stretchMotifRhythm(makeMotif({ id: "stretch-me", lockStrength: 0.2 }), 2);
        expect(result.id).toBe("stretch-me");
        expect(result.lockStrength).toBe(0.2);
    });
    it("sets source to transform", () => {
        const result = stretchMotifRhythm(makeMotif(), 2);
        expect(result.source).toEqual({ type: "transform" });
    });
    it("returns a new motif object (immutability)", () => {
        const original = makeMotif();
        const result = stretchMotifRhythm(original, 2);
        expect(result).not.toBe(original);
    });
    it("does not mutate original note objects", () => {
        const original = makeMotif();
        stretchMotifRhythm(original, 2);
        expect(original.notes[0].startBeat).toBe(0);
        expect(original.notes[1].durationBeats).toBe(1);
    });
    it("handles empty notes array", () => {
        const result = stretchMotifRhythm(emptyNotesMotif(), 3);
        expect(result.notes).toHaveLength(0);
    });
    it("handles single-note motif", () => {
        const result = stretchMotifRhythm(singleNoteMotif(), 3);
        expect(result.notes[0].startBeat).toBe(12);
        expect(result.notes[0].durationBeats).toBe(1.5);
    });
    it("throws on factor = 0", () => {
        expect(() => stretchMotifRhythm(makeMotif(), 0)).toThrow("factor must be a positive finite number");
    });
    it("throws on negative factor", () => {
        expect(() => stretchMotifRhythm(makeMotif(), -1)).toThrow("factor must be a positive finite number");
    });
    it("throws on NaN factor", () => {
        expect(() => stretchMotifRhythm(makeMotif(), NaN)).toThrow("factor must be a positive finite number");
    });
    it("throws on Infinity factor", () => {
        expect(() => stretchMotifRhythm(makeMotif(), Infinity)).toThrow("factor must be a positive finite number");
    });
    it("throws on -Infinity factor", () => {
        expect(() => stretchMotifRhythm(makeMotif(), -Infinity)).toThrow("factor must be a positive finite number");
    });
});
// ---------------------------------------------------------------------------
// scaleMotifVelocity
// ---------------------------------------------------------------------------
describe("scaleMotifVelocity", () => {
    it("scales all velocities by factor", () => {
        const result = scaleMotifVelocity(makeMotif(), 0.5);
        expect(result.notes[0].velocity).toBe(0.4);
        expect(result.notes[1].velocity).toBe(0.35);
        expect(result.notes[2].velocity).toBe(0.45);
    });
    it("increases velocities with factor > 1", () => {
        const result = scaleMotifVelocity(makeMotif(), 1.5);
        expect(result.notes[0].velocity).toBeCloseTo(1, 10); // 0.8 * 1.5 = 1.2 clamped to 1
        expect(result.notes[1].velocity).toBeCloseTo(1, 10); // 0.7 * 1.5 = 1.05 clamped to 1
        expect(result.notes[2].velocity).toBeCloseTo(1, 10); // 0.9 * 1.5 = 1.35 clamped to 1
    });
    it("clamps result to maximum 1", () => {
        const result = scaleMotifVelocity(makeMotif(), 10);
        for (const note of result.notes) {
            expect(note.velocity).toBeLessThanOrEqual(1);
        }
    });
    it("clamps result to minimum 0", () => {
        const result = scaleMotifVelocity(makeMotif(), 0);
        for (const note of result.notes) {
            expect(note.velocity).toBe(0);
        }
    });
    it("handles factor = 1 (no-op)", () => {
        const result = scaleMotifVelocity(makeMotif(), 1);
        expect(result.notes[0].velocity).toBe(0.8);
        expect(result.notes[1].velocity).toBe(0.7);
        expect(result.notes[2].velocity).toBe(0.9);
    });
    it("handles factor = 0 (silences all notes)", () => {
        const result = scaleMotifVelocity(makeMotif(), 0);
        expect(result.notes[0].velocity).toBe(0);
        expect(result.notes[1].velocity).toBe(0);
        expect(result.notes[2].velocity).toBe(0);
    });
    it("preserves pitch, startBeat, and durationBeats", () => {
        const result = scaleMotifVelocity(makeMotif(), 0.5);
        expect(result.notes[0].pitch).toBe("C4");
        expect(result.notes[0].startBeat).toBe(0);
        expect(result.notes[0].durationBeats).toBe(1);
    });
    it("preserves motif id and lockStrength", () => {
        const result = scaleMotifVelocity(makeMotif({ id: "vel-motif", lockStrength: 0.4 }), 0.5);
        expect(result.id).toBe("vel-motif");
        expect(result.lockStrength).toBe(0.4);
    });
    it("sets source to transform", () => {
        const result = scaleMotifVelocity(makeMotif(), 0.5);
        expect(result.source).toEqual({ type: "transform" });
    });
    it("returns a new motif object (immutability)", () => {
        const original = makeMotif();
        const result = scaleMotifVelocity(original, 0.5);
        expect(result).not.toBe(original);
    });
    it("does not mutate original note objects", () => {
        const original = makeMotif();
        scaleMotifVelocity(original, 0.3);
        expect(original.notes[0].velocity).toBe(0.8);
        expect(original.notes[1].velocity).toBe(0.7);
    });
    it("handles empty notes array", () => {
        const result = scaleMotifVelocity(emptyNotesMotif(), 0.5);
        expect(result.notes).toHaveLength(0);
    });
    it("handles velocity at boundary 0", () => {
        const motif = makeMotif({
            notes: [{ pitch: "C4", startBeat: 0, durationBeats: 1, velocity: 0 }],
        });
        const result = scaleMotifVelocity(motif, 2);
        expect(result.notes[0].velocity).toBe(0);
    });
    it("handles velocity at boundary 1", () => {
        const motif = makeMotif({
            notes: [{ pitch: "C4", startBeat: 0, durationBeats: 1, velocity: 1 }],
        });
        const result = scaleMotifVelocity(motif, 0.5);
        expect(result.notes[0].velocity).toBe(0.5);
    });
    it("handles single-note motif", () => {
        const result = scaleMotifVelocity(singleNoteMotif(), 0.5);
        expect(result.notes[0].velocity).toBe(0.3);
    });
    it("throws on negative factor", () => {
        expect(() => scaleMotifVelocity(makeMotif(), -1)).toThrow("factor must be a nonnegative finite number");
    });
    it("throws on NaN factor", () => {
        expect(() => scaleMotifVelocity(makeMotif(), NaN)).toThrow("factor must be a nonnegative finite number");
    });
    it("throws on Infinity factor", () => {
        expect(() => scaleMotifVelocity(makeMotif(), Infinity)).toThrow("factor must be a nonnegative finite number");
    });
    it("throws on -Infinity factor", () => {
        expect(() => scaleMotifVelocity(makeMotif(), -Infinity)).toThrow("factor must be a nonnegative finite number");
    });
});
// ---------------------------------------------------------------------------
// shiftMotifBeats
// ---------------------------------------------------------------------------
describe("shiftMotifBeats", () => {
    it("shifts all startBeats forward by positive offset", () => {
        const result = shiftMotifBeats(makeMotif(), 4);
        expect(result.notes[0].startBeat).toBe(4);
        expect(result.notes[1].startBeat).toBe(5);
        expect(result.notes[2].startBeat).toBe(6);
    });
    it("shifts all startBeats backward by negative offset", () => {
        const result = shiftMotifBeats(makeMotif(), -0.5);
        expect(result.notes[0].startBeat).toBe(0); // clamped from -0.5
        expect(result.notes[1].startBeat).toBe(0.5);
        expect(result.notes[2].startBeat).toBe(1.5);
    });
    it("clamps negative result to 0 (does not allow negative startBeats)", () => {
        const result = shiftMotifBeats(makeMotif(), -5);
        expect(result.notes[0].startBeat).toBe(0);
        expect(result.notes[1].startBeat).toBe(0);
        expect(result.notes[2].startBeat).toBe(0);
    });
    it("handles zero offset (no-op)", () => {
        const result = shiftMotifBeats(makeMotif(), 0);
        expect(result.notes[0].startBeat).toBe(0);
        expect(result.notes[1].startBeat).toBe(1);
        expect(result.notes[2].startBeat).toBe(2);
    });
    it("handles large positive offset", () => {
        const result = shiftMotifBeats(makeMotif(), 1000);
        expect(result.notes[0].startBeat).toBe(1000);
        expect(result.notes[1].startBeat).toBe(1001);
    });
    it("preserves pitch, durationBeats, and velocity", () => {
        const result = shiftMotifBeats(makeMotif(), 4);
        expect(result.notes[0].pitch).toBe("C4");
        expect(result.notes[0].durationBeats).toBe(1);
        expect(result.notes[0].velocity).toBe(0.8);
    });
    it("preserves motif id and lockStrength", () => {
        const result = shiftMotifBeats(makeMotif({ id: "shift-me", lockStrength: 0.6 }), 2);
        expect(result.id).toBe("shift-me");
        expect(result.lockStrength).toBe(0.6);
    });
    it("sets source to transform", () => {
        const result = shiftMotifBeats(makeMotif(), 4);
        expect(result.source).toEqual({ type: "transform" });
    });
    it("returns a new motif object (immutability)", () => {
        const original = makeMotif();
        const result = shiftMotifBeats(original, 4);
        expect(result).not.toBe(original);
    });
    it("does not mutate original note objects", () => {
        const original = makeMotif();
        shiftMotifBeats(original, 4);
        expect(original.notes[0].startBeat).toBe(0);
        expect(original.notes[1].startBeat).toBe(1);
    });
    it("handles empty notes array", () => {
        const result = shiftMotifBeats(emptyNotesMotif(), 5);
        expect(result.notes).toHaveLength(0);
    });
    it("handles single-note motif", () => {
        const result = shiftMotifBeats(singleNoteMotif(), 8);
        expect(result.notes[0].startBeat).toBe(12);
    });
    it("handles offset that pushes a note from positive to zero", () => {
        const motif = makeMotif({
            notes: [{ pitch: "C4", startBeat: 2, durationBeats: 1, velocity: 0.5 }],
        });
        const result = shiftMotifBeats(motif, -3);
        expect(result.notes[0].startBeat).toBe(0);
    });
    it("throws on non-finite offsetBeats (Infinity)", () => {
        expect(() => shiftMotifBeats(makeMotif(), Infinity)).toThrow("offsetBeats must be a finite number");
    });
    it("throws on non-finite offsetBeats (-Infinity)", () => {
        expect(() => shiftMotifBeats(makeMotif(), -Infinity)).toThrow("offsetBeats must be a finite number");
    });
    it("throws on NaN offsetBeats", () => {
        expect(() => shiftMotifBeats(makeMotif(), NaN)).toThrow("offsetBeats must be a finite number");
    });
});
// ---------------------------------------------------------------------------
// Cross-function integration
// ---------------------------------------------------------------------------
describe("transform composition", () => {
    it("can chain transpose then invert", () => {
        // C4->D4(62), E4->F#4(66), G4->A4(69)
        // Invert around D4(62):
        //   D4:  62 + (62-62) = 62 -> D4
        //   F#4: 62 + (62-66) = 58 -> A#3
        //   A4:  62 + (62-69) = 55 -> G3
        const transposed = transposeMotif(makeMotif(), 2);
        const inverted = invertMotif(transposed, "D4");
        expect(inverted.notes[0].pitch).toBe("D4");
        expect(inverted.notes[1].pitch).toBe("A#3");
        expect(inverted.notes[2].pitch).toBe("G3");
    });
    it("can chain stretch then shift", () => {
        const stretched = stretchMotifRhythm(makeMotif(), 2);
        const shifted = shiftMotifBeats(stretched, 10);
        expect(shifted.notes[0].startBeat).toBe(10);
        expect(shifted.notes[0].durationBeats).toBe(2);
        expect(shifted.notes[1].startBeat).toBe(12);
    });
    it("can chain repeat then transpose", () => {
        const repeated = repeatMotif(makeMotif(), 2);
        const transposed = transposeMotif(repeated, 7);
        expect(transposed.notes).toHaveLength(6);
        expect(transposed.notes[0].pitch).toBe("G4"); // C4 + 7 = G4
        expect(transposed.notes[3].pitch).toBe("G4"); // repeated note also transposed
    });
    it("chained transforms all set source to transform", () => {
        const result = transposeMotif(stretchMotifRhythm(makeMotif(), 2), 4);
        expect(result.source).toEqual({ type: "transform" });
    });
    it("original motif is untouched after any chain", () => {
        const original = makeMotif();
        const origNotes = [...original.notes];
        const origPitches = original.notes.map((n) => n.pitch);
        transposeMotif(original, 7);
        repeatMotif(original, 3);
        invertMotif(original, "C4");
        stretchMotifRhythm(original, 0.5);
        scaleMotifVelocity(original, 0.2);
        shiftMotifBeats(original, 8);
        // Original must be fully intact
        expect(original.notes).toHaveLength(origNotes.length);
        original.notes.forEach((note, i) => {
            expect(note.pitch).toBe(origPitches[i]);
        });
    });
});
