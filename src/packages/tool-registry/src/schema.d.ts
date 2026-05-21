import { z } from "zod";
export declare const ToolKindSchema: z.ZodEnum<["agent", "midi_transform", "audio_render", "audio_to_midi", "image_to_brief", "text_to_midi"]>;
export declare const ToolRegistryEntrySchema: z.ZodObject<{
    id: z.ZodString;
    displayName: z.ZodString;
    kind: z.ZodEnum<["agent", "midi_transform", "audio_render", "audio_to_midi", "image_to_brief", "text_to_midi"]>;
    enabledByDefault: z.ZodBoolean;
    capabilityRequirement: z.ZodString;
    license: z.ZodString;
    weightsLicense: z.ZodOptional<z.ZodString>;
    commercialAllowed: z.ZodBoolean;
    requiresNetwork: z.ZodBoolean;
    requiresGpu: z.ZodBoolean;
    inputContract: z.ZodString;
    outputContract: z.ZodString;
    testModeBehavior: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    displayName: string;
    kind: "agent" | "midi_transform" | "audio_render" | "audio_to_midi" | "image_to_brief" | "text_to_midi";
    enabledByDefault: boolean;
    capabilityRequirement: string;
    license: string;
    commercialAllowed: boolean;
    requiresNetwork: boolean;
    requiresGpu: boolean;
    inputContract: string;
    outputContract: string;
    testModeBehavior: string;
    weightsLicense?: string | undefined;
}, {
    id: string;
    displayName: string;
    kind: "agent" | "midi_transform" | "audio_render" | "audio_to_midi" | "image_to_brief" | "text_to_midi";
    enabledByDefault: boolean;
    capabilityRequirement: string;
    license: string;
    commercialAllowed: boolean;
    requiresNetwork: boolean;
    requiresGpu: boolean;
    inputContract: string;
    outputContract: string;
    testModeBehavior: string;
    weightsLicense?: string | undefined;
}>;
export type ToolRegistryEntry = z.infer<typeof ToolRegistryEntrySchema>;
//# sourceMappingURL=schema.d.ts.map