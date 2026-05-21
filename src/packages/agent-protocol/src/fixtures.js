import { samplePatchProposal } from "@cc-music/music-ir";
const timestamp = "2026-05-21T00:00:00.000Z";
export const sampleAgentRequest = {
    requestId: "agent_req_000001",
    agent: "mock",
    mode: "ir_patch",
    prompt: "make bars 9-16 darker but keep the motif recognizable",
    projectId: "demo",
    snapshotId: "snap_000001",
    selection: {
        barRange: [9, 16],
        sectionIds: ["sec_a"],
        trackIds: ["track_piano"]
    },
    allowedActions: ["propose_ir_patch", "explain_change"]
};
export const sampleAgentEvents = [
    {
        type: "started",
        requestId: "agent_req_000001",
        timestamp
    },
    {
        type: "proposal",
        requestId: "agent_req_000001",
        timestamp,
        proposal: samplePatchProposal
    },
    {
        type: "completed",
        requestId: "agent_req_000001",
        timestamp
    }
];
export const sampleJobRequest = {
    jobId: "job_000001",
    projectId: "demo",
    type: "agent_ir_patch",
    payload: {},
    timeoutMs: 30000
};
export const sampleJobResult = {
    jobId: "job_000001",
    projectId: "demo",
    status: "succeeded",
    artifactManifest: []
};
