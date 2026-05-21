import { z } from "zod";
export declare const BarRangeSchema: z.ZodEffects<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, [number, number], [number, number]>;
export declare const NoteSchema: z.ZodObject<{
    pitch: z.ZodString;
    startBeat: z.ZodNumber;
    durationBeats: z.ZodNumber;
    velocity: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    pitch: string;
    startBeat: number;
    durationBeats: number;
    velocity: number;
}, {
    pitch: string;
    startBeat: number;
    durationBeats: number;
    velocity: number;
}>;
export declare const MotifSchema: z.ZodObject<{
    id: z.ZodString;
    notes: z.ZodArray<z.ZodObject<{
        pitch: z.ZodString;
        startBeat: z.ZodNumber;
        durationBeats: z.ZodNumber;
        velocity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        pitch: string;
        startBeat: number;
        durationBeats: number;
        velocity: number;
    }, {
        pitch: string;
        startBeat: number;
        durationBeats: number;
        velocity: number;
    }>, "many">;
    source: z.ZodObject<{
        type: z.ZodEnum<["manual", "imported_midi", "agent", "transform", "audio_to_midi", "image_brief"]>;
    }, "strip", z.ZodTypeAny, {
        type: "manual" | "imported_midi" | "agent" | "transform" | "audio_to_midi" | "image_brief";
    }, {
        type: "manual" | "imported_midi" | "agent" | "transform" | "audio_to_midi" | "image_brief";
    }>;
    lockStrength: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    notes: {
        pitch: string;
        startBeat: number;
        durationBeats: number;
        velocity: number;
    }[];
    source: {
        type: "manual" | "imported_midi" | "agent" | "transform" | "audio_to_midi" | "image_brief";
    };
    lockStrength: number;
}, {
    id: string;
    notes: {
        pitch: string;
        startBeat: number;
        durationBeats: number;
        velocity: number;
    }[];
    source: {
        type: "manual" | "imported_midi" | "agent" | "transform" | "audio_to_midi" | "image_brief";
    };
    lockStrength?: number | undefined;
}>;
export declare const SectionSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    barRange: z.ZodEffects<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, [number, number], [number, number]>;
    style: z.ZodObject<{
        genre: z.ZodString;
        energy: z.ZodNumber;
        instruments: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        genre: string;
        energy: number;
        instruments: string[];
    }, {
        genre: string;
        energy: number;
        instruments: string[];
    }>;
    motifIds: z.ZodArray<z.ZodString, "many">;
    chords: z.ZodArray<z.ZodString, "many">;
    locks: z.ZodObject<{
        melody: z.ZodBoolean;
        rhythm: z.ZodBoolean;
        chords: z.ZodBoolean;
        tempo: z.ZodBoolean;
        key: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        chords: boolean;
        melody: boolean;
        rhythm: boolean;
        tempo: boolean;
        key: boolean;
    }, {
        chords: boolean;
        melody: boolean;
        rhythm: boolean;
        tempo: boolean;
        key: boolean;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    barRange: [number, number];
    style: {
        genre: string;
        energy: number;
        instruments: string[];
    };
    motifIds: string[];
    chords: string[];
    locks: {
        chords: boolean;
        melody: boolean;
        rhythm: boolean;
        tempo: boolean;
        key: boolean;
    };
}, {
    id: string;
    name: string;
    barRange: [number, number];
    style: {
        genre: string;
        energy: number;
        instruments: string[];
    };
    motifIds: string[];
    chords: string[];
    locks: {
        chords: boolean;
        melody: boolean;
        rhythm: boolean;
        tempo: boolean;
        key: boolean;
    };
}>;
export declare const MidiClipSchema: z.ZodObject<{
    id: z.ZodString;
    barRange: z.ZodEffects<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, [number, number], [number, number]>;
    motifId: z.ZodOptional<z.ZodString>;
    notes: z.ZodArray<z.ZodObject<{
        pitch: z.ZodString;
        startBeat: z.ZodNumber;
        durationBeats: z.ZodNumber;
        velocity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        pitch: string;
        startBeat: number;
        durationBeats: number;
        velocity: number;
    }, {
        pitch: string;
        startBeat: number;
        durationBeats: number;
        velocity: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    notes: {
        pitch: string;
        startBeat: number;
        durationBeats: number;
        velocity: number;
    }[];
    barRange: [number, number];
    motifId?: string | undefined;
}, {
    id: string;
    notes: {
        pitch: string;
        startBeat: number;
        durationBeats: number;
        velocity: number;
    }[];
    barRange: [number, number];
    motifId?: string | undefined;
}>;
export declare const TrackSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodLiteral<"midi">;
    instrument: z.ZodString;
    clips: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        barRange: z.ZodEffects<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, [number, number], [number, number]>;
        motifId: z.ZodOptional<z.ZodString>;
        notes: z.ZodArray<z.ZodObject<{
            pitch: z.ZodString;
            startBeat: z.ZodNumber;
            durationBeats: z.ZodNumber;
            velocity: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            pitch: string;
            startBeat: number;
            durationBeats: number;
            velocity: number;
        }, {
            pitch: string;
            startBeat: number;
            durationBeats: number;
            velocity: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        notes: {
            pitch: string;
            startBeat: number;
            durationBeats: number;
            velocity: number;
        }[];
        barRange: [number, number];
        motifId?: string | undefined;
    }, {
        id: string;
        notes: {
            pitch: string;
            startBeat: number;
            durationBeats: number;
            velocity: number;
        }[];
        barRange: [number, number];
        motifId?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "midi";
    id: string;
    name: string;
    instrument: string;
    clips: {
        id: string;
        notes: {
            pitch: string;
            startBeat: number;
            durationBeats: number;
            velocity: number;
        }[];
        barRange: [number, number];
        motifId?: string | undefined;
    }[];
}, {
    type: "midi";
    id: string;
    name: string;
    instrument: string;
    clips: {
        id: string;
        notes: {
            pitch: string;
            startBeat: number;
            durationBeats: number;
            velocity: number;
        }[];
        barRange: [number, number];
        motifId?: string | undefined;
    }[];
}>;
export declare const MusicIrSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    projectId: z.ZodString;
    title: z.ZodString;
    tempo: z.ZodNumber;
    key: z.ZodString;
    timeSignature: z.ZodString;
    sections: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        barRange: z.ZodEffects<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, [number, number], [number, number]>;
        style: z.ZodObject<{
            genre: z.ZodString;
            energy: z.ZodNumber;
            instruments: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            genre: string;
            energy: number;
            instruments: string[];
        }, {
            genre: string;
            energy: number;
            instruments: string[];
        }>;
        motifIds: z.ZodArray<z.ZodString, "many">;
        chords: z.ZodArray<z.ZodString, "many">;
        locks: z.ZodObject<{
            melody: z.ZodBoolean;
            rhythm: z.ZodBoolean;
            chords: z.ZodBoolean;
            tempo: z.ZodBoolean;
            key: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            chords: boolean;
            melody: boolean;
            rhythm: boolean;
            tempo: boolean;
            key: boolean;
        }, {
            chords: boolean;
            melody: boolean;
            rhythm: boolean;
            tempo: boolean;
            key: boolean;
        }>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        barRange: [number, number];
        style: {
            genre: string;
            energy: number;
            instruments: string[];
        };
        motifIds: string[];
        chords: string[];
        locks: {
            chords: boolean;
            melody: boolean;
            rhythm: boolean;
            tempo: boolean;
            key: boolean;
        };
    }, {
        id: string;
        name: string;
        barRange: [number, number];
        style: {
            genre: string;
            energy: number;
            instruments: string[];
        };
        motifIds: string[];
        chords: string[];
        locks: {
            chords: boolean;
            melody: boolean;
            rhythm: boolean;
            tempo: boolean;
            key: boolean;
        };
    }>, "many">;
    motifs: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        notes: z.ZodArray<z.ZodObject<{
            pitch: z.ZodString;
            startBeat: z.ZodNumber;
            durationBeats: z.ZodNumber;
            velocity: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            pitch: string;
            startBeat: number;
            durationBeats: number;
            velocity: number;
        }, {
            pitch: string;
            startBeat: number;
            durationBeats: number;
            velocity: number;
        }>, "many">;
        source: z.ZodObject<{
            type: z.ZodEnum<["manual", "imported_midi", "agent", "transform", "audio_to_midi", "image_brief"]>;
        }, "strip", z.ZodTypeAny, {
            type: "manual" | "imported_midi" | "agent" | "transform" | "audio_to_midi" | "image_brief";
        }, {
            type: "manual" | "imported_midi" | "agent" | "transform" | "audio_to_midi" | "image_brief";
        }>;
        lockStrength: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        notes: {
            pitch: string;
            startBeat: number;
            durationBeats: number;
            velocity: number;
        }[];
        source: {
            type: "manual" | "imported_midi" | "agent" | "transform" | "audio_to_midi" | "image_brief";
        };
        lockStrength: number;
    }, {
        id: string;
        notes: {
            pitch: string;
            startBeat: number;
            durationBeats: number;
            velocity: number;
        }[];
        source: {
            type: "manual" | "imported_midi" | "agent" | "transform" | "audio_to_midi" | "image_brief";
        };
        lockStrength?: number | undefined;
    }>, "many">;
    tracks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodLiteral<"midi">;
        instrument: z.ZodString;
        clips: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            barRange: z.ZodEffects<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, [number, number], [number, number]>;
            motifId: z.ZodOptional<z.ZodString>;
            notes: z.ZodArray<z.ZodObject<{
                pitch: z.ZodString;
                startBeat: z.ZodNumber;
                durationBeats: z.ZodNumber;
                velocity: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                pitch: string;
                startBeat: number;
                durationBeats: number;
                velocity: number;
            }, {
                pitch: string;
                startBeat: number;
                durationBeats: number;
                velocity: number;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            id: string;
            notes: {
                pitch: string;
                startBeat: number;
                durationBeats: number;
                velocity: number;
            }[];
            barRange: [number, number];
            motifId?: string | undefined;
        }, {
            id: string;
            notes: {
                pitch: string;
                startBeat: number;
                durationBeats: number;
                velocity: number;
            }[];
            barRange: [number, number];
            motifId?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        type: "midi";
        id: string;
        name: string;
        instrument: string;
        clips: {
            id: string;
            notes: {
                pitch: string;
                startBeat: number;
                durationBeats: number;
                velocity: number;
            }[];
            barRange: [number, number];
            motifId?: string | undefined;
        }[];
    }, {
        type: "midi";
        id: string;
        name: string;
        instrument: string;
        clips: {
            id: string;
            notes: {
                pitch: string;
                startBeat: number;
                durationBeats: number;
                velocity: number;
            }[];
            barRange: [number, number];
            motifId?: string | undefined;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    tempo: number;
    key: string;
    schemaVersion: 1;
    projectId: string;
    title: string;
    timeSignature: string;
    sections: {
        id: string;
        name: string;
        barRange: [number, number];
        style: {
            genre: string;
            energy: number;
            instruments: string[];
        };
        motifIds: string[];
        chords: string[];
        locks: {
            chords: boolean;
            melody: boolean;
            rhythm: boolean;
            tempo: boolean;
            key: boolean;
        };
    }[];
    motifs: {
        id: string;
        notes: {
            pitch: string;
            startBeat: number;
            durationBeats: number;
            velocity: number;
        }[];
        source: {
            type: "manual" | "imported_midi" | "agent" | "transform" | "audio_to_midi" | "image_brief";
        };
        lockStrength: number;
    }[];
    tracks: {
        type: "midi";
        id: string;
        name: string;
        instrument: string;
        clips: {
            id: string;
            notes: {
                pitch: string;
                startBeat: number;
                durationBeats: number;
                velocity: number;
            }[];
            barRange: [number, number];
            motifId?: string | undefined;
        }[];
    }[];
}, {
    tempo: number;
    key: string;
    schemaVersion: 1;
    projectId: string;
    title: string;
    timeSignature: string;
    sections: {
        id: string;
        name: string;
        barRange: [number, number];
        style: {
            genre: string;
            energy: number;
            instruments: string[];
        };
        motifIds: string[];
        chords: string[];
        locks: {
            chords: boolean;
            melody: boolean;
            rhythm: boolean;
            tempo: boolean;
            key: boolean;
        };
    }[];
    motifs: {
        id: string;
        notes: {
            pitch: string;
            startBeat: number;
            durationBeats: number;
            velocity: number;
        }[];
        source: {
            type: "manual" | "imported_midi" | "agent" | "transform" | "audio_to_midi" | "image_brief";
        };
        lockStrength?: number | undefined;
    }[];
    tracks: {
        type: "midi";
        id: string;
        name: string;
        instrument: string;
        clips: {
            id: string;
            notes: {
                pitch: string;
                startBeat: number;
                durationBeats: number;
                velocity: number;
            }[];
            barRange: [number, number];
            motifId?: string | undefined;
        }[];
    }[];
}>;
export declare const ProjectManifestSchema: z.ZodObject<{
    projectId: z.ZodString;
    title: z.ZodString;
    schemaVersion: z.ZodLiteral<1>;
    appVersion: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    owner: z.ZodOptional<z.ZodString>;
    team: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    schemaVersion: 1;
    projectId: string;
    title: string;
    appVersion: string;
    createdAt: string;
    updatedAt: string;
    owner?: string | undefined;
    team?: string | undefined;
}, {
    schemaVersion: 1;
    projectId: string;
    title: string;
    appVersion: string;
    createdAt: string;
    updatedAt: string;
    owner?: string | undefined;
    team?: string | undefined;
}>;
export declare const ProjectEventTypeSchema: z.ZodEnum<["project_created", "project_opened", "project_saved", "patch_proposed", "patch_previewed", "patch_applied", "patch_rejected", "undo", "redo", "midi_imported", "midi_exported", "capability_checked", "adapter_failed", "project_recovered"]>;
export declare const ProjectEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    projectId: z.ZodString;
    actor: z.ZodObject<{
        type: z.ZodEnum<["local_user", "mock_agent", "codex", "claude", "worker"]>;
    }, "strip", z.ZodTypeAny, {
        type: "local_user" | "mock_agent" | "codex" | "claude" | "worker";
    }, {
        type: "local_user" | "mock_agent" | "codex" | "claude" | "worker";
    }>;
    type: z.ZodEnum<["project_created", "project_opened", "project_saved", "patch_proposed", "patch_previewed", "patch_applied", "patch_rejected", "undo", "redo", "midi_imported", "midi_exported", "capability_checked", "adapter_failed", "project_recovered"]>;
    timestamp: z.ZodString;
    payload: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    type: "project_created" | "project_opened" | "project_saved" | "patch_proposed" | "patch_previewed" | "patch_applied" | "patch_rejected" | "undo" | "redo" | "midi_imported" | "midi_exported" | "capability_checked" | "adapter_failed" | "project_recovered";
    projectId: string;
    eventId: string;
    actor: {
        type: "local_user" | "mock_agent" | "codex" | "claude" | "worker";
    };
    timestamp: string;
    payload: Record<string, unknown>;
}, {
    type: "project_created" | "project_opened" | "project_saved" | "patch_proposed" | "patch_previewed" | "patch_applied" | "patch_rejected" | "undo" | "redo" | "midi_imported" | "midi_exported" | "capability_checked" | "adapter_failed" | "project_recovered";
    projectId: string;
    eventId: string;
    actor: {
        type: "local_user" | "mock_agent" | "codex" | "claude" | "worker";
    };
    timestamp: string;
    payload?: Record<string, unknown> | undefined;
}>;
export declare const EditCommandSchema: z.ZodObject<{
    commandId: z.ZodString;
    projectId: z.ZodString;
    type: z.ZodEnum<["create_section", "rename_section", "move_section", "edit_notes", "transpose", "quantize", "apply_ir_patch", "undo", "redo", "import_midi"]>;
    selection: z.ZodDefault<z.ZodObject<{
        barRange: z.ZodOptional<z.ZodEffects<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, [number, number], [number, number]>>;
        sectionIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        trackIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        noteIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        barRange?: [number, number] | undefined;
        sectionIds?: string[] | undefined;
        trackIds?: string[] | undefined;
        noteIds?: string[] | undefined;
    }, {
        barRange?: [number, number] | undefined;
        sectionIds?: string[] | undefined;
        trackIds?: string[] | undefined;
        noteIds?: string[] | undefined;
    }>>;
    payload: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    type: "undo" | "redo" | "create_section" | "rename_section" | "move_section" | "edit_notes" | "transpose" | "quantize" | "apply_ir_patch" | "import_midi";
    projectId: string;
    payload: Record<string, unknown>;
    commandId: string;
    selection: {
        barRange?: [number, number] | undefined;
        sectionIds?: string[] | undefined;
        trackIds?: string[] | undefined;
        noteIds?: string[] | undefined;
    };
}, {
    type: "undo" | "redo" | "create_section" | "rename_section" | "move_section" | "edit_notes" | "transpose" | "quantize" | "apply_ir_patch" | "import_midi";
    projectId: string;
    commandId: string;
    payload?: Record<string, unknown> | undefined;
    selection?: {
        barRange?: [number, number] | undefined;
        sectionIds?: string[] | undefined;
        trackIds?: string[] | undefined;
        noteIds?: string[] | undefined;
    } | undefined;
}>;
export declare const JsonPatchOpSchema: z.ZodObject<{
    op: z.ZodEnum<["add", "remove", "replace"]>;
    path: z.ZodString;
    value: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    path: string;
    op: "add" | "remove" | "replace";
    value?: unknown;
}, {
    path: string;
    op: "add" | "remove" | "replace";
    value?: unknown;
}>;
export declare const IrPatchProposalSchema: z.ZodObject<{
    proposalId: z.ZodString;
    projectId: z.ZodString;
    summary: z.ZodString;
    patch: z.ZodArray<z.ZodObject<{
        op: z.ZodEnum<["add", "remove", "replace"]>;
        path: z.ZodString;
        value: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        op: "add" | "remove" | "replace";
        value?: unknown;
    }, {
        path: string;
        op: "add" | "remove" | "replace";
        value?: unknown;
    }>, "many">;
    musicalDiff: z.ZodObject<{
        barsChanged: z.ZodOptional<z.ZodEffects<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, [number, number], [number, number]>>;
        notesAdded: z.ZodDefault<z.ZodNumber>;
        notesRemoved: z.ZodDefault<z.ZodNumber>;
        preservedMotifs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        notesAdded: number;
        notesRemoved: number;
        preservedMotifs: string[];
        barsChanged?: [number, number] | undefined;
    }, {
        barsChanged?: [number, number] | undefined;
        notesAdded?: number | undefined;
        notesRemoved?: number | undefined;
        preservedMotifs?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    projectId: string;
    proposalId: string;
    summary: string;
    patch: {
        path: string;
        op: "add" | "remove" | "replace";
        value?: unknown;
    }[];
    musicalDiff: {
        notesAdded: number;
        notesRemoved: number;
        preservedMotifs: string[];
        barsChanged?: [number, number] | undefined;
    };
}, {
    projectId: string;
    proposalId: string;
    summary: string;
    patch: {
        path: string;
        op: "add" | "remove" | "replace";
        value?: unknown;
    }[];
    musicalDiff: {
        barsChanged?: [number, number] | undefined;
        notesAdded?: number | undefined;
        notesRemoved?: number | undefined;
        preservedMotifs?: string[] | undefined;
    };
}>;
export type BarRange = z.infer<typeof BarRangeSchema>;
export type EditCommand = z.infer<typeof EditCommandSchema>;
export type IrPatchProposal = z.infer<typeof IrPatchProposalSchema>;
export type MusicIr = z.infer<typeof MusicIrSchema>;
export type ProjectEvent = z.infer<typeof ProjectEventSchema>;
export type ProjectManifest = z.infer<typeof ProjectManifestSchema>;
//# sourceMappingURL=schema.d.ts.map