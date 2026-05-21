import {
  Music2,
  Piano,
  SlidersHorizontal,
  PanelLeft,
  PanelRight,
  PanelBottom,
  Sparkles,
  Clock3,
  Save,
  FolderOpen,
  Download,
} from "lucide-react";
import { sampleMusicIr } from "@cc-music/music-ir";
import { barRangeLength } from "@cc-music/timeline-engine";
import { testIds } from "../testids";
import { useEditorStore } from "../stores/useEditorStore";
import { usePanelStore } from "../stores/usePanelStore";
import { useAgentUiStore } from "../stores/useAgentUiStore";
import { TooltipProvider } from "../components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { IconButton } from "../components/ui/icon-button";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { ScrollArea } from "../components/ui/scroll-area";
import { Timeline } from "../features/timeline/Timeline";
import { PianoRoll } from "../features/piano-roll/PianoRoll";
import { Inspector } from "../features/inspector/Inspector";
import { AgentPanel } from "../features/agent-panel/AgentPanel";
import { Transport } from "../features/transport/Transport";
import { QueryProvider } from "../lib/api";
import { useProject } from "../lib/api";

export function App() {
  const activeEditorTab = useEditorStore((s) => s.activeEditorTab);
  const setActiveEditorTab = useEditorStore((s) => s.setActiveEditorTab);
  const previewPatchId = useEditorStore((s) => s.previewPatchId);
  const setPreviewPatchId = useEditorStore((s) => s.setPreviewPatchId);

  const leftCollapsed = usePanelStore((s) => s.leftCollapsed);
  const rightCollapsed = usePanelStore((s) => s.rightCollapsed);
  const bottomCollapsed = usePanelStore((s) => s.bottomCollapsed);
  const toggleLeftCollapsed = usePanelStore((s) => s.toggleLeftCollapsed);
  const toggleRightCollapsed = usePanelStore((s) => s.toggleRightCollapsed);
  const toggleBottomCollapsed = usePanelStore((s) => s.toggleBottomCollapsed);
  const panelSizes = usePanelStore((s) => s.panelSizes);

  const { data: projectIr } = useProject("demo");
  const musicIr = projectIr ?? sampleMusicIr;

  const firstSection = musicIr.sections[0];
  const barCount = firstSection ? barRangeLength(firstSection.barRange) : 0;

  return (
    <QueryProvider>
    <TooltipProvider delayDuration={300}>
      <div
        className="flex h-screen flex-col overflow-hidden bg-background text-foreground"
        data-testid={testIds.appShell}
      >
        {/* ===== Top Bar (48px) ===== */}
        <header
          data-testid={testIds.topBar}
          className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-panel px-3"
        >
          {/* Project info */}
          <div className="flex items-center gap-2">
            <Music2 className="h-[18px] w-[18px] text-accent" />
            <div className="flex flex-col leading-none">
              <span className="text-body font-medium">
                {musicIr.title}
              </span>
              <span className="text-compact text-muted-foreground">
                {musicIr.projectId}
              </span>
            </div>
            <Badge variant="success" className="ml-1">
              Saved
            </Badge>
          </div>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Project metadata */}
          <div className="flex items-center gap-3 text-compact text-muted">
            <span className="text-editor-value text-foreground">
              {musicIr.tempo} BPM
            </span>
            <span className="text-foreground">{musicIr.key}</span>
            <span className="text-muted-foreground">
              {musicIr.timeSignature}
            </span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Transport */}
          <Transport />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-1">
            <IconButton label="Save" tooltip="Save project" size="sm" variant="ghost">
              <Save className="h-4 w-4" />
            </IconButton>
            <IconButton label="Open project" tooltip="Open project" size="sm" variant="ghost">
              <FolderOpen className="h-4 w-4" />
            </IconButton>
            <IconButton
              data-testid={testIds.exportMidi}
              label="Export MIDI"
              tooltip="Export MIDI"
              size="sm"
              variant="ghost"
            >
              <Download className="h-4 w-4" />
            </IconButton>
          </div>
        </header>

        {/* ===== Middle: Left Rail + Center + Right Inspector ===== */}
        <div className="flex flex-1 min-h-0">
          {/* Left Rail (260px default) */}
          {!leftCollapsed && (
            <aside
              data-testid={testIds.leftRail}
              className="flex shrink-0 flex-col border-r border-border bg-panel"
              style={{ width: panelSizes.left }}
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-heading font-semibold uppercase tracking-wider text-muted">
                  Project
                </span>
                <IconButton
                  label="Collapse left panel"
                  tooltip="Collapse left panel"
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleLeftCollapsed()}
                >
                  <PanelLeft className="h-4 w-4" />
                </IconButton>
              </div>

              <ScrollArea className="flex-1 p-3">
                <div className="flex flex-col gap-4">
                  {/* Motifs */}
                  <div>
                    <div className="mb-2 flex items-center gap-1.5">
                      <Music2 className="h-4 w-4 text-muted" />
                      <span className="text-compact font-medium text-muted">
                        Motifs
                      </span>
                      <span className="text-compact text-muted-foreground">
                        {musicIr.motifs.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {musicIr.motifs.map((motif) => (
                        <div
                          key={motif.id}
                          className="cursor-pointer rounded-control px-3 py-1.5 text-compact text-foreground transition-colors hover:bg-surface"
                        >
                          {motif.id}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tracks */}
                  <div>
                    <div className="mb-2 flex items-center gap-1.5">
                      <SlidersHorizontal className="h-4 w-4 text-muted" />
                      <span className="text-compact font-medium text-muted">
                        Tracks
                      </span>
                      <span className="text-compact text-muted-foreground">
                        {musicIr.tracks.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {musicIr.tracks.map((track) => (
                        <div
                          key={track.id}
                          className="cursor-pointer rounded-control px-3 py-1.5 text-compact text-foreground transition-colors hover:bg-surface"
                        >
                          {track.name}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sections */}
                  <div>
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className="text-compact font-medium text-muted">
                        Sections
                      </span>
                      <span className="text-compact text-muted-foreground">
                        {musicIr.sections.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {musicIr.sections.map((section) => (
                        <div
                          key={section.id}
                          className="cursor-pointer rounded-control px-3 py-1.5 text-compact text-foreground transition-colors hover:bg-surface"
                        >
                          <div>{section.name}</div>
                          <div className="text-compact text-muted-foreground">
                            Bars {section.barRange[0]}&ndash;
                            {section.barRange[1]}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </aside>
          )}

          {/* Left rail expand button when collapsed */}
          {leftCollapsed && (
            <div className="flex shrink-0 flex-col items-center border-r border-border bg-panel py-2">
              <IconButton
                label="Expand left panel"
                tooltip="Expand left panel"
                size="sm"
                variant="ghost"
                onClick={() => toggleLeftCollapsed()}
              >
                <PanelLeft className="h-4 w-4" />
              </IconButton>
            </div>
          )}

          {/* Center Editor */}
          <div className="flex flex-1 flex-col min-w-0">
            <Tabs
              value={activeEditorTab}
              onValueChange={(v) =>
                setActiveEditorTab(v as "timeline" | "piano-roll")
              }
              className="flex flex-1 flex-col min-h-0"
            >
              <div className="flex shrink-0 items-center border-b border-border bg-panel px-2">
                <TabsList data-testid={testIds.editorTabs}>
                  <TabsTrigger value="timeline">
                    <Music2 className="h-4 w-4" />
                    Timeline
                  </TabsTrigger>
                  <TabsTrigger value="piano-roll">
                    <Piano className="h-4 w-4" />
                    Piano Roll
                  </TabsTrigger>
                </TabsList>

                <div className="ml-auto flex items-center gap-1 px-2">
                  <span className="text-compact text-muted-foreground">
                    {barCount} bars
                  </span>
                </div>
              </div>

              <TabsContent
                value="timeline"
                className="flex flex-1 flex-col min-h-[140px]"
              >
                <Timeline />
              </TabsContent>

              <TabsContent
                value="piano-roll"
                className="flex flex-1 flex-col min-h-[360px]"
              >
                <PianoRoll />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Inspector (320px default) */}
          {!rightCollapsed && (
            <aside
              data-testid={testIds.rightInspector}
              className="flex shrink-0 flex-col border-l border-border bg-panel"
              style={{ width: panelSizes.right }}
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-heading font-semibold uppercase tracking-wider text-muted">
                  Inspector
                </span>
                <IconButton
                  label="Collapse right panel"
                  tooltip="Collapse right panel"
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleRightCollapsed()}
                >
                  <PanelRight className="h-4 w-4" />
                </IconButton>
              </div>
              <ScrollArea className="flex-1">
                <Inspector />
              </ScrollArea>
            </aside>
          )}

          {/* Right inspector expand button when collapsed */}
          {rightCollapsed && (
            <div className="flex shrink-0 flex-col items-center border-l border-border bg-panel py-2">
              <IconButton
                label="Expand right panel"
                tooltip="Expand right panel"
                size="sm"
                variant="ghost"
                onClick={() => toggleRightCollapsed()}
              >
                <PanelRight className="h-4 w-4" />
              </IconButton>
            </div>
          )}
        </div>

        {/* ===== Bottom Panel (220px, collapsible) ===== */}
        <div
          data-testid={testIds.bottomPanel}
          className="flex shrink-0 flex-col border-t border-border bg-panel"
        >
          <Tabs defaultValue="agent" className="flex flex-1 flex-col min-h-0">
            <div className="flex items-center border-b border-border px-3 py-1.5">
              <TabsList>
                <TabsTrigger value="agent">
                  <Sparkles className="h-4 w-4" />
                  Agent
                </TabsTrigger>
                <TabsTrigger
                  value="jobs"
                  data-testid={testIds.jobQueue}
                >
                  <Clock3 className="h-4 w-4" />
                  Jobs
                </TabsTrigger>
              </TabsList>

              <div className="ml-auto">
                <IconButton
                  label={
                    bottomCollapsed
                      ? "Expand bottom panel"
                      : "Collapse bottom panel"
                  }
                  tooltip={
                    bottomCollapsed
                      ? "Expand bottom panel"
                      : "Collapse bottom panel"
                  }
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleBottomCollapsed()}
                >
                  <PanelBottom className="h-4 w-4" />
                </IconButton>
              </div>
            </div>

            <TabsContent
              value="agent"
              className="flex-1 overflow-hidden data-[state=inactive]:hidden"
              style={
                !bottomCollapsed
                  ? { height: panelSizes.bottom - 36 }
                  : undefined
              }
              data-testid={testIds.agentPanel}
            >
              {bottomCollapsed ? null : <AgentPanel />}
            </TabsContent>

            <TabsContent
              value="jobs"
              className="flex-1 overflow-hidden data-[state=inactive]:hidden"
              style={
                !bottomCollapsed
                  ? { height: panelSizes.bottom - 36 }
                  : undefined
              }
            >
              {!bottomCollapsed && (
                <div className="flex flex-col items-center justify-center gap-2 pt-8 text-center">
                  <Clock3 className="h-6 w-6 text-muted-foreground" />
                  <span className="text-compact text-muted-foreground">
                    No active jobs
                  </span>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview patch notification bar */}
        {previewPatchId && (
          <div className="flex shrink-0 items-center gap-3 border-t border-accent/30 bg-accent/10 px-4 py-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-compact text-accent">
              Patch preview active
            </span>
            <div className="ml-auto flex gap-2">
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
                onClick={() => setPreviewPatchId(null)}
              >
                Reject
              </Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
    </QueryProvider>
  );
}
