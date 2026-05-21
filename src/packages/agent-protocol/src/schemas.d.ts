import { type IrPatchProposal } from "@cc-music/music-ir";
import { z } from "zod";
export declare const AgentSelectionSchema: z.ZodObject<{
    barRange: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    sectionIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    trackIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    sectionIds: string[];
    trackIds: string[];
    barRange?: [number, number] | undefined;
}, {
    barRange?: [number, number] | undefined;
    sectionIds?: string[] | undefined;
    trackIds?: string[] | undefined;
}>;
export declare const AgentRequestSchema: z.ZodObject<{
    requestId: z.ZodString;
    agent: z.ZodEnum<["mock", "codex", "claude", "openai_compat"]>;
    mode: z.ZodLiteral<"ir_patch">;
    prompt: z.ZodString;
    projectId: z.ZodString;
    snapshotId: z.ZodString;
    selection: z.ZodObject<{
        barRange: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
        sectionIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        trackIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        sectionIds: string[];
        trackIds: string[];
        barRange?: [number, number] | undefined;
    }, {
        barRange?: [number, number] | undefined;
        sectionIds?: string[] | undefined;
        trackIds?: string[] | undefined;
    }>;
    allowedActions: z.ZodArray<z.ZodEnum<["propose_ir_patch", "explain_change"]>, "many">;
}, "strip", z.ZodTypeAny, {
    requestId: string;
    agent: "mock" | "codex" | "claude" | "openai_compat";
    mode: "ir_patch";
    prompt: string;
    projectId: string;
    snapshotId: string;
    selection: {
        sectionIds: string[];
        trackIds: string[];
        barRange?: [number, number] | undefined;
    };
    allowedActions: ("propose_ir_patch" | "explain_change")[];
}, {
    requestId: string;
    agent: "mock" | "codex" | "claude" | "openai_compat";
    mode: "ir_patch";
    prompt: string;
    projectId: string;
    snapshotId: string;
    selection: {
        barRange?: [number, number] | undefined;
        sectionIds?: string[] | undefined;
        trackIds?: string[] | undefined;
    };
    allowedActions: ("propose_ir_patch" | "explain_change")[];
}>;
export declare const AgentStreamEventSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"started">;
    requestId: z.ZodString;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "started";
    requestId: string;
    timestamp: string;
}, {
    type: "started";
    requestId: string;
    timestamp: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"message">;
    requestId: z.ZodString;
    timestamp: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "message";
    requestId: string;
    timestamp: string;
}, {
    message: string;
    type: "message";
    requestId: string;
    timestamp: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"proposal">;
    requestId: z.ZodString;
    timestamp: z.ZodString;
    proposal: z.ZodObject<{
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
}, "strip", z.ZodTypeAny, {
    type: "proposal";
    requestId: string;
    timestamp: string;
    proposal: {
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
    };
}, {
    type: "proposal";
    requestId: string;
    timestamp: string;
    proposal: {
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
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"failed">;
    requestId: z.ZodString;
    timestamp: z.ZodString;
    code: z.ZodEnum<["invalid_input", "invalid_json", "schema_invalid", "timeout", "cancelled", "dependency_missing", "adapter_failed"]>;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: "invalid_input" | "invalid_json" | "schema_invalid" | "timeout" | "cancelled" | "dependency_missing" | "adapter_failed";
    message: string;
    type: "failed";
    requestId: string;
    timestamp: string;
}, {
    code: "invalid_input" | "invalid_json" | "schema_invalid" | "timeout" | "cancelled" | "dependency_missing" | "adapter_failed";
    message: string;
    type: "failed";
    requestId: string;
    timestamp: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"completed">;
    requestId: z.ZodString;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "completed";
    requestId: string;
    timestamp: string;
}, {
    type: "completed";
    requestId: string;
    timestamp: string;
}>]>;
export declare const JobStatusSchema: z.ZodEnum<["queued", "running", "succeeded", "failed", "cancelled"]>;
export declare const JobRequestSchema: z.ZodObject<{
    jobId: z.ZodString;
    projectId: z.ZodString;
    type: z.ZodEnum<["agent_ir_patch", "midi_import", "midi_export", "mock_render_preview"]>;
    payload: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    timeoutMs: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "agent_ir_patch" | "midi_import" | "midi_export" | "mock_render_preview";
    projectId: string;
    jobId: string;
    payload: Record<string, unknown>;
    timeoutMs: number;
}, {
    type: "agent_ir_patch" | "midi_import" | "midi_export" | "mock_render_preview";
    projectId: string;
    jobId: string;
    payload?: Record<string, unknown> | undefined;
    timeoutMs?: number | undefined;
}>;
export declare const JobResultSchema: z.ZodObject<{
    jobId: z.ZodString;
    projectId: z.ZodString;
    status: z.ZodEnum<["queued", "running", "succeeded", "failed", "cancelled"]>;
    artifactManifest: z.ZodDefault<z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        kind: z.ZodEnum<["midi", "log", "json", "preview"]>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        kind: "midi" | "log" | "json" | "preview";
    }, {
        path: string;
        kind: "midi" | "log" | "json" | "preview";
    }>, "many">>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
    }, {
        code: string;
        message: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "failed" | "cancelled" | "queued" | "running" | "succeeded";
    projectId: string;
    jobId: string;
    artifactManifest: {
        path: string;
        kind: "midi" | "log" | "json" | "preview";
    }[];
    error?: {
        code: string;
        message: string;
    } | undefined;
}, {
    status: "failed" | "cancelled" | "queued" | "running" | "succeeded";
    projectId: string;
    jobId: string;
    artifactManifest?: {
        path: string;
        kind: "midi" | "log" | "json" | "preview";
    }[] | undefined;
    error?: {
        code: string;
        message: string;
    } | undefined;
}>;
export type AgentRequest = z.infer<typeof AgentRequestSchema>;
export type AgentStreamEvent = z.infer<typeof AgentStreamEventSchema>;
export type JobRequest = z.infer<typeof JobRequestSchema>;
export type JobResult = z.infer<typeof JobResultSchema>;
export declare function createProposalEvent(requestId: string, timestamp: string, proposal: IrPatchProposal): AgentStreamEvent;
//# sourceMappingURL=schemas.d.ts.map