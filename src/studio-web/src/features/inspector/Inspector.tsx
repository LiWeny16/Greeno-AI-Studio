import { testIds } from "../../testids";
import { useEditorStore } from "../../stores/useEditorStore";

export function Inspector() {
  const selectedBarRange = useEditorStore((s) => s.selectedBarRange);
  const selectedSectionIds = useEditorStore((s) => s.selectedSectionIds);

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

      <div className="flex flex-col gap-2">
        <div className="text-compact font-medium text-muted">Properties</div>
        <div className="rounded-control border border-border bg-panel-2 px-3 py-2 text-compact text-muted-foreground">
          Select an item to edit properties
        </div>
      </div>
    </div>
  );
}
