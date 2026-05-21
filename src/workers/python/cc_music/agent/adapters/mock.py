"""Deterministic mock adapter for default tests.

Returns canned responses; never calls a real LLM endpoint.
Use as the default adapter in CI and quick local dev.

Supports keyed prompt matching via PROMPTS and explicit response sequences
passed at construction time. Tracks call history for test assertions.
"""

from __future__ import annotations

from cc_music.agent.loop import LlmBackend, LlmResponse, ToolCall


# ── Sample proposal fixtures ──

_SAMPLE_PROPOSAL: dict = {
    "patch": [
        {
            "op": "replace",
            "path": "/sections/1/style/genre",
            "value": "dark minimal electronic",
        },
        {
            "op": "add",
            "path": "/sections/1/tracks/-",
            "value": {"id": "bass_01", "instrument": "bass", "notes": []},
        },
    ],
    "musicalDiff": {
        "barsChanged": [9, 16],
        "notesAdded": 12,
        "notesRemoved": 4,
        "preservedMotifs": ["motif_main"],
    },
}

_INVALID_PROPOSAL: dict = {
    # Missing "patch" — schema invalid
    "musicalDiff": {"barsChanged": [], "notesAdded": 0, "notesRemoved": 0},
}


# ── Mock backend ──

class MockBackend:
    """Deterministic LlmBackend for testing.

    Returns pre-configured LlmResponse objects in sequence. Tracks every
    call for inspection in tests (tools passed, messages, system prompt).
    """

    PROMPTS: dict[str, list[LlmResponse]] = {
        "make bars 9-16 darker": [
            LlmResponse(
                text="Analyzing bars 9-16: found motif_main, energy 0.35"
            ),
            LlmResponse(
                tool_calls=[
                    ToolCall(
                        id="t1",
                        name="analyze_motif",
                        arguments={"motifId": "motif_main"},
                    )
                ]
            ),
            LlmResponse(text="Plan: darken genre, add bassline"),
            LlmResponse(
                tool_calls=[
                    ToolCall(
                        id="t2",
                        name="generate_bassline",
                        arguments={"chords": ["Am", "F", "C", "G"]},
                    )
                ]
            ),
            LlmResponse(text="Validating patch..."),
            LlmResponse(proposal=_SAMPLE_PROPOSAL),
        ],
        "fail:schema_invalid": [
            LlmResponse(text="Generating patch proposal..."),
            LlmResponse(proposal=_INVALID_PROPOSAL),
            # After validation error feedback, retry with valid proposal
            LlmResponse(text="Fixing validation errors..."),
            LlmResponse(proposal=_SAMPLE_PROPOSAL),
        ],
        "fail:timeout": [
            LlmResponse(text="Thinking... need more time."),
            LlmResponse(text="Still analyzing the chord structure..."),
            LlmResponse(text="Almost done, checking voice leading..."),
            LlmResponse(text="Continuing analysis..."),
            LlmResponse(text="Working on it..."),
            LlmResponse(text="Processing..."),
            LlmResponse(text="Still thinking..."),
            LlmResponse(text="One moment please..."),
            LlmResponse(text="Almost there..."),
            LlmResponse(text="Finalizing..."),
            # Never produces a proposal — hits max_iterations
        ],
    }

    def __init__(
        self,
        responses: list[LlmResponse] | None = None,
    ) -> None:
        """Create a mock backend.

        Args:
            responses: Pre-configured response sequence. If None, each
                       chat() call returns an empty LlmResponse.
        """
        self._responses: list[LlmResponse] = list(responses) if responses else []
        self._index: int = 0

        # Call tracking for test assertions
        self.calls: list[dict] = []

    @classmethod
    def from_prompt(cls, prompt_key: str) -> MockBackend:
        """Factory: create a MockBackend from a named PROMPTS entry."""
        sequence = cls.PROMPTS.get(prompt_key, [])
        return cls(responses=list(sequence))

    async def chat(
        self, system: str, messages: list[dict], tools: list[dict]
    ) -> LlmResponse:
        """Return the next pre-configured LlmResponse.

        Records the full call signature for test inspection.
        When the sequence is exhausted, returns an empty text response.
        """
        self.calls.append(
            {
                "system": system,
                "messages": list(messages),
                "tools": list(tools),
            }
        )

        if self._index < len(self._responses):
            response = self._responses[self._index]
            self._index += 1
            return response

        return LlmResponse(text="")
