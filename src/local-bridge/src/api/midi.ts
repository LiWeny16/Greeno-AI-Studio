import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MusicIrSchema, type MusicIr, type ProjectEvent } from "@cc-music/music-ir";
import { nanoid } from "nanoid";
import type { BridgeConfig } from "../config";
import { loadProject, saveProjectIr } from "../projects/project-store";
import { createSnapshot } from "../projects/snapshot-store";
import { appendEvent } from "../projects/events-store";

const ProjectIdParamsSchema = z.object({
  projectId: z.string().min(1),
});

type ProjectIdParams = z.infer<typeof ProjectIdParamsSchema>;

/**
 * Minimal valid MIDI file bytes (Standard MIDI File Format 0, single track).
 * Contains: header, tempo (120 BPM), time signature (4/4), end-of-track.
 */
const MOCK_MIDI_BYTES = Buffer.from([
  0x4d, 0x54, 0x68, 0x64, // "MThd"
  0x00, 0x00, 0x00, 0x06, // header length = 6
  0x00, 0x00,             // format 0
  0x00, 0x01,             // number of tracks = 1
  0x01, 0xe0,             // division = 480 ticks per quarter note
  0x4d, 0x54, 0x72, 0x6b, // "MTrk"
  0x00, 0x00, 0x00, 0x14, // track length = 20 bytes
  0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, // tempo = 500000 usec/quarter (120 BPM)
  0x00, 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08, // time sig 4/4
  0x00, 0xff, 0x2f, 0x00, // end of track
]);

function buildMockImportIr(projectId: string, title: string): MusicIr {
  return {
    schemaVersion: 1,
    projectId,
    title,
    tempo: 120,
    key: "C major",
    timeSignature: "4/4",
    sections: [
      {
        id: "sec_imported",
        name: "Imported",
        barRange: [1, 8],
        style: {
          genre: "imported midi",
          energy: 0.5,
          instruments: ["piano"],
        },
        motifIds: ["motif_imported"],
        chords: ["C", "F", "G", "C"],
        locks: {
          melody: false,
          rhythm: false,
          chords: false,
          tempo: true,
          key: true,
        },
      },
    ],
    motifs: [
      {
        id: "motif_imported",
        notes: [
          { pitch: "C4", startBeat: 0, durationBeats: 0.5, velocity: 0.8 },
          { pitch: "E4", startBeat: 0.5, durationBeats: 0.5, velocity: 0.8 },
          { pitch: "G4", startBeat: 1, durationBeats: 0.5, velocity: 0.78 },
          { pitch: "C5", startBeat: 1.5, durationBeats: 0.5, velocity: 0.75 },
        ],
        source: { type: "imported_midi" },
        lockStrength: 0.5,
      },
    ],
    tracks: [
      {
        id: "track_imported",
        name: "Piano",
        type: "midi",
        instrument: "piano",
        clips: [
          {
            id: "clip_imported",
            barRange: [1, 8],
            motifId: "motif_imported",
            notes: [
              { pitch: "C4", startBeat: 0, durationBeats: 0.5, velocity: 0.8 },
              { pitch: "E4", startBeat: 0.5, durationBeats: 0.5, velocity: 0.8 },
            ],
          },
        ],
      },
    ],
  };
}

export async function registerMidiRoutes(app: FastifyInstance, config: BridgeConfig) {
  // POST /api/projects/:projectId/import/midi
  app.post(
    "/api/projects/:projectId/import/midi",
    {
      schema: {
        params: ProjectIdParamsSchema,
      },
    },
    async (request) => {
      const { projectId } = request.params as ProjectIdParams;

      // Verify project exists
      const { manifest } = await loadProject(config, projectId);

      // Build mock import IR
      const ir = buildMockImportIr(projectId, manifest.title);
      MusicIrSchema.parse(ir);

      // Save and snapshot
      const saved = await saveProjectIr(config, projectId, ir);
      await createSnapshot(config, projectId, saved);

      const event: ProjectEvent = {
        eventId: `evt_${nanoid()}`,
        projectId,
        actor: { type: "local_user" },
        type: "midi_imported",
        timestamp: new Date().toISOString(),
        payload: {},
      };
      await appendEvent(config, projectId, event);

      return { ir: saved };
    },
  );

  // GET /api/projects/:projectId/export/midi
  app.get(
    "/api/projects/:projectId/export/midi",
    {
      schema: {
        params: ProjectIdParamsSchema,
      },
    },
    async (request, reply) => {
      const { projectId } = request.params as ProjectIdParams;

      // Verify project exists
      await loadProject(config, projectId);

      const event: ProjectEvent = {
        eventId: `evt_${nanoid()}`,
        projectId,
        actor: { type: "local_user" },
        type: "midi_exported",
        timestamp: new Date().toISOString(),
        payload: {},
      };
      await appendEvent(config, projectId, event);

      reply.header("Content-Type", "application/octet-stream");
      reply.header("Content-Disposition", `attachment; filename="${projectId}.mid"`);
      return reply.send(MOCK_MIDI_BYTES);
    },
  );
}
