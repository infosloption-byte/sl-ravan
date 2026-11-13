
# SL Ravan — Forest-Village Realism Slice
Production blueprint v1 — 13 November 2026

## Goal
Create ONE polished, playable, original fantasy forest-village lane inspired by the user-provided screenshot. Match the quality in depth, atmosphere, foliage density, natural materials, and believable human/environment scale. Do not reproduce assets, exact level geometry, or characters from the source game.

This is an art and rendering milestone, NOT a map expansion, mission or Ravana narrative milestone.

## Reference-driven shot composition

- Foreground, left: large overlapping tropical ferns, detailed mossy boulders, grass and wildflowers, thick dark tree trunk.
- Foreground, right: leafy plants, large rocks, visually rich ground transition from earth to grass.
- Midground, left: larger timber structure tucked under mature canopy, overgrown railings, cloth and vegetation.
- Midground, right: staggered, detailed timber-and-stone storefronts and fabric awnings, woven baskets, posts and climbing vines.
- Center: curved, irregular, muddy-earth path as leading line toward a hazy light opening.
- Background: stacked silhouettes, dense canopies, roofs, warm sunshafts and distance fog. Avoid an empty flat horizon.
- Player: convincing silhouette, fabric surface detail and natural idle/walk/run/jump. Camera behind and slightly above player.

Style: painterly-natural, rich but not neon. Dark foliage against warm highlights. Ancient Lanka-inspired original architecture, not a direct copy of the reference.

## Slice boundaries

- Approximately 90m long by 55m wide, primarily a short 60–70m detailed path.
- Three zones: forest arrival; dense village-market lane; sunlit clearing.
- 4–6 architecturally varied facades; only TWO must be fully hero-quality initially.
- 1 authored hero tree, 3 other tree variants, 3 ferns/bush types, detailed ground/stone/wood/fabric materials.
- Main view from a fixed camera bookmark; add camera viewpoints to compare camera cuts, not only one flattering screenshot.
- Preserve existing controls, save/load, collisions, and optional GLB fallback.

## Mandatory Gate 0 — recover engine startup

The last visual/user result said GRAPHICS UNAVAILABLE; a broad Babylon import rollback is committed on draft PR #1 but no successful browser proof has been provided yet.

- Verify npm run typecheck / npm test / npm run build / npm run audit on PR #1.
- Verify playable browser scene loads; full tree canopies and GLB 2/2 visible, no renderer errors.
- Walk, run, jump, interact, toggle day/night; reload and restore save.
- Capture first console error if startup still fails.
- Record baseline FPS at fixed camera shot and GPU/browser/viewport details.

NO NEW graphics runtime modifications before Gate 0 passes.

## Production batches

### Batch A — real asset pipeline and one hero prop
- Author or acquire verified game-safe CC0/commissioned assets.
- First replacement: one detailed tropical hero tree GLB, high-quality bark/leaves material, correct pivot/scale/LOD.
- Asset preview scene must render alone with PBR material, normalized UVs, shadows, camera controls.
- Keep original procedural model as fallback. Do not claim cinematic quality based on source-generated primitive GLBs.

### Batch B — detailed village architecture and terrain
- Replace only two dominant cottages with modular authored roofs, wall planks, carved supports, awnings, windows, railing, cloth and baskets.
- Dirt path meshes + splat/vertex blend between dirt, grass, moss and stone, roughness/normal detail, decals for leaves and footprints.
- Add natural ground clutter in controlled clusters, not random uniform scatter.
- Distinct silhouettes and believable building scale; use simple independent collision proxies.

### Batch C — layered vegetation
- Different tree species and crowns, branch levels, leaf clusters/cards, exposed roots, hanging vines.
- Foreground ferns with good silhouettes, varied scale/rotation and sunlit tips.
- Midground grass, shrubs, white/pink flowers, small stones and groundcover.
- Instancing and LODs as needed; avoid spherical low-poly canopies visible in the main shot.

### Batch D — cinematic yet browser-safe lighting
- Babylon PBR materials with HDR environment/image-based illumination.
- Warm sun, cooler sky fill, soft contact shadows, controlled ambient occlusion, subtle bloom, tonemapping and haze.
- Test both shadows and night switch. Gate all new rendering features behind a quality setting and runtime smoke test.
- Do not blindly redo seven engine imports after previous startup regression.

### Batch E — player and motion
- An original Blender-authored rigged character GLB with Idle, Walk, Run, Jump and Land clips and appropriate clothing.
- Keep current articulated proxy as fallback until the new glTF importer and animation blending pass browser checks.

### Batch F — measurement and release
- Profile draw calls, GPU memory, render passes, shader compilation and 1%-low FPS.
- Use glTF optimization, compressed textures, LOD, reusable meshes, progressive loading and no unnecessary shadows.
- 1080p high/medium/low graphics settings; test Chromium/Firefox.
- Save known camera bookmark screenshots before and after every art batch.

## Initial targets (aspirational, must be verified)

| Metric | Medium desktop | Low graphics |
| --- | --- | --- |
| Median FPS at reference shot | >=55 at 1080p | >=30 |
| 1%-low FPS | >=35 | >=24 |
| Draw calls | <=300 | <=200 |
| Visible triangles | <=1M | <=500K |
| Initial compressed art assets | <=20 MiB | <=12 MiB |
| Entire compressed scene art | <=45 MiB | <=25 MiB |
| Texture size | Mostly 1K–2K, hero max 4K | Mostly 512–1K |

Performance budgets are not facts about current hardware. Adjust after real profiling.

## Visual acceptance scorecard

Score 1–5 by a human reviewing *the same camera framing*:
1. Rich natural ground and object materials: no flat/plastic surfaces.
2. Tropical foliage: believable species, density, shape variation and layering.
3. Architecture: plausible proportions, texture and handcrafted detail.
4. Cinematic composition: foreground framing, curved lane and depth.
5. Daylight/atmosphere: natural highlights, shadows, warm haze and readable darks.
6. Hero character: believable proportion, materials and motion.
7. Stability: no broken shaders, missing models, game crashes or save regressions.

Sign-off: art categories 1–6 each >=4/5, plus stable measured engineering gates. Not pixel-perfect copying.

## Delivery checkpoints
A0 = browser startup restored and baseline captured.
A1 = high-quality hero tree with PBR material integrated.
A2 = two authored cottages + path terrain pass.
A3 = layered ferns/groundcover + optimized vegetation.
A4 = HDR lighting, shadows, fog and restrained grade.
A5 = original rigged hero animation.
A6 = measured, tuned, signed-off playable slice.

## Assets and licensing

Poly Haven and ambientCG provide CC0 materials, HDRIs and/or models, subject to verifying the exact downloaded item's terms. Record URLs, creators, license evidence, version/hash and edits in the register. Source art and screenshots from commercial games are never to be ripped for use.

Source -> Blender/approved model -> validated glTF/GLB -> optimized texture/models -> manifest -> in-game preview -> scene with fallback -> profiling.

## GitHub integration

Planning is on a NEW stacked branch based on draft PR #1. Do not merge to main, and do not mark visual work as implemented until actual screenshots prove it.

## Art Lab integration checkpoint (implementation started)

The art-preview infrastructure is now present behind `/?artlab`, with a local GLB file picker and a game runtime hook for the optional `hero-tree.glb`. The source asset itself is **still pending**. Gate A cannot be marked complete until a real high-detail tree is acquired/produced, inspected, budgeted, and approved in the actual game. See `docs/HERO_TREE_IMPORT.md`.

## Gate 0 evidence — user verified on 13 Nov 2026

The user confirmed the engine successfully started in Chrome with GLB 2/2 and 56 FPS shown in a single captured viewport. The provided PowerShell output shows 18 Vitest tests, 2 GLB generator tests, 4 manifest tests, successful TypeScript and successful Vite production build. This clears the startup/blockout verification gate, but does **not** establish a stable 1080p median FPS or visual-quality approval. The screenshot still shows obvious low-poly placeholders. The next task is evaluating an external genuinely textured tree candidate, not adding map area.
