import type { MusicIr } from "@cc-music/music-ir";
type Motif = MusicIr["motifs"][number];
export declare function countProjectNotes(project: MusicIr): number;
/** Shift every note in the motif by `semitones` (positive = up, negative = down). */
export declare function transposeMotif(motif: Motif, semitones: number): Motif;
/** Duplicate the motif's note pattern `times` times, concatenated end-to-end. */
export declare function repeatMotif(motif: Motif, times: number): Motif;
/**
 * Invert pitch contour around `centerPitch` (e.g. "C4").
 * Every pitch P becomes center + (center - P).
 */
export declare function invertMotif(motif: Motif, centerPitch: string): Motif;
/** Scale all note start-beat positions and durations by `factor`. */
export declare function stretchMotifRhythm(motif: Motif, factor: number): Motif;
/** Scale all velocities by `factor`, clamped to [0, 1]. */
export declare function scaleMotifVelocity(motif: Motif, factor: number): Motif;
/** Shift all note start-beat positions by `offsetBeats`. Negative values are clamped to 0. */
export declare function shiftMotifBeats(motif: Motif, offsetBeats: number): Motif;
export {};
//# sourceMappingURL=motif-transform.d.ts.map