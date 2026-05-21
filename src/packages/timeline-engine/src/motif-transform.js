export function countProjectNotes(project) {
    return project.tracks.reduce((trackTotal, track) => trackTotal + track.clips.reduce((clipTotal, clip) => clipTotal + clip.notes.length, 0), 0);
}
