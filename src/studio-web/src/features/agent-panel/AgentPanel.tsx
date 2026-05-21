import { useCallback, useRef, useState } from "react";
import {
  useAgentUiStore,
  type AgentMessage,
} from "../../stores/useAgentUiStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Badge } from "../../components/ui/badge";
import {
  Sparkles,
  Send,
  Wrench,
  AlertTriangle,
  Square,
  RefreshCw,
} from "lucide-react";
import { testIds } from "../../testids";

const MAX_PROMPT_LENGTH = 500;

function formatTimestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function simulateAgentStream(
  onEvent: (msg: Omit<AgentMessage, "timestamp">) => void,
): () => void {
  const steps: Omit<AgentMessage, "timestamp">[] = [
    { role: "agent", text: "Analyzing selection..." },
    { role: "tool", text: "read_ir_section -> found motif_main, energy 0.35" },
    { role: "agent", text: "Plan: darken genre, add bassline" },
    { role: "tool", text: "generate_bassline -> D3-F3-G3 pattern" },
    { role: "agent", text: "Validating patch... all checks passed" },
  ];

  const timers: ReturnType<typeof setTimeout>[] = [];

  steps.forEach((step, i) => {
    const t = setTimeout(() => onEvent(step), (i + 1) * 800);
    timers.push(t);
  });

  const proposalTimer = setTimeout(() => {
    onEvent({
      role: "proposal",
      text: "Add bassline and darken genre for selected section",
      proposal: {
        id: `proposal_${Date.now()}`,
        summary:
          "Add bassline pattern D3-F3-G3, darken genre parameters, adjust velocity on motif_main",
        notesAdded: 12,
        notesRemoved: 3,
        barsChanged: 4,
        preservedMotifs: 2,
      },
    });
  }, steps.length * 800 + 500);

  timers.push(proposalTimer);

  return () => {
    timers.forEach(clearTimeout);
  };
}

export function AgentPanel() {
  const draftPrompt = useAgentUiStore((s) => s.draftPrompt);
  const setDraftPrompt = useAgentUiStore((s) => s.setDraftPrompt);
  const streamVisible = useAgentUiStore((s) => s.streamVisible);
  const setStreamVisible = useAgentUiStore((s) => s.setStreamVisible);
  const messages = useAgentUiStore((s) => s.messages);
  const addMessage = useAgentUiStore((s) => s.addMessage);
  const clearMessages = useAgentUiStore((s) => s.clearMessages);
  const isStreaming = useAgentUiStore((s) => s.isStreaming);
  const setStreaming = useAgentUiStore((s) => s.setStreaming);
  const previewPatchId = useEditorStore((s) => s.previewPatchId);
  const setPreviewPatchId = useEditorStore((s) => s.setPreviewPatchId);

  const cancelRef = useRef<(() => void) | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  const latestProposal = [...messages]
    .reverse()
    .find((m) => m.role === "proposal");
  const hasErrorMessages = messages.some((m) => m.role === "error");
  const hasMessages = messages.length > 0;

  const fallbackToSimulation = useCallback(() => {
    const cancel = simulateAgentStream((msg) => {
      addMessage({ ...msg, timestamp: formatTimestamp() } as AgentMessage);

      if (msg.role === "proposal" && msg.proposal) {
        setStreaming(false);
        setStreamVisible(false);
        setPreviewPatchId(msg.proposal.id);
      }
    });

    cancelRef.current = cancel;
  }, [addMessage, setStreaming, setStreamVisible, setPreviewPatchId]);

  const handleSend = useCallback(() => {
    const prompt = draftPrompt.trim();
    if (!prompt || isStreaming) return;

    setStreamError(null);
    setPreviewPatchId(null);
    clearMessages();
    setStreamVisible(true);
    setStreaming(true);

    const PROXY_HOST =
      import.meta.env.VITE_BACKEND_HOST ?? "localhost:8787";

    // Try real backend first — fall back to local simulation on any failure
    fetch(`http://${PROXY_HOST}/api/projects/demo/agent/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, selection: {}, snapshotId: "latest" }),
    })
      .then((resp) => {
        if (!resp.ok) {
          fallbackToSimulation();
          return;
        }
        resp
          .json()
          .then(({ sessionId }: { sessionId: string }) => {
            const wsProtocol = PROXY_HOST.startsWith("https") ? "wss" : "ws";
            const wsHost = PROXY_HOST.replace(/^https?:\/\//, "");
            const token = localStorage.getItem("cc-music-token") ?? "";
            const params = new URLSearchParams();
            if (token) params.set("token", token);
            const qs = params.toString();
            const wsUrl = `${wsProtocol}://${wsHost}/ws/projects/demo/agent/${sessionId}${qs ? `?${qs}` : ""}`;

            const ws = new WebSocket(wsUrl);
            ws.onmessage = (e) => {
              const event = JSON.parse(e.data);
              if (event.type === "done") {
                setStreaming(false);
                setStreamVisible(false);
                if (event.data?.proposal) {
                  addMessage({
                    role: "proposal",
                    text: "Proposal ready",
                    proposal: {
                      id: event.data.proposal.proposalId,
                      summary: event.data.proposal.summary ?? "AI proposal",
                      notesAdded:
                        event.data.proposal.musicalDiff?.notesAdded ?? 0,
                      notesRemoved:
                        event.data.proposal.musicalDiff?.notesRemoved ?? 0,
                      barsChanged:
                        event.data.proposal.musicalDiff?.barsChanged?.length ??
                        0,
                      preservedMotifs:
                        event.data.proposal.musicalDiff?.preservedMotifs
                          ?.length ?? 0,
                    },
                    timestamp: formatTimestamp(),
                  } as AgentMessage);
                  setPreviewPatchId(event.data.proposal.proposalId);
                }
                ws.close();
              } else if (event.type === "stream_event") {
                const d = event.data;
                addMessage({
                  role: d.type === "tool_result" ? "tool" : "agent",
                  text: d.data?.text ?? JSON.stringify(d.data ?? d),
                  timestamp: formatTimestamp(),
                } as AgentMessage);
              } else if (event.type === "error") {
                setStreamError(
                  event.data?.message ?? event.data?.data?.message ?? "Agent error",
                );
                setStreaming(false);
                ws.close();
              }
            };
            ws.onerror = () => {
              fallbackToSimulation();
            };
          })
          .catch(() => {
            fallbackToSimulation();
          });
      })
      .catch(() => {
        fallbackToSimulation();
      });
  }, [
    draftPrompt,
    isStreaming,
    clearMessages,
    setStreamVisible,
    setStreaming,
    addMessage,
    setPreviewPatchId,
    fallbackToSimulation,
  ]);

  const handleStop = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setStreaming(false);
  }, [setStreaming]);

  const handleRetry = useCallback(() => {
    setStreamError(null);
    handleSend();
  }, [handleSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleReject = useCallback(() => {
    setPreviewPatchId(null);
  }, [setPreviewPatchId]);

  const showThoughtLogToggle =
    !isStreaming && hasMessages && latestProposal != null;

  const isSendDisabled = !draftPrompt.trim() || isStreaming;

  return (
    <div
      data-testid={testIds.agentPanel}
      className="flex h-full flex-col gap-3 p-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <span className="text-heading font-semibold uppercase tracking-wider text-muted">
          Agent
        </span>
        <Badge variant="accent">Mock</Badge>
      </div>

      {/* Prompt Input Area */}
      <div className="flex flex-col gap-2">
        <Textarea
          data-testid={testIds.agentPrompt}
          placeholder="Describe what you want to change..."
          value={draftPrompt}
          onChange={(e) => setDraftPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          className="min-h-[80px] resize-none"
          maxLength={MAX_PROMPT_LENGTH}
        />
        <div className="flex items-center justify-between">
          <span className="text-compact text-faint">
            {draftPrompt.length}/{MAX_PROMPT_LENGTH}
          </span>
          <div className="flex gap-1.5">
            {isStreaming && (
              <Button
                data-testid={testIds.agentStop}
                size="sm"
                variant="ghost"
                onClick={handleStop}
              >
                <Square className="h-4 w-4" />
                Stop
              </Button>
            )}
            <Button
              data-testid={testIds.agentSend}
              size="sm"
              disabled={isSendDisabled}
              onClick={handleSend}
            >
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
        </div>
      </div>

      {/* Streaming Thought Log */}
      {streamVisible && hasMessages && (
        <ScrollArea
          data-testid={testIds.agentThoughtLog}
          className="flex-1 rounded-control border border-border bg-panel-2"
        >
          <div className="flex flex-col gap-1 p-2">
            {messages.map((msg, i) => {
              const isLatest = i === messages.length - 1 && isStreaming;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-1.5 rounded px-2 py-1 text-compact ${
                    msg.role === "error"
                      ? "bg-danger/10 text-danger"
                      : msg.role === "tool"
                        ? "font-mono text-muted"
                        : "text-muted"
                  } ${isLatest && isStreaming ? "animate-pulse" : ""}`}
                >
                  {msg.role === "agent" && (
                    <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-muted" />
                  )}
                  {msg.role === "tool" && (
                    <Wrench className="mt-0.5 h-3 w-3 shrink-0 text-muted" />
                  )}
                  {msg.role === "error" && (
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-danger" />
                  )}
                  <span className="shrink-0 text-faint">{msg.timestamp}</span>
                  <span className="break-words">{msg.text}</span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Thought log toggle (when collapsed after proposal) */}
      {showThoughtLogToggle && (
        <button
          type="button"
          className="text-compact text-faint hover:text-muted transition-colors text-left"
          onClick={() => setStreamVisible(!streamVisible)}
        >
          {streamVisible ? "Hide reasoning" : "Show reasoning"}
        </button>
      )}

      {/* Empty State */}
      {!streamVisible &&
        !hasMessages &&
        !streamError &&
        !latestProposal &&
        !previewPatchId && (
          <div className="flex flex-1 items-center justify-center text-center">
            <p className="text-compact text-muted">
              Describe what you want to change above and click Send.
            </p>
          </div>
        )}

      {/* Stream Error State */}
      {streamError && (
        <div className="rounded-control border border-danger/40 bg-danger/10 px-3 py-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <div className="flex-1">
              <p className="text-compact font-medium text-danger">
                Stream Error
              </p>
              <p className="text-compact text-muted">{streamError}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={handleRetry}>
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Error messages in stream */}
      {!streamVisible &&
        !streamError &&
        hasErrorMessages &&
        !latestProposal &&
        !previewPatchId && (
          <div className="rounded-control border border-danger/40 bg-danger/10 px-3 py-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <div className="flex-1">
                <p className="text-compact font-medium text-danger">
                  Validation Failed
                </p>
                <p className="text-compact text-muted">
                  {messages.find((m) => m.role === "error")?.text ??
                    "An error occurred during agent processing."}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={handleRetry}>
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          </div>
        )}

      {/* Proposal Card */}
      {latestProposal?.proposal && (
        <div
          data-testid={testIds.agentProposalCard}
          className="rounded-control border border-accent/30 bg-accent/5 p-3"
        >
          <p className="text-compact font-semibold text-accent">
            Proposed changes:
          </p>
          <p className="mt-1 text-compact text-muted">
            {latestProposal.proposal.summary}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1 text-compact">
            <span className="text-muted">Notes added</span>
            <span className="text-right tabular-nums text-success">
              {latestProposal.proposal.notesAdded}
            </span>
            <span className="text-muted">Notes removed</span>
            <span className="text-right tabular-nums text-danger">
              {latestProposal.proposal.notesRemoved}
            </span>
            <span className="text-muted">Bars changed</span>
            <span className="text-right tabular-nums text-warning">
              {latestProposal.proposal.barsChanged}
            </span>
            <span className="text-muted">Motifs preserved</span>
            <span className="text-right tabular-nums">
              {latestProposal.proposal.preservedMotifs}
            </span>
          </div>
          <div className="mt-3 flex gap-1.5">
            <Button
              data-testid={testIds.patchApply}
              size="sm"
              variant="default"
            >
              Apply
            </Button>
            <Button
              data-testid={testIds.patchReject}
              size="sm"
              variant="ghost"
              onClick={handleReject}
            >
              Reject
            </Button>
          </div>
        </div>
      )}

      {/* Legacy patch preview bar (when previewPatchId is set without proposal) */}
      {previewPatchId && !latestProposal?.proposal && (
        <div className="flex items-center gap-2 rounded-control border border-accent/30 bg-accent/5 px-3 py-2">
          <span className="text-compact text-accent">Patch preview active</span>
          <div className="ml-auto flex gap-1.5">
            <Button
              data-testid={testIds.patchApply}
              size="sm"
              variant="default"
            >
              Apply
            </Button>
            <Button
              data-testid={testIds.patchReject}
              size="sm"
              variant="ghost"
              onClick={handleReject}
            >
              Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
