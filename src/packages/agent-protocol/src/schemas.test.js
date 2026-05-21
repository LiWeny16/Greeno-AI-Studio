import { describe, expect, it } from "vitest";
import { sampleAgentEvents, sampleAgentRequest, sampleJobRequest, sampleJobResult } from "./fixtures";
import { AgentRequestSchema, AgentStreamEventSchema, JobRequestSchema, JobResultSchema } from "./schemas";
describe("agent protocol schemas", () => {
    it("accepts the sample agent request", () => {
        expect(AgentRequestSchema.parse(sampleAgentRequest).agent).toBe("mock");
    });
    it("accepts the sample stream events", () => {
        expect(sampleAgentEvents.map((event) => AgentStreamEventSchema.parse(event).type)).toEqual([
            "started",
            "proposal",
            "completed"
        ]);
    });
    it("accepts job request/result fixtures", () => {
        expect(JobRequestSchema.parse(sampleJobRequest).type).toBe("agent_ir_patch");
        expect(JobResultSchema.parse(sampleJobResult).status).toBe("succeeded");
    });
});
