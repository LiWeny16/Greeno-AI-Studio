import { testIds } from "../../testids";

export function Timeline() {
  return (
    <div
      data-testid={testIds.timelineCanvas}
      className="flex flex-1 items-center justify-center bg-black/20"
    >
      <div className="text-center text-muted">
        <div className="text-compact font-medium">Timeline</div>
        <div className="text-compact text-muted-foreground">
          Section and bar selection canvas
        </div>
      </div>
    </div>
  );
}
