import { useAgentUiStore } from "../../stores/useAgentUiStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import { Sparkles, Send } from "lucide-react";
import { testIds } from "../../testids";

export function AgentPanel() {
  const draftPrompt = useAgentUiStore((s) => s.draftPrompt);
  const setDraftPrompt = useAgentUiStore((s) => s.setDraftPrompt);
  const streamVisible = useAgentUiStore((s) => s.streamVisible);
  const previewPatchId = useEditorStore((s) => s.previewPatchId);

  return (
    <div data-testid={testIds.agentPanel} className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <span className="text-heading font-semibold uppercase tracking-wider text-muted">
          Agent
        </span>
        <Badge variant="accent">Mock</Badge>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <Textarea
          data-testid={testIds.agentPrompt}
          placeholder="Describe what you want to change..."
          value={draftPrompt}
          onChange={(e) => setDraftPrompt(e.target.value)}
          className="flex-1 resize-none"
        />
        <div className="flex items-center justify-between">
          <Button
            data-testid={testIds.agentSend}
            size="sm"
            disabled={!draftPrompt.trim()}
          >
            <Send className="h-4 w-4" />
            Send
          </Button>
          {streamVisible && (
            <span className="text-compact text-muted">Streaming...</span>
          )}
        </div>
      </div>

      {previewPatchId && (
        <div className="flex items-center gap-2 rounded-control border border-accent/30 bg-accent/5 px-3 py-2">
          <span className="text-compact text-accent">Patch preview active</span>
          <div className="ml-auto flex gap-1.5">
            <Button data-testid={testIds.patchApply} size="sm" variant="default">
              Apply
            </Button>
            <Button
              data-testid={testIds.patchReject}
              size="sm"
              variant="ghost"
            >
              Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
