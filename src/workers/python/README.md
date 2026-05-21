# Python Workers

Python workers are post-MVP adapters behind typed job contracts.

Initial candidates:

- Basic Pitch audio-to-MIDI.
- FluidSynth/ffmpeg render.
- Image-to-music-brief.
- ACE-Step audio generation.
- Demucs stem separation.

Default tests must use mock TypeScript workers and must not require Python, GPU, ffmpeg, or model downloads.
