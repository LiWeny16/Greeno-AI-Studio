import { useState, useCallback, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { sampleMusicIr } from "@cc-music/music-ir";
import type { Note, MusicIr } from "@cc-music/music-ir";
import { useProject, useUpdateProjectIr } from "../../lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PianoRollNote extends Note {
  id: string;
  motifId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function buildInitialNotes(): PianoRollNote[] {
  return sampleMusicIr.motifs.flatMap((motif) =>
    motif.notes.map((note, i) => ({
      ...note,
      id: `${motif.id}-${i}`,
      motifId: motif.id,
    })),
  );
}

let _nextId = 0;
function generateId(): string {
  _nextId += 1;
  return `note-${Date.now()}-${_nextId}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Rebuild MusicIr from a flat note list (groups by motifId). */
function notesToIr(notes: PianoRollNote[]): MusicIr {
  const motifMap = new Map<string, Note[]>();
  for (const n of notes) {
    const existing = motifMap.get(n.motifId) ?? [];
    existing.push({
      pitch: n.pitch,
      startBeat: n.startBeat,
      durationBeats: n.durationBeats,
      velocity: n.velocity,
    });
    motifMap.set(n.motifId, existing);
  }

  return {
    ...sampleMusicIr,
    motifs: Array.from(motifMap.entries()).map(([id, motifNotes]) => ({
      id,
      notes: motifNotes,
      source: { type: "manual" } as const,
      lockStrength: 0.5,
    })),
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Piano-roll note data hook.
 *
 * - Reads notes from TanStack Query (`useProject`) when bridge is running.
 * - Falls back to local state when the backend is offline (dev mode).
 * - Mutations push through the API when online; otherwise update local state.
 *
 * TODO: Replace `useUpdateProjectIr` (full-IR PUT) with the preview->apply
 * patch pipeline via `usePreviewPatch` + `useApplyPatch` when the backend
 * supports per-note EditCommands.
 */
export function usePianoRollNotes() {
  // ── Bridge connectivity ──────────────────────────────────────────────

  const { data: projectIr, isSuccess: isOnline } = useProject("demo");

  // ── Local fallback state ─────────────────────────────────────────────

  const [localNotes, setLocalNotes] = useState<PianoRollNote[]>(buildInitialNotes);

  // ── TanStack Query cache (for optimistic updates in online mode) ─────

  const queryClient = useQueryClient();

  // ── Mutation (full-IR save) ──────────────────────────────────────────

  const updateIr = useUpdateProjectIr("demo");

  // ── Derived notes ────────────────────────────────────────────────────

  const notes: PianoRollNote[] = useMemo(() => {
    if (projectIr) {
      return projectIr.motifs.flatMap((motif) =>
        motif.notes.map((note, i) => ({
          ...note,
          id: `${motif.id}-${i}`,
          motifId: motif.id,
        })),
      );
    }
    return localNotes;
  }, [projectIr, localNotes]);

  // ── Stable mutation refs (so Konva memo layers don't churn) ──────────
  //
  // Mutation callbacks depend on `localNotes` which changes on every edit.
  // If we passed them directly into useCallback deps of the Konva event
  // handlers, every note change would recompute the memoised canvas layers.
  // Refs give us stable identity while always reading the latest closure.

  interface PianoRollActions {
    addNote(
      partial: Omit<PianoRollNote, "id" | "motifId"> & { motifId?: string },
    ): void;
    updateNote(noteId: string, changes: Partial<Omit<PianoRollNote, "id">>): void;
    deleteNote(noteId: string): void;
    deleteNotes(noteIds: string[]): void;
    moveNote(noteId: string, newPitch: string, newStartBeat: number): void;
  }

  const noop = () => {};
  const actionsRef = useRef<PianoRollActions>({
    addNote: noop,
    updateNote: noop,
    deleteNote: noop,
    deleteNotes: noop,
    moveNote: noop,
  });

  // ── addNote ──────────────────────────────────────────────────────────

  const addNote = useCallback(
    (
      partial: Omit<PianoRollNote, "id" | "motifId"> & { motifId?: string },
    ) => {
      const id = generateId();
      const newNote: PianoRollNote = {
        ...partial,
        id,
        motifId: partial.motifId ?? "manual",
      };

      const next = [...localNotes, newNote];
      setLocalNotes(next);

      if (isOnline) {
        const ir = notesToIr(next);
        // Optimistic cache update so the UI sees the change immediately
        queryClient.setQueryData(["project", "demo"], ir);
        updateIr.mutate(ir, {
          onError: () => {
            queryClient.invalidateQueries({ queryKey: ["project", "demo"] });
          },
        });
      }
    },
    [isOnline, localNotes, updateIr, queryClient],
  );

  // ── updateNote ───────────────────────────────────────────────────────

  const updateNote = useCallback(
    (noteId: string, changes: Partial<Omit<PianoRollNote, "id">>) => {
      const next = localNotes.map((n) =>
        n.id === noteId ? { ...n, ...changes } : n,
      );
      setLocalNotes(next);

      if (isOnline) {
        const ir = notesToIr(next);
        queryClient.setQueryData(["project", "demo"], ir);
        updateIr.mutate(ir, {
          onError: () => {
            queryClient.invalidateQueries({ queryKey: ["project", "demo"] });
          },
        });
      }
    },
    [isOnline, localNotes, updateIr, queryClient],
  );

  // ── deleteNote ───────────────────────────────────────────────────────

  const deleteNote = useCallback(
    (noteId: string) => {
      const next = localNotes.filter((n) => n.id !== noteId);
      setLocalNotes(next);

      if (isOnline) {
        const ir = notesToIr(next);
        queryClient.setQueryData(["project", "demo"], ir);
        updateIr.mutate(ir, {
          onError: () => {
            queryClient.invalidateQueries({ queryKey: ["project", "demo"] });
          },
        });
      }
    },
    [isOnline, localNotes, updateIr, queryClient],
  );

  // ── deleteNotes (batch) ──────────────────────────────────────────────

  const deleteNotes = useCallback(
    (noteIds: string[]) => {
      const idSet = new Set(noteIds);
      const next = localNotes.filter((n) => !idSet.has(n.id));
      setLocalNotes(next);

      if (isOnline) {
        const ir = notesToIr(next);
        queryClient.setQueryData(["project", "demo"], ir);
        updateIr.mutate(ir, {
          onError: () => {
            queryClient.invalidateQueries({ queryKey: ["project", "demo"] });
          },
        });
      }
    },
    [isOnline, localNotes, updateIr, queryClient],
  );

  // ── moveNote ─────────────────────────────────────────────────────────

  const moveNote = useCallback(
    (noteId: string, newPitch: string, newStartBeat: number) => {
      const next = localNotes.map((n) =>
        n.id === noteId
          ? { ...n, pitch: newPitch, startBeat: newStartBeat }
          : n,
      );
      setLocalNotes(next);

      if (isOnline) {
        const ir = notesToIr(next);
        queryClient.setQueryData(["project", "demo"], ir);
        updateIr.mutate(ir, {
          onError: () => {
            queryClient.invalidateQueries({ queryKey: ["project", "demo"] });
          },
        });
      }
    },
    [isOnline, localNotes, updateIr, queryClient],
  );

  // Keep the ref current on every render so Konva handlers stay fresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: always sync latest closures
  actionsRef.current = { addNote, updateNote, deleteNote, deleteNotes, moveNote };

  return {
    notes,
    addNote,
    updateNote,
    deleteNote,
    deleteNotes,
    moveNote,
    isPending: updateIr.isPending,
    error: updateIr.error,
    isOnline,
    /** Stable refs — use in canvas event handlers to avoid memo churn. */
    _actionsRef: actionsRef,
  } as const;
}
