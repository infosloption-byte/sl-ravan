# SL Ravan — Real 3D Asset Production Plan

## Current status

The latest screenshot confirms the procedural demo is working (43 FPS at the user's display resolution), with canopies restored and all eight tests passing. The **graphics are still a blockout**. The first milestone should not be judged against a finished cinematic adventure game.

## Art direction

The future aesthetic is a handcrafted fantasy interpretation of ancient Lanka, informed by the Ravana legend but **not yet tied to story canon**: humid ancient forest; huge layered tropical canopy; moss-covered stone temples; sculpted wooden and stone architecture; warm low-angle sun; dense grass and ferns; and a believable animated third-person character.

The reference image is **inspiration only**. Do not extract textures/models from it, and do not redistribute game assets from other commercial games.

## Required authored assets, ordered by visual impact

| Asset family | First target | Guidelines |
| --- | --- | --- |
| Character | 1 hero character GLB | Rigged, idle/walk/run/jump animations; cloth and hair details |
| Trees | 3–5 native-style species | Layered leaf cards, branching trunks, appropriate silhouette and leaf opacity masks |
| Ground | Grass/earth/stone texture set | PBR base color + roughness + normal; avoid obvious tiling |
| Buildings | 4 modular architecture pieces | Roof kit, stairs, carved pillars, stone walls; reusable glTF modules |
| Vegetation | 5–8 bush/fern/flower variants | Alpha cards or authored meshes, color variations, instancing |
| Props | 10 reusable scene props | Lanterns, crates, shrines, woven baskets, fabric, signs |

Use **Blender** for geometry and animation, and export individual .glb modules. Babylon supports glTF model import through its loader, which should be integrated after the first verified asset is produced.

## Source and licensing

- Maintain editable .blend source files in external production storage if large.
- Only import models and textures whose license permits use in a public/commercial game.
- Put licensing/attribution records adjacent to third-party source asset IDs.
- Do not commit ripped assets, copyrighted screenshots used as textures, or unlicensed models.

## Performance targets

- Primary target: stable 60 FPS desktop (currently about 43 FPS with prototype content).
- Measure draw calls, GPU frame time, CPU frame time, shader compilation, texture memory, and asset download sizes.
- Reuse materials; instance repeated scenery; provide LODs for trees/buildings; use compressed textures.
- Keep the initial browser download small; stream optional regions and artwork later.
- Avoid more geometry-only detail until the actual authored models are prepared.

## Rendering/bundle observations

- The lazy-loaded `RavanGame` JS chunk is still about **6 MB minified**, while the launcher is about **231 KB**. Splitting the runtime is not the same as reducing its total download.
- A future dedicated optimization task should switch from broad Babylon barrel imports toward narrower/pure imports and measure the resulting production output. Do not just raise Vite's warning threshold.
- The current quality pass adds a small repeated ground detail texture and batches scattered stones into two render groups.

## Next implementation milestone

Produce **one fully authored hero tree GLB** and **one authentic fantasy stone temple module** in Blender, import them with an explicit asset manifest and fallback behavior, and compare visual quality/FPS against the procedural baseline. Then replace other procedural assets progressively.

## First reproducible original GLB asset pipeline

The repository now contains scripts/generate-art.mjs, a Node-only original asset authoring script that writes genuine binary glTF 2.0 models with indexed triangles, normal vectors and PBR material properties. The generated hero tree and stone pavilion can be inspected in Blender or glTF viewers. They contain no third-party game assets. src/game/GameArtAssets.ts imports them asynchronously and preserves the procedural scene if loading fails. As higher-detail Blender exports become available, they can replace these generated models without rewriting the movement or UI systems.
