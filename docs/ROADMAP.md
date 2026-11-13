# SL Ravan — Prototype Roadmap

## Creative reference

The supplied screenshot establishes the target mood: rich fantasy foliage, sunlight through branches, a third-person character, a winding dirt path, densely detailed timber architecture, and a village with strong foreground/midground/background composition.

The reference is **inspiration, not a licensed asset**. All shipped models/textures must be made in-house or obtained with an appropriate game-distribution license.

## Milestone A — Playable environment demo (this branch)

- [x] Vite / React / TypeScript / Babylon.js setup
- [x] Third-person character and chase/orbit camera
- [x] Walk, sprint, jump and simple collisions
- [x] Procedural forest terrain and a winding path
- [x] Village houses, market stands, lanterns and scenery
- [x] Ancient shrine interaction, village signs and location HUD
- [x] Day/night lighting switch
- [x] Local browser save with schema validation and tests
- [ ] Validate browser performance and appearance on actual desktop hardware
- [x] Add ancient Lanka architectural theme as a separate module
- [x] Batch canopy and bushes using thin instancing for lower draw-call overhead
- [ ] Replace placeholder models with polished assets

## Milestone B — Visual polish and streaming foundation

1. Build a modular Sri Lankan ancient/fantasy architecture kit in Blender (woodwork, stone, reliefs, banners and roofs).
2. Create properly licensed, highly detailed plants, surface materials and a character GLB with walking/running animations.
3. Add art-directed sunlight, baked lighting where appropriate, fog, water, particles, and optimized shadows.
4. Create chunk manifests, streaming/unloading, model LOD, compressed textures, and instancing for reusable scenery.
5. Run GPU/CPU/draw-call profiling on target devices and set performance budgets.

## Milestone C — Game systems

- Separate engine-neutral simulation, input commands, authoritative state and renderer.
- Replace prototype kinematic collisions with Havok physics and a character-controller design.
- Inventory, interactive objects, NPC behavior, dialogue, audio, checkpoints, accessibility, and settings.
- Implement persistent profiles and versioned saves through a Node.js backend and MySQL.
- Add browser acceptance tests and save migration tests.

## Milestone D — Multiplayer proof of concept

- Put common simulation rules in a package that can run in Node.js.
- Add a Colyseus authoritative room and remote session adapter.
- Demonstrate two clients walking in the same test scene with interpolation.
- Validate movement server-side and prevent clients from arbitrarily editing player/world state.
- Add interest management and shared state persistence.

## Milestone E — Ravana story production

Story geography, characters, historical/fantastical interpretation, missions, and narration will be designed after the vertical slice is accepted.

## Acceptance tests for the current demo

1. A first-time visitor can launch the game with no external art asset download.
2. Walking from the starting path to the village and shrine is possible.
3. The player does not walk through cottage walls.
4. WASD, Shift, Space, camera drag/zoom, Esc and E behave as documented.
5. The shader and rendering pipeline survive browser refresh.
6. Interaction with the shrine updates the objective message.
7. The saved location and day/night state persist on refresh.
8. The browser console contains no uncaught errors.
9. The UI is usable at desktop resolutions and degrades gracefully at smaller windows.

## Proposed asset pipeline

Blender (.blend source) → validated glTF/GLB → texture compression / mesh optimization → hashed assets on a CDN → scene asset manifest. Avoid committing huge, unoptimized binaries to Git; use storage/CDN or Git LFS when justified.
