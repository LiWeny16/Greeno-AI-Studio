import { z } from "zod";

export const BarRangeSchema = z.tuple([z.number().int().positive(), z.number().int().positive()]).refine(
  ([start, end]) => start <= end,
  "bar range start must be <= end"
);

export const NoteSchema = z.object({
  pitch: z.string().min(1),
  startBeat: z.number().nonnegative(),
  durationBeats: z.number().positive(),
  velocity: z.number().min(0).max(1)
});

export const MotifSchema = z.object({
  id: z.string().min(1),
  notes: z.array(NoteSchema),
  source: z.object({
    type: z.enum(["manual", "imported_midi", "agent", "transform", "audio_to_midi", "image_brief"])
  }),
  lockStrength: z.number().min(0).max(1).default(0.5)
});

export const SectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  barRange: BarRangeSchema,
  style: z.object({
    genre: z.string().min(1),
    energy: z.number().min(0).max(1),
    instruments: z.array(z.string().min(1))
  }),
  motifIds: z.array(z.string().min(1)),
  chords: z.array(z.string().min(1)),
  locks: z.object({
    melody: z.boolean(),
    rhythm: z.boolean(),
    chords: z.boolean(),
    tempo: z.boolean(),
    key: z.boolean()
  })
});

export const MidiClipSchema = z.object({
  id: z.string().min(1),
  barRange: BarRangeSchema,
  motifId: z.string().min(1).optional(),
  notes: z.array(NoteSchema)
});

export const TrackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.literal("midi"),
  instrument: z.string().min(1),
  clips: z.array(MidiClipSchema)
});

export const MusicIrSchema = z.object({
  schemaVersion: z.literal(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  tempo: z.number().int().min(40).max(240),
  key: z.string().min(1),
  timeSignature: z.string().regex(/^\d+\/\d+$/),
  sections: z.array(SectionSchema),
  motifs: z.array(MotifSchema),
  tracks: z.array(TrackSchema)
});

export const ProjectManifestSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  schemaVersion: z.literal(1),
  appVersion: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  owner: z.string().optional(),
  team: z.string().optional()
});

export const ProjectEventTypeSchema = z.enum([
  "project_created",
  "project_opened",
  "project_saved",
  "patch_proposed",
  "patch_previewed",
  "patch_applied",
  "patch_rejected",
  "undo",
  "redo",
  "midi_imported",
  "midi_exported",
  "capability_checked",
  "adapter_failed",
  "project_recovered"
]);

export const ProjectEventSchema = z.object({
  eventId: z.string().min(1),
  projectId: z.string().min(1),
  actor: z.object({
    type: z.enum(["local_user", "mock_agent", "codex", "claude", "worker"])
  }),
  type: ProjectEventTypeSchema,
  timestamp: z.string().datetime(),
  payload: z.record(z.unknown()).default({})
});

export const EditCommandSchema = z.object({
  commandId: z.string().min(1),
  projectId: z.string().min(1),
  type: z.enum([
    "create_section",
    "rename_section",
    "move_section",
    "edit_notes",
    "transpose",
    "quantize",
    "apply_ir_patch",
    "undo",
    "redo",
    "import_midi"
  ]),
  selection: z
    .object({
      barRange: BarRangeSchema.optional(),
      sectionIds: z.array(z.string().min(1)).optional(),
      trackIds: z.array(z.string().min(1)).optional(),
      noteIds: z.array(z.string().min(1)).optional()
    })
    .default({}),
  payload: z.record(z.unknown()).default({})
});

export const JsonPatchOpSchema = z.object({
  op: z.enum(["add", "remove", "replace"]),
  path: z.string().startsWith("/"),
  value: z.unknown().optional()
});

export const IrPatchProposalSchema = z.object({
  proposalId: z.string().min(1),
  projectId: z.string().min(1),
  summary: z.string().min(1),
  patch: z.array(JsonPatchOpSchema),
  musicalDiff: z.object({
    barsChanged: BarRangeSchema.optional(),
    notesAdded: z.number().int().nonnegative().default(0),
    notesRemoved: z.number().int().nonnegative().default(0),
    preservedMotifs: z.array(z.string().min(1)).default([])
  })
});

export type BarRange = z.infer<typeof BarRangeSchema>;
export type EditCommand = z.infer<typeof EditCommandSchema>;
export type IrPatchProposal = z.infer<typeof IrPatchProposalSchema>;
export type MusicIr = z.infer<typeof MusicIrSchema>;
export type ProjectEvent = z.infer<typeof ProjectEventSchema>;
export type ProjectManifest = z.infer<typeof ProjectManifestSchema>;
