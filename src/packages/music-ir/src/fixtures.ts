import type { IrPatchProposal, MusicIr, ProjectEvent, ProjectManifest } from "./schema";

const timestamp = "2026-05-21T00:00:00.000Z";

export const sampleMusicIr: MusicIr = {
  schemaVersion: 1,
  projectId: "demo",
  title: "Demo Sketch",
  tempo: 120,
  key: "A minor",
  timeSignature: "4/4",
  sections: [
    {
      id: "sec_a",
      name: "A",
      barRange: [1, 8],
      style: {
        genre: "minimal piano",
        energy: 0.35,
        instruments: ["piano"]
      },
      motifIds: ["motif_main"],
      chords: ["Am", "F", "C", "G"],
      locks: {
        melody: true,
        rhythm: false,
        chords: false,
        tempo: true,
        key: true
      }
    }
  ],
  motifs: [
    {
      id: "motif_main",
      notes: [
        { pitch: "A4", startBeat: 0, durationBeats: 0.5, velocity: 0.8 },
        { pitch: "C5", startBeat: 0.5, durationBeats: 0.5, velocity: 0.8 },
        { pitch: "E5", startBeat: 1, durationBeats: 0.5, velocity: 0.78 },
        { pitch: "D5", startBeat: 1.5, durationBeats: 0.5, velocity: 0.75 }
      ],
      source: { type: "manual" },
      lockStrength: 0.8
    }
  ],
  tracks: [
    {
      id: "track_piano",
      name: "Piano",
      type: "midi",
      instrument: "piano",
      clips: [
        {
          id: "clip_a",
          barRange: [1, 8],
          motifId: "motif_main",
          notes: [
            { pitch: "A4", startBeat: 0, durationBeats: 0.5, velocity: 0.8 },
            { pitch: "C5", startBeat: 0.5, durationBeats: 0.5, velocity: 0.8 }
          ]
        }
      ]
    }
  ]
};

export const sampleManifest: ProjectManifest = {
  projectId: "demo",
  title: "Demo Sketch",
  schemaVersion: 1,
  appVersion: "0.0.0",
  createdAt: timestamp,
  updatedAt: timestamp
};

export const sampleProjectEvent: ProjectEvent = {
  eventId: "evt_000001",
  projectId: "demo",
  actor: { type: "local_user" },
  type: "project_created",
  timestamp,
  payload: {}
};

export const samplePatchProposal: IrPatchProposal = {
  proposalId: "patch_000001",
  projectId: "demo",
  summary: "Restyle selected bars as a darker electronic variation.",
  patch: [
    {
      op: "replace",
      path: "/sections/0/style/genre",
      value: "dark minimal electronic"
    }
  ],
  musicalDiff: {
    barsChanged: [9, 16],
    notesAdded: 8,
    notesRemoved: 2,
    preservedMotifs: ["motif_main"]
  }
};
