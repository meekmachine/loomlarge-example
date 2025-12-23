# Current Wiring – Initial Pass

Collected notes from inspecting the top-level boot, engine context, and GLB scene setup. This file will grow as we review more areas.

## Entry + Providers
- `src/main.tsx`: boots Chakra UI with a custom dark theme and wraps the app in `ThreeProvider`. No agency wiring here; it just mounts `App`.
- `src/context/engineContext.tsx`: thin alias to `useThreeState`; engine context == Three context.

## Three/Engine Context
- `src/context/threeContext.tsx`:
  - Instantiates a singleton `EngineThree` and `THREE.Clock`.
  - Creates `anim` via `createAnimationService(host)` and exposes it alongside `engine`, `clock`, and `addFrameListener`.
  - Host bindings map animation scheduler outputs to engine methods (`setAU`, `transitionAU`, morph setters, continuum helpers for eyes/head/jaw/tongue) and dispatch `visos:snippetEnd` events on completion.
  - Central frame loop: RAF-driven `tick` calls `anim.step(dt)` (scheduler), then notifies frame listeners, then advances `engine.update(dt)`.
  - Puts `window.facslib` and `window.anim` dev handles on the page for debugging.

## Scene Setup (GLB)
- `src/scenes/CharacterGLBScene.tsx`:
  - Builds a full Three.js pipeline (renderer, camera, controls, lights, optional skybox).
  - Loads GLB directly via `GLTFLoader` + `DRACOLoader` (no custom caching layer - browser cache handles this; future enhancement: service worker in index.html for offline/preload).
  - Uses refs for `onReady`/`onProgress` callbacks to prevent effect re-runs when callback identity changes.
  - Centers/scales the model, collects morph-target meshes, and calls `onReady` with `{ scene, renderer, model, meshes, animations, skyboxTexture }`.
  - Manages visibility (hidden until ready), resize handling, autorotate, and cleanup (RAF, listeners, renderer, Draco decoder).
  - No agency logic here—pure scene + asset load; agencies consume the `onReady` payload elsewhere.

## Immediate Gaps / Next Areas to Review
- How `onReady` is consumed to bind agencies to the loaded meshes (likely in `App`/scene wrappers).
- Agency wiring beyond animation: `transcription`, `conversation`, `tts`, `lipsync`, `prosodic`, `eyeHeadTracking`, `blink`, etc.
- Fiber/Babylon scene counterparts (`CharacterFiberScene.tsx`, engine abstraction) and how multiple engines are selected.
- Persona configuration and signal routing (UI components like `SliderDrawer`, AU sections).

These notes are meant to be an accurate reflection of the code observed so far; no assumptions beyond what’s in the files. As we review more modules, we’ll append precise findings here.
