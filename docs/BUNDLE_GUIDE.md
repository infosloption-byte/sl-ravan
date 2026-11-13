# SL Ravan — Babylon Bundle Size Optimization

## Measured baseline (user's latest verified build)

The Vite 6 production build before this milestone reported:

- React launcher: \`index-*.js\`, **230.64 kB minified**.
- Babylon runtime: \`RavanGame-*.js\`, **6,038.72 kB minified** (1,324.76 kB gzip).
- Separately loaded glTF module: \`2.0-*.js\`, approximately **258.94 kB minified**.
- Vite's 500 kB chunk warning was informational, not a build failure.

The 6 MB runtime is not the full asset download: model GLBs, textures, fonts and additional chunks are separate.

## Changes made

All seven Babylon-dependent runtime modules moved from the broad \`@babylonjs/core\` barrel to **narrow ES6 module paths**.

Babylon documents the deep-import style as more tree-shakeable than the package-wide entry point. It also documents a newer \`@babylonjs/core/pure\` barrel, but the prototype stays with compatible deep imports so the currently installed 8.x code doesn't need a major migration or explicit extension registration.

The exact impact is **unmeasured until the next local production build**. The asset loader is still an asynchronously imported module. The UI already loads separately.

## Measure before and after

Run \`npm run build\`, then \`npm run bundle:report\`. This reports the eight largest emitted JavaScript assets, their raw size, their gzip size and the total emitted JavaScript size. It does not incorrectly claim that all chunks download on initial page load.

Record the difference from the 6,038.72 kB game-chunk baseline.

## Runtime regression checks

Deep imports can affect optional engine extension registration. Verify the following in the actual browser rather than relying on a green TypeScript/build result alone:

- Initial scene, sunlight, terrain color detail and shadows
- Thin-instanced trunks, leaf canopies, bushes, rocks and fern patches
- Interactions and the glow layer
- Dynamic textures, player movement/camera and save/load
- GLB 2/2 status once both optional models load
- Day/night switch and scene teardown/relaunch
- Console has no missing shader, texture or importer errors

If anything breaks, revert the deep-import commit while preserving the player animation work. Do **not** hide errors by increasing Vite's warning threshold.

## Startup regression and safety rollback — 13 November 2026

The user's screenshot showed **"Unable to start the 3D engine / Graphics unavailable"** after the experimental change to deep Babylon imports. The exact browser stack trace was not available, so missing Babylon side-effect registration is the **leading hypothesis**, not a confirmed root cause.

To restore the last known working renderer configuration, commit `30e54be` reinstates the original broad `@babylonjs/core` imports in seven runtime files, preserving the new articulated player and asynchronous GLB loader. Commit `01a5370` exposes caught startup errors and full console logging. This rollback may return the runtime chunk to roughly the old 6 MB baseline. A larger but working build is preferable to the broken optimized build.

**Do not reintroduce deep imports as one large batch.** First establish a passing browser startup smoke test, then switch one module at a time, explicitly register required engine extensions/shaders and check runtime results. Babylon documentation: https://doc.babylonjs.com/setup/frameworkPackages/npmSupport/ and https://doc.babylonjs.com/setup/frameworkPackages/es6Support/treeShaking/troubleshooting/

**Local validation requirement:** `npm run typecheck`, `npm test`, `npm run build`, then open the scene and confirm trees, ground, GLB load status, interactions, day/night lighting, and console. No automated browser validation of this repair has yet succeeded.
