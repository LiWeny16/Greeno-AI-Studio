import { describe, expect, it, beforeEach } from "vitest";
import { sampleMusicIr } from "@cc-music/music-ir";
import { cn } from "../lib/cn";
import { useEditorStore } from "../stores/useEditorStore";
import { useTransportStore } from "../stores/useTransportStore";
import { usePanelStore } from "../stores/usePanelStore";
import { useAgentUiStore } from "../stores/useAgentUiStore";

// ---------------------------------------------------------------------------
// cn helper
// ---------------------------------------------------------------------------
describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("foo", false && "bar", undefined, "baz")).toBe("foo baz");
  });

  it("resolves tailwind conflicts via twMerge", () => {
    expect(cn("px-2 px-4")).toBe("px-4");
  });
});

// ---------------------------------------------------------------------------
// useEditorStore
// ---------------------------------------------------------------------------
describe("useEditorStore", () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it("has correct initial state", () => {
    const s = useEditorStore.getState();
    expect(s.activeProjectId).toBeNull();
    expect(s.selectedBarRange).toBeNull();
    expect(s.selectedSectionIds).toEqual([]);
    expect(s.selectedTrackIds).toEqual([]);
    expect(s.selectedNoteIds).toEqual([]);
    expect(s.activeEditorTab).toBe("timeline");
    expect(s.zoom).toBe(1);
    expect(s.scroll).toEqual({ x: 0, y: 0 });
    expect(s.previewPatchId).toBeNull();
  });

  it("sets activeProjectId", () => {
    useEditorStore.getState().setActiveProjectId("demo");
    expect(useEditorStore.getState().activeProjectId).toBe("demo");
  });

  it("sets and clears selectedBarRange", () => {
    useEditorStore.getState().setSelectedBarRange([1, 8]);
    expect(useEditorStore.getState().selectedBarRange).toEqual([1, 8]);
    useEditorStore.getState().setSelectedBarRange(null);
    expect(useEditorStore.getState().selectedBarRange).toBeNull();
  });

  it("adds and removes selectedSectionIds", () => {
    const store = useEditorStore.getState();
    store.addSelectedSectionId("a");
    store.addSelectedSectionId("b");
    store.addSelectedSectionId("a"); // duplicate ignored
    expect(useEditorStore.getState().selectedSectionIds).toEqual(["a", "b"]);

    store.removeSelectedSectionId("a");
    expect(useEditorStore.getState().selectedSectionIds).toEqual(["b"]);
  });

  it("sets selectedSectionIds in bulk", () => {
    useEditorStore.getState().setSelectedSectionIds(["x", "y"]);
    expect(useEditorStore.getState().selectedSectionIds).toEqual(["x", "y"]);
  });

  it("adds and removes selectedTrackIds", () => {
    const store = useEditorStore.getState();
    store.addSelectedTrackId("t1");
    store.addSelectedTrackId("t2");
    expect(useEditorStore.getState().selectedTrackIds).toEqual(["t1", "t2"]);
    store.removeSelectedTrackId("t1");
    expect(useEditorStore.getState().selectedTrackIds).toEqual(["t2"]);
  });

  it("adds and removes selectedNoteIds", () => {
    const store = useEditorStore.getState();
    store.addSelectedNoteId("n1");
    store.addSelectedNoteId("n2");
    expect(useEditorStore.getState().selectedNoteIds).toEqual(["n1", "n2"]);
    store.removeSelectedNoteId("n2");
    expect(useEditorStore.getState().selectedNoteIds).toEqual(["n1"]);
  });

  it("switches activeEditorTab", () => {
    useEditorStore.getState().setActiveEditorTab("piano-roll");
    expect(useEditorStore.getState().activeEditorTab).toBe("piano-roll");
  });

  it("clamps zoom", () => {
    useEditorStore.getState().setZoom(0.01);
    expect(useEditorStore.getState().zoom).toBe(0.1);
    useEditorStore.getState().setZoom(20);
    expect(useEditorStore.getState().zoom).toBe(10);
  });

  it("sets scroll", () => {
    useEditorStore.getState().setScroll({ x: 10, y: 20 });
    expect(useEditorStore.getState().scroll).toEqual({ x: 10, y: 20 });
  });

  it("sets previewPatchId", () => {
    useEditorStore.getState().setPreviewPatchId("patch_001");
    expect(useEditorStore.getState().previewPatchId).toBe("patch_001");
    useEditorStore.getState().setPreviewPatchId(null);
    expect(useEditorStore.getState().previewPatchId).toBeNull();
  });

  it("clears all selections", () => {
    const store = useEditorStore.getState();
    store.setSelectedBarRange([1, 4]);
    store.addSelectedSectionId("a");
    store.addSelectedTrackId("t1");
    store.addSelectedNoteId("n1");
    store.clearSelection();
    const s = useEditorStore.getState();
    expect(s.selectedBarRange).toBeNull();
    expect(s.selectedSectionIds).toEqual([]);
    expect(s.selectedTrackIds).toEqual([]);
    expect(s.selectedNoteIds).toEqual([]);
  });

  it("resets to initial state", () => {
    const store = useEditorStore.getState();
    store.setActiveProjectId("test");
    store.setZoom(3);
    store.reset();
    expect(useEditorStore.getState().activeProjectId).toBeNull();
    expect(useEditorStore.getState().zoom).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// useTransportStore
// ---------------------------------------------------------------------------
describe("useTransportStore", () => {
  beforeEach(() => {
    useTransportStore.getState().reset();
  });

  it("has correct initial state", () => {
    const s = useTransportStore.getState();
    expect(s.isPlaying).toBe(false);
    expect(s.playheadBeat).toBe(0);
    expect(s.loopRange).toBeNull();
    expect(s.metronomeEnabled).toBe(false);
  });

  it("play / pause / stop", () => {
    const store = useTransportStore.getState();
    store.play();
    expect(useTransportStore.getState().isPlaying).toBe(true);
    store.pause();
    expect(useTransportStore.getState().isPlaying).toBe(false);
    store.play();
    store.stop();
    const s = useTransportStore.getState();
    expect(s.isPlaying).toBe(false);
    expect(s.playheadBeat).toBe(0);
  });

  it("togglePlay toggles", () => {
    const store = useTransportStore.getState();
    store.togglePlay();
    expect(useTransportStore.getState().isPlaying).toBe(true);
    store.togglePlay();
    expect(useTransportStore.getState().isPlaying).toBe(false);
  });

  it("sets playheadBeat", () => {
    useTransportStore.getState().setPlayheadBeat(16.5);
    expect(useTransportStore.getState().playheadBeat).toBe(16.5);
  });

  it("sets loopRange and metronome", () => {
    const store = useTransportStore.getState();
    store.setLoopRange([1, 8]);
    expect(useTransportStore.getState().loopRange).toEqual([1, 8]);
    store.setLoopRange(null);
    expect(useTransportStore.getState().loopRange).toBeNull();
    store.setMetronomeEnabled(true);
    expect(useTransportStore.getState().metronomeEnabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// usePanelStore
// ---------------------------------------------------------------------------
describe("usePanelStore", () => {
  beforeEach(() => {
    usePanelStore.getState().reset();
  });

  it("has correct initial state", () => {
    const s = usePanelStore.getState();
    expect(s.leftCollapsed).toBe(false);
    expect(s.rightCollapsed).toBe(false);
    expect(s.bottomCollapsed).toBe(false);
    expect(s.panelSizes).toEqual({ left: 260, right: 320, bottom: 220 });
  });

  it("toggles left panel", () => {
    const store = usePanelStore.getState();
    store.toggleLeftCollapsed();
    expect(usePanelStore.getState().leftCollapsed).toBe(true);
    store.toggleLeftCollapsed();
    expect(usePanelStore.getState().leftCollapsed).toBe(false);
    store.setLeftCollapsed(true);
    expect(usePanelStore.getState().leftCollapsed).toBe(true);
  });

  it("toggles right panel", () => {
    const store = usePanelStore.getState();
    store.toggleRightCollapsed();
    expect(usePanelStore.getState().rightCollapsed).toBe(true);
    store.setRightCollapsed(false);
    expect(usePanelStore.getState().rightCollapsed).toBe(false);
  });

  it("toggles bottom panel", () => {
    const store = usePanelStore.getState();
    store.toggleBottomCollapsed();
    expect(usePanelStore.getState().bottomCollapsed).toBe(true);
    store.setBottomCollapsed(false);
    expect(usePanelStore.getState().bottomCollapsed).toBe(false);
  });

  it("sets panel sizes partially", () => {
    usePanelStore.getState().setPanelSizes({ left: 300 });
    const s = usePanelStore.getState();
    expect(s.panelSizes.left).toBe(300);
    expect(s.panelSizes.right).toBe(320); // unchanged
  });
});

// ---------------------------------------------------------------------------
// useAgentUiStore
// ---------------------------------------------------------------------------
describe("useAgentUiStore", () => {
  beforeEach(() => {
    useAgentUiStore.getState().reset();
  });

  it("has correct initial state", () => {
    const s = useAgentUiStore.getState();
    expect(s.activeSessionId).toBeNull();
    expect(s.draftPrompt).toBe("");
    expect(s.streamVisible).toBe(false);
    expect(s.expandedProposalIds).toEqual([]);
  });

  it("sets activeSessionId", () => {
    useAgentUiStore.getState().setActiveSessionId("sess_001");
    expect(useAgentUiStore.getState().activeSessionId).toBe("sess_001");
    useAgentUiStore.getState().setActiveSessionId(null);
    expect(useAgentUiStore.getState().activeSessionId).toBeNull();
  });

  it("sets draftPrompt", () => {
    useAgentUiStore.getState().setDraftPrompt("make it darker");
    expect(useAgentUiStore.getState().draftPrompt).toBe("make it darker");
  });

  it("sets streamVisible", () => {
    useAgentUiStore.getState().setStreamVisible(true);
    expect(useAgentUiStore.getState().streamVisible).toBe(true);
  });

  it("toggles proposal expanded", () => {
    const store = useAgentUiStore.getState();
    store.toggleProposalExpanded("p1");
    expect(useAgentUiStore.getState().expandedProposalIds).toEqual(["p1"]);
    store.toggleProposalExpanded("p2");
    expect(useAgentUiStore.getState().expandedProposalIds).toEqual([
      "p1",
      "p2",
    ]);
    store.toggleProposalExpanded("p1");
    expect(useAgentUiStore.getState().expandedProposalIds).toEqual(["p2"]);
  });

  it("sets expandedProposalIds in bulk", () => {
    useAgentUiStore.getState().setExpandedProposalIds(["a", "b", "c"]);
    expect(useAgentUiStore.getState().expandedProposalIds).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Studio shell smoke checks
// ---------------------------------------------------------------------------
describe("studio shell", () => {
  it("starts from the sample project fixture", () => {
    expect(sampleMusicIr.projectId).toBe("demo");
  });

  it("App component exports as a function", async () => {
    const mod = await import("./App");
    expect(typeof mod.App).toBe("function");
  });
});
