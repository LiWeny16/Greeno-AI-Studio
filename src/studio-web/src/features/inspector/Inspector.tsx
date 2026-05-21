import { Lock, Unlock } from "lucide-react";
import { sampleMusicIr } from "@cc-music/music-ir";
import { testIds } from "../../testids";
import { useEditorStore } from "../../stores/useEditorStore";

export function Inspector() {
  const selectedBarRange = useEditorStore((s) => s.selectedBarRange);
  const selectedSectionIds = useEditorStore((s) => s.selectedSectionIds);
  const selectedNoteIds = useEditorStore((s) => s.selectedNoteIds);

  const selectedSection =
    selectedSectionIds.length === 1
      ? sampleMusicIr.sections.find((s) => s.id === selectedSectionIds[0])
      : null;

  const sectionLocks = selectedSection?.locks;

  return (
    <div data-testid={testIds.inspector} className="flex flex-col gap-3 p-4">
      <h2 className="text-heading font-semibold uppercase tracking-wider text-muted">
        Inspector
      </h2>

      <div className="flex flex-col gap-2">
        <div className="text-compact font-medium text-muted">Selection</div>

        {selectedBarRange ? (
          <div className="rounded-control border border-border bg-panel-2 px-3 py-2 text-editor-value text-foreground">
            Bars {selectedBarRange[0]}&ndash;{selectedBarRange[1]}
          </div>
        ) : (
          <div className="rounded-control border border-border bg-panel-2 px-3 py-2 text-compact text-muted-foreground">
            No bar selection
          </div>
        )}

        {selectedSectionIds.length > 0 && (
          <div className="rounded-control border border-border bg-panel-2 px-3 py-2 text-compact text-foreground">
            {selectedSectionIds.length} section
            {selectedSectionIds.length !== 1 ? "s" : ""} selected
          </div>
        )}
      </div>

      {/* Notes Section */}
      {selectedNoteIds.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-compact font-medium text-muted">Selected Notes</div>
          <div className="rounded-control border border-border bg-panel-2 px-3 py-2">
            <div className="text-compact text-foreground">
              {selectedNoteIds.length} note
              {selectedNoteIds.length > 1 ? "s" : ""} selected
            </div>
          </div>
          <div className="text-compact text-muted-foreground">
            Click a note to see details
          </div>
        </div>
      )}

      {/* Locks Section */}
      {selectedSectionIds.length > 0 && sectionLocks && (
        <div className="flex flex-col gap-2">
          <div className="text-compact font-medium text-muted">Locks</div>
          <div className="flex flex-col gap-1">
            {(["melody", "rhythm", "chords", "tempo", "key"] as const).map(
              (lock) => (
                <div key={lock} className="flex items-center gap-2 text-compact">
                  {sectionLocks[lock] ? (
                    <Lock className="h-3.5 w-3.5 text-warning" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span
                    className={
                      sectionLocks[lock]
                        ? "text-warning"
                        : "text-muted-foreground"
                    }
                  >
                    {lock}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="text-compact font-medium text-muted">Properties</div>
        <div className="rounded-control border border-border bg-panel-2 px-3 py-2 text-compact text-muted-foreground">
          Select an item to edit properties
        </div>
      </div>
    </div>
  );
}
