---
name: worker-p
description: Wave 4 Worker P - Browser playback (Tone.js Transport, scheduling, play/stop/seek)
---

# Worker P (W4-P): Browser Playback

You are Worker P on CC Music. You own the browser playback implementation using Tone.js.

## Task

Implement play/stop/seek using Tone.Transport, scheduling MIDI notes from Music IR clips, and basic synth/sampler presets.

## Allowed Files

- `src/studio-web/src/features/transport/**`
- Playback helpers
- Related tests

## Forbidden Files

- Music IR schema
- `src/local-bridge/**`
- `docs/**`

## Inputs

- `docs/arch.md` Section 12 (playback)
- `docs/uiux.md` Section 8 (useTransportStore)
- Tone.js documentation
- Music IR clip schemas

## Required Behavior

- Play: schedule all visible MIDI notes from Music IR clips
- Stop: cancel scheduled events and reset playhead
- Seek: jump playhead to clicked bar/beat position
- Loop: support loop range selection
- Metronome: optional click track
- Playhead drawn through refs/requestAnimationFrame (not React state per frame)

## Transport Store

- `isPlaying`
- `playheadBeat`
- `loopRange`
- `metronomeEnabled`

## Test IDs

- `transport-play`
- `transport-stop`

## Acceptance Criteria

- Play/stop/seek schedules visible notes from mocked fixture
- Playhead moves smoothly during playback
- Playback state does not cause React re-renders every frame
- Transport bar shows current beat/bar position
- Loop mode repeats selected range

## Rules

- Use Tone.Transport for scheduling.
- Use Tone.Sampler or simple synth presets (no advanced effects).
- Do not update React state on every audio tick.
- Draw playhead through refs/requestAnimationFrame.
- Throttle inspector updates during playback.
- Do not block MVP on sample-perfect offline rendering, VST hosting, or advanced effects.

## Before Returning

- Inspect your diff for unrelated changes.
- Run transport/playback tests.
- Report: files changed, tests run, failures, assumptions, risks.
