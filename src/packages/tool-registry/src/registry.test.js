import { describe, expect, it } from "vitest";
import { defaultToolRegistry } from "./registry";
import { ToolRegistryEntrySchema } from "./schema";
describe("tool registry", () => {
    it("contains valid default entries", () => {
        expect(defaultToolRegistry.map((entry) => ToolRegistryEntrySchema.parse(entry).id)).toContain("mock-agent");
    });
});
