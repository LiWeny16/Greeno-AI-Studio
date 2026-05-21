import { create } from "zustand";

interface EditorState {
  activeProjectId: string | null;
  selectedBarRange: [number, number] | null;
  selectedSectionIds: string[];
  selectedTrackIds: string[];
  selectedNoteIds: string[];
  activeEditorTab: "timeline" | "piano-roll";
  zoom: number;
  scroll: { x: number; y: number };
  previewPatchId: string | null;
  undoDepth: number;
  canUndo: boolean;
  canRedo: boolean;

  setActiveProjectId: (id: string | null) => void;
  setSelectedBarRange: (range: [number, number] | null) => void;
  addSelectedSectionId: (id: string) => void;
  removeSelectedSectionId: (id: string) => void;
  setSelectedSectionIds: (ids: string[]) => void;
  addSelectedTrackId: (id: string) => void;
  removeSelectedTrackId: (id: string) => void;
  setSelectedTrackIds: (ids: string[]) => void;
  addSelectedNoteId: (id: string) => void;
  removeSelectedNoteId: (id: string) => void;
  setSelectedNoteIds: (ids: string[]) => void;
  setActiveEditorTab: (tab: "timeline" | "piano-roll") => void;
  setZoom: (zoom: number) => void;
  setScroll: (scroll: { x: number; y: number }) => void;
  setPreviewPatchId: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  clearSelection: () => void;
  reset: () => void;
}

const initialEditorState = {
  activeProjectId: null,
  selectedBarRange: null as [number, number] | null,
  selectedSectionIds: [] as string[],
  selectedTrackIds: [] as string[],
  selectedNoteIds: [] as string[],
  activeEditorTab: "timeline" as const,
  zoom: 1,
  scroll: { x: 0, y: 0 },
  previewPatchId: null as string | null,
  undoDepth: 0,
  canUndo: false,
  canRedo: true,
};

export const useEditorStore = create<EditorState>()((set) => ({
  ...initialEditorState,

  setActiveProjectId: (id) => set({ activeProjectId: id }),

  setSelectedBarRange: (range) => set({ selectedBarRange: range }),

  addSelectedSectionId: (id) =>
    set((s) => ({
      selectedSectionIds: s.selectedSectionIds.includes(id)
        ? s.selectedSectionIds
        : [...s.selectedSectionIds, id],
    })),

  removeSelectedSectionId: (id) =>
    set((s) => ({
      selectedSectionIds: s.selectedSectionIds.filter((x) => x !== id),
    })),

  setSelectedSectionIds: (ids) => set({ selectedSectionIds: ids }),

  addSelectedTrackId: (id) =>
    set((s) => ({
      selectedTrackIds: s.selectedTrackIds.includes(id)
        ? s.selectedTrackIds
        : [...s.selectedTrackIds, id],
    })),

  removeSelectedTrackId: (id) =>
    set((s) => ({
      selectedTrackIds: s.selectedTrackIds.filter((x) => x !== id),
    })),

  setSelectedTrackIds: (ids) => set({ selectedTrackIds: ids }),

  addSelectedNoteId: (id) =>
    set((s) => ({
      selectedNoteIds: s.selectedNoteIds.includes(id)
        ? s.selectedNoteIds
        : [...s.selectedNoteIds, id],
    })),

  removeSelectedNoteId: (id) =>
    set((s) => ({
      selectedNoteIds: s.selectedNoteIds.filter((x) => x !== id),
    })),

  setSelectedNoteIds: (ids) => set({ selectedNoteIds: ids }),

  setActiveEditorTab: (tab) => set({ activeEditorTab: tab }),

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(10, zoom)) }),

  setScroll: (scroll) => set({ scroll }),

  setPreviewPatchId: (id) => set({ previewPatchId: id }),

  undo: () =>
    set((s) => {
      const newDepth = Math.max(0, s.undoDepth - 1);
      return { undoDepth: newDepth, canUndo: newDepth > 0, canRedo: true };
    }),

  redo: () =>
    set((s) => {
      const newDepth = s.undoDepth + 1;
      return { undoDepth: newDepth, canUndo: true, canRedo: false };
    }),

  clearSelection: () =>
    set({
      selectedBarRange: null,
      selectedSectionIds: [],
      selectedTrackIds: [],
      selectedNoteIds: [],
    }),

  reset: () => set(initialEditorState),
}));
