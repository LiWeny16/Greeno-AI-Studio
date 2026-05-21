import { testIds } from "../../testids";

export function PianoRoll() {
  return (
    <div
      data-testid={testIds.pianoRollCanvas}
      className="flex flex-1 items-center justify-center bg-black/20"
    >
      <div className="text-center text-muted">
        <div className="text-compact font-medium">Piano Roll</div>
        <div className="text-compact text-muted-foreground">
          Note editing and motif editing canvas
        </div>
      </div>
    </div>
  );
}
