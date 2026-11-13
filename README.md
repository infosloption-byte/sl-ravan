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

## Milestone 3 direction

The first graphics improvement after the restored tree canopy adds a subtle repeated ground microtexture and batches scattered rocks by material for fewer draw calls. The rest of the scene remains unchanged to keep the now-passing gameplay stable. For the actual high-fidelity Ravana-inspired environment, see [the authored-asset production plan](docs/ART_ASSETS.md).

## Milestone 4: First original GLB models

Running npm run dev or npm run build now regenerates two reproducible glTF 2.0 binary assets: public/assets/generated/heritage-tree.glb and stone-pavilion.glb. Their complete geometry source is scripts/generate-art.mjs, requiring no downloaded 3D model packs. Generated GLBs are git-ignored and rebuilt automatically.

The models are imported asynchronously through @babylonjs/loaders after the procedural world starts. If they fail to load, the existing playable environment remains. The rain tree appears near the starting trail and in the village; the authored stone pavilion appears beside the royal gateway.

Use npm run assets:generate to regenerate these original models and npm run test:art to validate their glTF headers/accessors. npm test runs existing gameplay tests plus new art tests. These models are higher-detail stylized source assets, not photorealistic AAA art.

For prototype verification, the FPS indicator also shows GLB 0/2 to 2/2. After the scene loads, GLB 2/2 confirms both original models are active; GLB 0/2 or 1/2 indicates missing assets or a loader error. Check the browser console for details. This development indicator is not intended for the final game UI.

## Test runners

The game uses two independent test suites. `npm run test:unit` runs Vitest only against source tests under `src/`, while `npm run test:art` runs the original GLB generator checks with Node's built-in `node:test` runner. Use `npm test` to run both sequentially. The scoped Vitest command prevents the Node-only `scripts/generate-art.test.mjs` file from being incorrectly reported as an empty Vitest suite.

## Milestone 5: Hero animation and bundle inspection

The player now uses an articulated original ancient Lanka fantasy visual proxy with smoother idle, walk, sprint and jump poses. **This is not yet a rigged GLB character.** Motion rules are isolated in `src/game/AvatarMotion.ts` and have five dedicated regression tests. See [character animation notes](docs/CHARACTER_ANIMATION.md).

The seven Babylon-dependent runtime modules now use ES6 deep imports instead of broad barrel imports. To measure the result, run `npm run build` then `npm run bundle:report`. See [bundle guide](docs/BUNDLE_GUIDE.md). Your previous game chunk was approximately 6,038.72 kB minified; the effect of the import change is not yet verified.

The optional GLB loader also checks whether the game has been disposed before attaching models and world blockers.

## Troubleshooting startup (13 November 2026)

A new blank/startup error appeared immediately after the experimental Babylon ES6 deep-import refactor. The branch has restored the former broad `@babylonjs/core` imports for compatibility with rendering, materials, shaders, mesh creation and glTF loading. This prioritizes working gameplay over bundle-size optimization. Do not reintroduce deep imports without browser smoke tests and required Babylon side-effect registrations.

The launcher now shows the actual caught error message, writes the full exception to the F12 developer console and offers a **Retry Graphics** control. Test the full scene, including GLB 2/2, after pulling and restarting Vite. If the error persists, copy the **first red console error and stack trace** rather than just sending the generic error overlay.

## Forest-village visual slice plan (Milestone 6)

We are shifting from basic procedural low-poly scenery to ONE art-directed, high-fidelity forest village lane. Start from the user's visual reference: detailed tropical foliage, richly textured wooden houses, an irregular winding earth road, a believable traveler, and atmospheric golden sun.

Planning details and quality gates: docs/FOREST_VILLAGE_VISUAL_SLICE.md.
Structured layout and asset inventory: content/visual-slice/forest-village.json.
Asset provenance requirements: docs/ASSET_LICENSE_REGISTER.md.

Before touching rendering code, confirm the current draft PR #1 branch starts in the browser without a graphics error. Then source/author and validate one excellent GLB hero tree; build the first polished lane only after that art benchmark is accepted.

Run npm run plan:validate to check scene-manifest consistency, and npm run test:plan to execute four Node-native manifest tests. npm test includes the plan checks alongside existing gameplay and GLB tests.

This commit is a plan and validation scaffold: it does NOT include new high-resolution assets or a realistic scene yet.

## Forest village — real asset integration (Gate A)

New: a standalone [Art Lab](?artlab) for orbiting and inspecting local or installed GLB assets without affecting gameplay. Use the browser route `/?artlab`. The main game loads an optional licensed hero-tree GLB from `public/assets/visual-slice/vegetation/hero-tree.glb` and safely falls back to procedural art if absent.

The installed hero-tree must pass structural/texture/triangle checks and have a source/rights record. See [docs/HERO_TREE_IMPORT.md](docs/HERO_TREE_IMPORT.md). `npm run test:asset-quality` adds four Node unit tests to the existing 24 baseline tests. The **realistic source asset has not been installed** by this commit; the current in-game graphics will look the same until a verified detailed model is imported.
