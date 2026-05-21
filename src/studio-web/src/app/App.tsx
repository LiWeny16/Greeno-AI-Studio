import { Play, Square } from "lucide-react";
import { sampleMusicIr } from "@cc-music/music-ir";
import { barRangeLength } from "@cc-music/timeline-engine";
import { testIds } from "../testids";

export function App() {
  const section = sampleMusicIr.sections[0];
  const bars = section ? barRangeLength(section.barRange) : 0;

  return (
    <main className="app-shell" data-testid={testIds.appShell}>
      <header className="topbar">
        <div>
          <div className="eyebrow">CC Music</div>
          <h1>{sampleMusicIr.title}</h1>
        </div>
        <div className="transport" data-testid={testIds.transport}>
          <button aria-label="Play">
            <Play size={16} />
          </button>
          <button aria-label="Stop">
            <Square size={16} />
          </button>
          <span>{sampleMusicIr.tempo} BPM</span>
          <span>{sampleMusicIr.key}</span>
        </div>
      </header>

      <section className="workbench">
        <aside className="rail">
          <span>Motifs</span>
          <strong>{sampleMusicIr.motifs.length}</strong>
          <span>Tracks</span>
          <strong>{sampleMusicIr.tracks.length}</strong>
        </aside>

        <section className="editor">
          <div className="timeline-surface" data-testid={testIds.timelineCanvas}>
            <div className="timeline-grid">
              {Array.from({ length: bars }, (_, index) => (
                <div className="bar-cell" key={index}>
                  {index + 1}
                </div>
              ))}
            </div>
            <div className="section-block">{section?.name ?? "Section"}</div>
          </div>

          <div className="piano-roll-surface" data-testid={testIds.pianoRollCanvas}>
            {sampleMusicIr.motifs[0]?.notes.map((note, index) => (
              <div className="note" key={`${note.pitch}-${index}`}>
                {note.pitch}
              </div>
            ))}
          </div>
        </section>

        <aside className="inspector" data-testid={testIds.inspector}>
          <h2>Selection</h2>
          <p>Bars {section?.barRange.join("-")}</p>
          <p>{section?.style.genre}</p>
        </aside>
      </section>

      <section className="agent-panel" data-testid={testIds.agentPanel}>
        <span>Mock agent ready</span>
        <button>Preview Patch</button>
      </section>
    </main>
  );
}
