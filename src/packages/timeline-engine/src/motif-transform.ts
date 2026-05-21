import type { MusicIr } from "@cc-music/music-ir";

export function countProjectNotes(project: MusicIr): number {
  return project.tracks.reduce(
    (trackTotal, track) =>
      trackTotal + track.clips.reduce((clipTotal, clip) => clipTotal + clip.notes.length, 0),
    0
  );
}
