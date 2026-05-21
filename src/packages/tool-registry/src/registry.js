export const defaultToolRegistry = [
    {
        id: "mock-agent",
        displayName: "Mock Agent",
        kind: "agent",
        enabledByDefault: true,
        capabilityRequirement: "mock",
        license: "AGPL-3.0-or-later",
        commercialAllowed: true,
        requiresNetwork: false,
        requiresGpu: false,
        inputContract: "AgentRequest",
        outputContract: "IrPatchProposal",
        testModeBehavior: "deterministic-fixture"
    },
    {
        id: "deterministic-midi-transform",
        displayName: "Deterministic MIDI Transform",
        kind: "midi_transform",
        enabledByDefault: true,
        capabilityRequirement: "local-light",
        license: "AGPL-3.0-or-later",
        commercialAllowed: true,
        requiresNetwork: false,
        requiresGpu: false,
        inputContract: "EditCommand",
        outputContract: "MusicIr",
        testModeBehavior: "pure-function"
    },
    {
        id: "codex-adapter",
        displayName: "Codex Adapter",
        kind: "agent",
        enabledByDefault: false,
        capabilityRequirement: "codex-cli",
        license: "external-tool",
        commercialAllowed: true,
        requiresNetwork: false,
        requiresGpu: false,
        inputContract: "AgentRequest",
        outputContract: "IrPatchProposal",
        testModeBehavior: "mocked"
    },
    {
        id: "claude-adapter",
        displayName: "Claude Adapter",
        kind: "agent",
        enabledByDefault: false,
        capabilityRequirement: "claude-cli",
        license: "external-tool",
        commercialAllowed: true,
        requiresNetwork: false,
        requiresGpu: false,
        inputContract: "AgentRequest",
        outputContract: "IrPatchProposal",
        testModeBehavior: "mocked"
    }
];
