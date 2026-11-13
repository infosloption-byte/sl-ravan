# SL Ravan

**Browser-based third-person 3D open-world exploration prototype.** The long-term game will draw on the Ravana story, but this initial release deliberately contains no storyline, combat, or missions.

![Status](https://img.shields.io/badge/status-first%20playable%20prototype-58775b)

## First environment

The Ancient Forest leads into the **Lanka Forest Settlement** and onwards to the **Royal Sanctuary**, where an ancient shrine can be discovered. A Ravana-inspired fantasy gateway, carved pavilions, lotus pools, inlaid stone path and tropical fern patches establish the art direction. The visual direction is a colorful, atmospheric forest village with dense canopy, organic paths, mossy timber cottages, warm lanterns, and soft fog.

All first-stage world geometry and wood textures are procedurally generated. No third-party character models, textures, or paid assets are required.

> This is an early exploration prototype, not a photorealistic recreation of the supplied reference. High-detail vegetation, character animation, buildings, lighting, and cinematic art will be developed through an asset-production pipeline later.

## Start locally (Windows PowerShell)

Requirements: Node.js 22+ and a modern browser with WebGL 2 support.

~~~powershell
git clone https://github.com/infosloption-byte/sl-ravan.git
cd sl-ravan
git switch feature/first-playable-forest-village-20261113
npm install
npm run dev
~~~

Open http://localhost:5186

For existing clones: git fetch origin && git switch feature/first-playable-forest-village-20261113 && git pull --ff-only.

## Controls

| Action | Key |
| --- | --- |
| Move | W A S D or arrow keys |
| Sprint | Hold Shift |
| Jump | Space |
| Interact | E (near a sign or shrine) |
| Camera | Click and drag to orbit, mouse wheel to zoom |
| Pause | Esc |
| Day / night | HUD button |

Game progress is saved locally in browser storage, including character position, time-of-day setting, and shrine discovery.

## Commands

~~~bash
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
~~~

## Architectural boundaries

- React owns menus, overlays, and the HUD.
- Babylon.js owns rendering, camera, meshes, and animation.
- World.ts owns the map, interactions, and terrain query.
- Player.ts provides an interchangeable procedural avatar.
- RavanGame.ts owns the local game loop, controls, and integration.
- LocalSession.ts owns the versioned save format and storage adapter.

The eventual multiplayer implementation will introduce a shared domain simulation and remote authoritative session. The first demo does **not** pretend to have a multiplayer server or production-grade anti-cheat.

## Current scope / limitations

- Desktop keyboard and mouse first; no touch controls yet.
- Kinematic character movement and simple house colliders; Havok physics is not integrated yet.
- Generated prototype geometry rather than authored, optimized GLB assets.
- Forest environment is bounded, not infinite world streaming.
- Theme architecture is an original fantasy interpretation, not a claim of historical reconstruction.
- No account system, backend, combat, quests, or multiplayer yet.
- No sound files or audio system yet.
- Save data is only in the current browser and is not synchronized.

See docs/ROADMAP.md for the staged plan and quality acceptance checklist.

## Milestone 2 foliage and bundle fixes

- Tree canopy, bushes and ferns use `packInstanceMatrices()` to correctly pack 16 floating-point values per Babylon thin instance. This resolves disappearing foliage caused by `flatMap()` on typed arrays.
- Tree trunks are now also rendered in two instanced batches rather than many individual meshes. Actual GPU performance must be measured on a local machine.
- The React launcher dynamically imports the Babylon game module. This splits the large game module away from the initial UI bundle; it does not reduce the total engine download.
- Vitest is upgraded to 5.1.0 to address audited vulnerabilities in older mocker/tinypool dependencies. Node.js 22.12 or later is required. Reinstall, rerun `npm audit` and check tests after the major-version change.
