import { useTransportStore } from "../../stores/useTransportStore";
import { sampleMusicIr } from "@cc-music/music-ir";
import { IconButton } from "../../components/ui/icon-button";
import { Separator } from "../../components/ui/separator";
import { Play, Square, SkipBack, SkipForward } from "lucide-react";
import { testIds } from "../../testids";

export function Transport() {
  const isPlaying = useTransportStore((s) => s.isPlaying);
  const playheadBeat = useTransportStore((s) => s.playheadBeat);
  const metronomeEnabled = useTransportStore((s) => s.metronomeEnabled);
  const tempo = useTransportStore((s) => s.tempo);
  const keyName = useTransportStore((s) => s.key);
  const timeSignature = useTransportStore((s) => s.timeSignature);
  const togglePlay = useTransportStore((s) => s.togglePlay);
  const stop = useTransportStore((s) => s.stop);
  const setMetronomeEnabled = useTransportStore(
    (s) => s.setMetronomeEnabled,
  );

  const handleTogglePlay = () => togglePlay(sampleMusicIr);
  const handleStop = () => stop();

  return (
    <div data-testid={testIds.transport} className="flex items-center gap-1">
      <IconButton
        label="Skip to start"
        tooltip="Skip to start"
        size="sm"
        variant="ghost"
      >
        <SkipBack className="h-4 w-4" />
      </IconButton>

      <IconButton
        data-testid={testIds.transportPlay}
        label={isPlaying ? "Pause" : "Play"}
        tooltip={isPlaying ? "Pause" : "Play"}
        size="sm"
        variant="ghost"
        onClick={handleTogglePlay}
      >
        <Play className="h-4 w-4" />
      </IconButton>

      <IconButton
        data-testid={testIds.transportStop}
        label="Stop"
        tooltip="Stop"
        size="sm"
        variant="ghost"
        onClick={handleStop}
      >
        <Square className="h-4 w-4" />
      </IconButton>

      <IconButton
        label="Skip to end"
        tooltip="Skip to end"
        size="sm"
        variant="ghost"
      >
        <SkipForward className="h-4 w-4" />
      </IconButton>

      <Separator orientation="vertical" className="mx-2 h-5" />

      <span className="text-editor-value text-foreground tabular-nums">
        {tempo} BPM
      </span>

      <Separator orientation="vertical" className="mx-2 h-5" />

      <span className="text-compact text-muted">
        {keyName}
      </span>

      <span className="text-muted-foreground text-compact ml-1">
        {timeSignature}
      </span>

      <Separator orientation="vertical" className="mx-2 h-5" />

      <span
        data-testid={testIds.transportPosition}
        className="text-editor-value text-foreground tabular-nums min-w-[5ch]"
      >
        {playheadBeat.toFixed(1)}
      </span>

      <Separator orientation="vertical" className="mx-2 h-5" />

      <button
        onClick={() => setMetronomeEnabled(!metronomeEnabled)}
        className={`rounded-control px-2 py-1 text-compact transition-colors ${
          metronomeEnabled
            ? "bg-accent/20 text-accent"
            : "text-muted hover:text-foreground"
        }`}
      >
        Metronome
      </button>
    </div>
  );
}
