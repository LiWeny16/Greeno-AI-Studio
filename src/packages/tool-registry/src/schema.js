import { z } from "zod";
export const ToolKindSchema = z.enum([
    "agent",
    "midi_transform",
    "audio_render",
    "audio_to_midi",
    "image_to_brief",
    "text_to_midi"
]);
export const ToolRegistryEntrySchema = z.object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    kind: ToolKindSchema,
    enabledByDefault: z.boolean(),
    capabilityRequirement: z.string().min(1),
    license: z.string().min(1),
    weightsLicense: z.string().optional(),
    commercialAllowed: z.boolean(),
    requiresNetwork: z.boolean(),
    requiresGpu: z.boolean(),
    inputContract: z.string().min(1),
    outputContract: z.string().min(1),
    testModeBehavior: z.string().min(1)
});
