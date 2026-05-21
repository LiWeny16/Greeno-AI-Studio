# Reference Projects

These repositories are shallow clones for engineering reference only. They are not vendored dependencies and should not be copied into production code without explicit license review.

## Cloned Projects

| Folder | Project | Why It Is Here | License Notes |
|---|---|---|---|
| `tonejs-tonejs` | https://github.com/Tonejs/Tone.js | WebAudio transport, scheduling, synth/effect architecture | MIT |
| `tonejs-midi` | https://github.com/Tonejs/Midi | MIDI parsing/export patterns | MIT |
| `wavesurfer-js` | https://github.com/katspaugh/wavesurfer.js | Waveform rendering, regions, timeline/minimap plugins | BSD-3-Clause |
| `konva` | https://github.com/konvajs/konva | Canvas scene graph and interaction patterns | MIT |
| `radix-primitives` | https://github.com/radix-ui/primitives | Accessible primitive behavior patterns | MIT |
| `shadcn-ui` | https://github.com/shadcn-ui/ui | Local component ownership and Tailwind/Radix composition style | MIT |
| `lucide` | https://github.com/lucide-icons/lucide | Icon language and React icon package reference | ISC / MIT for noted icons |
| `zustand` | https://github.com/pmndrs/zustand | Small-store state management patterns | MIT |
| `fastify` | https://github.com/fastify/fastify | High-performance Node HTTP server architecture | MIT |
| `basic-pitch` | https://github.com/spotify/basic-pitch | Future audio-to-MIDI motif adapter | Apache-2.0 |
| `waveform-playlist` | https://github.com/naomiaro/waveform-playlist | Multitrack WebAudio editor reference | MIT |
| `ace-step-ui` | https://github.com/fspecii/ace-step-ui | Local AI music UI reference around ACE-Step | MIT |
| `ace-step-1.5` | https://github.com/ace-step/ACE-Step-1.5 | Future local audio generation adapter reference | MIT per repo; review model/provenance before release |

## Watchlist, Not Yet Cloned

| Project | Link | Why Track It | License Notes |
|---|---|---|---|
| Producer Pal | https://producer-pal.org/ | Agent-controlled Ableton MCP/REST/Skill UX reference | GPL-3.0; study only unless license impact accepted |
| DAWproject | https://github.com/bitwig/dawproject | Post-MVP structured DAW interchange export | MIT |
| MusPy | https://github.com/salu133445/muspy | Python symbolic-music research/evaluation toolkit | MIT; dataset licenses remain separate |
| Text2midi | https://github.com/AMAAI-Lab/Text2midi | Future text-to-MIDI worker candidate | MIT code; review model/license before use |
| MIDI-LLM | https://github.com/slSeanWU/MIDI-LLM | Future optional LLM-to-MIDI adapter candidate | Do not bundle Llama-family weights into default core |
| Web Audio Modules | https://www.webaudiomodules.com/docs/intro/ | Future browser plugin architecture reference | Not MVP |
| claw-daw | https://www.clawdaw.com/ | Deterministic scriptable agent music workflow reference | Review before reuse |

## Use Rules

- Read these projects for architecture, APIs, and UX patterns.
- Prefer installing upstream packages from npm/PyPI instead of copying source.
- Do not copy GPL/AGPL code from other projects into this repo.
- If code is copied from any reference project, record source path, license, commit hash, and rationale in the PR.
- Keep CC Music's core implementation in `apps/` and `packages/`, not inside `docs/reference-projects`.

## Update Rule

Reference projects are shallow clones. To refresh one:

```text
cd docs/reference-projects/<folder>
git pull --ff-only
```
