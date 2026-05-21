import { describe, expect, it } from "vitest";
import {
  pitchToMidi,
  midiToPitch,
  isBlackKey,
  pitchToY,
  yToMidi,
  snapToGrid,
  snapBeat,
  noteX,
  noteW,
  MIN_PITCH,
  MAX_PITCH,
  ROW_HEIGHT,
  LEFT_MARGIN,
  GRID_SNAP,
  NOTE_TO_SEMITONE,
} from "./pianoRollHelpers";

// ---------------------------------------------------------------------------
// NOTE_TO_SEMITONE map
// ---------------------------------------------------------------------------
describe("NOTE_TO_SEMITONE", () => {
  it("maps natural notes correctly", () => {
    expect(NOTE_TO_SEMITONE["C"]).toBe(0);
    expect(NOTE_TO_SEMITONE["D"]).toBe(2);
    expect(NOTE_TO_SEMITONE["E"]).toBe(4);
    expect(NOTE_TO_SEMITONE["F"]).toBe(5);
    expect(NOTE_TO_SEMITONE["G"]).toBe(7);
    expect(NOTE_TO_SEMITONE["A"]).toBe(9);
    expect(NOTE_TO_SEMITONE["B"]).toBe(11);
  });

  it("maps sharps correctly", () => {
    expect(NOTE_TO_SEMITONE["C#"]).toBe(1);
    expect(NOTE_TO_SEMITONE["D#"]).toBe(3);
    expect(NOTE_TO_SEMITONE["F#"]).toBe(6);
    expect(NOTE_TO_SEMITONE["G#"]).toBe(8);
    expect(NOTE_TO_SEMITONE["A#"]).toBe(10);
  });

  it("maps flats as equivalents of sharps", () => {
    expect(NOTE_TO_SEMITONE["Db"]).toBe(1);
    expect(NOTE_TO_SEMITONE["Eb"]).toBe(3);
    expect(NOTE_TO_SEMITONE["Gb"]).toBe(6);
    expect(NOTE_TO_SEMITONE["Ab"]).toBe(8);
    expect(NOTE_TO_SEMITONE["Bb"]).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// pitchToMidi
// ---------------------------------------------------------------------------
describe("pitchToMidi", () => {
  it("converts C4 to MIDI 60", () => {
    expect(pitchToMidi("C4")).toBe(60);
  });

  it("converts A4 to MIDI 69 (standard)", () => {
    expect(pitchToMidi("A4")).toBe(69);
  });

  it("converts C3 to MIDI 48 (minimum piano roll pitch)", () => {
    expect(pitchToMidi("C3")).toBe(48);
  });

  it("converts B5 to MIDI 83 (maximum piano roll pitch)", () => {
    expect(pitchToMidi("B5")).toBe(83);
  });

  it("converts MIDI note 0 (C-1)", () => {
    expect(pitchToMidi("C-1")).toBe(0);
  });

  it("converts sharp note D#4", () => {
    expect(pitchToMidi("D#4")).toBe(63);
  });

  it("throws on invalid pitch", () => {
    expect(() => pitchToMidi("")).toThrow("Invalid pitch string");
    expect(() => pitchToMidi("H4")).toThrow("Invalid pitch string");
    expect(() => pitchToMidi("4")).toThrow("Invalid pitch string");
    expect(() => pitchToMidi("invalid")).toThrow("Invalid pitch string");
  });
});

// ---------------------------------------------------------------------------
// midiToPitch
// ---------------------------------------------------------------------------
describe("midiToPitch", () => {
  it("converts MIDI 60 to C4", () => {
    expect(midiToPitch(60)).toBe("C4");
  });

  it("converts MIDI 69 to A4", () => {
    expect(midiToPitch(69)).toBe("A4");
  });

  it("converts MIDI 48 to C3", () => {
    expect(midiToPitch(48)).toBe("C3");
  });

  it("converts MIDI 83 to B5", () => {
    expect(midiToPitch(83)).toBe("B5");
  });

  it("converts sharp notes", () => {
    expect(midiToPitch(61)).toBe("C#4");
    expect(midiToPitch(63)).toBe("D#4");
    expect(midiToPitch(66)).toBe("F#4");
    expect(midiToPitch(68)).toBe("G#4");
    expect(midiToPitch(70)).toBe("A#4");
  });

  it("is round-trip with pitchToMidi", () => {
    for (let midi = 0; midi <= 127; midi++) {
      const pitch = midiToPitch(midi);
      expect(pitchToMidi(pitch)).toBe(midi);
    }
  });
});

// ---------------------------------------------------------------------------
// isBlackKey
// ---------------------------------------------------------------------------
describe("isBlackKey", () => {
  it("identifies black keys", () => {
    // C#=1, D#=3, F#=6, G#=8, A#=10
    expect(isBlackKey(49)).toBe(true); // C#3
    expect(isBlackKey(51)).toBe(true); // D#3
    expect(isBlackKey(54)).toBe(true); // F#3
    expect(isBlackKey(56)).toBe(true); // G#3
    expect(isBlackKey(58)).toBe(true); // A#3
  });

  it("identifies white keys", () => {
    expect(isBlackKey(48)).toBe(false); // C3
    expect(isBlackKey(50)).toBe(false); // D3
    expect(isBlackKey(52)).toBe(false); // E3
    expect(isBlackKey(53)).toBe(false); // F3
    expect(isBlackKey(55)).toBe(false); // G3
    expect(isBlackKey(57)).toBe(false); // A3
    expect(isBlackKey(59)).toBe(false); // B3
  });
});

// ---------------------------------------------------------------------------
// pitchToY
// ---------------------------------------------------------------------------
describe("pitchToY", () => {
  it("maps C3 (MIDI 48, highest row) to Y=700", () => {
    // MAX_PITCH(83) - 48 = 35 * ROW_HEIGHT(20) = 700
    expect(pitchToY(48)).toBe(700);
  });

  it("maps B5 (MIDI 83, lowest row) to Y=0", () => {
    // MAX_PITCH(83) - 83 = 0 * ROW_HEIGHT = 0
    expect(pitchToY(83)).toBe(0);
  });

  it("maps C4 (MIDI 60) to Y=460", () => {
    // 83 - 60 = 23 * 20 = 460
    expect(pitchToY(60)).toBe(460);
  });

  it("decreases Y as MIDI number increases", () => {
    expect(pitchToY(60)).toBeGreaterThan(pitchToY(72));
  });
});

// ---------------------------------------------------------------------------
// yToMidi
// ---------------------------------------------------------------------------
describe("yToMidi", () => {
  it("rounds y=0 to B5 (MIDI 83)", () => {
    expect(yToMidi(0)).toBe(83);
  });

  it("rounds y=700 to C3 (MIDI 48)", () => {
    expect(yToMidi(700)).toBe(48);
  });

  it("clamps y below zero to B5", () => {
    expect(yToMidi(-100)).toBe(83);
  });

  it("clamps y above max to C3", () => {
    expect(yToMidi(800)).toBe(48);
  });

  it("rounds to nearest pitch row", () => {
    // y=25 -> row=1 -> 83-1=82
    expect(yToMidi(25)).toBe(82);
    // y=35 -> row=2 -> 83-2=81
    expect(yToMidi(35)).toBe(81);
  });

  it("is round-trip with pitchToY", () => {
    for (let midi = MIN_PITCH; midi <= MAX_PITCH; midi++) {
      const y = pitchToY(midi);
      expect(yToMidi(y)).toBe(midi);
    }
  });
});

// ---------------------------------------------------------------------------
// snapToGrid
// ---------------------------------------------------------------------------
describe("snapToGrid", () => {
  it("snaps to nearest grid interval", () => {
    expect(snapToGrid(0, 0.25)).toBe(0);
    expect(snapToGrid(0.1, 0.25)).toBe(0);
    expect(snapToGrid(0.15, 0.25)).toBe(0.25);
    expect(snapToGrid(0.3, 0.25)).toBe(0.25);
    expect(snapToGrid(0.4, 0.25)).toBe(0.5);
  });

  it("snaps with integer grid", () => {
    expect(snapToGrid(0.4, 1)).toBe(0);
    expect(snapToGrid(0.6, 1)).toBe(1);
    expect(snapToGrid(1.5, 1)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// snapBeat
// ---------------------------------------------------------------------------
describe("snapBeat", () => {
  it("snaps to default GRID_SNAP (0.25)", () => {
    expect(snapBeat(0)).toBe(0);
    expect(snapBeat(0.12)).toBe(0);
    expect(snapBeat(0.13)).toBe(0.25);
    expect(snapBeat(0.5)).toBe(0.5);
    expect(snapBeat(1.49999)).toBe(1.5);
  });

  it("clamps negative values to 0", () => {
    expect(snapBeat(-1)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// noteX / noteW
// ---------------------------------------------------------------------------
describe("noteX and noteW", () => {
  it("noteX adds LEFT_MARGIN to beat offset", () => {
    expect(noteX(0, 40)).toBe(LEFT_MARGIN);
    expect(noteX(1, 40)).toBe(LEFT_MARGIN + 40);
    expect(noteX(2.5, 80)).toBe(LEFT_MARGIN + 200);
  });

  it("noteW multiplies duration by beatWidth", () => {
    expect(noteW(0.5, 40)).toBe(20);
    expect(noteW(1, 40)).toBe(40);
    expect(noteW(2, 80)).toBe(160);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe("constants", () => {
  it("has expected piano roll range", () => {
    expect(MIN_PITCH).toBe(48); // C3
    expect(MAX_PITCH).toBe(83); // B5
    expect(MAX_PITCH - MIN_PITCH + 1).toBe(36); // 3 octaves
  });

  it("has expected layout values", () => {
    expect(ROW_HEIGHT).toBe(20);
    expect(LEFT_MARGIN).toBe(56);
    expect(GRID_SNAP).toBe(0.25);
  });
});
