# SL Ravan — Graphics Pass (forest village visual slice)

Target look: lush, stylized third-person forest village (layered ferns, timber
houses with thatch roofs, soft golden light, haze and depth).

## What changed

- **Ground** (`TerrainPaint.ts`, `ProceduralTextures.ts`): one baked 2048² albedo painted from the same
  `pathCenter()` the gameplay uses, so the dirt trail always lines up with the world. Cart ruts, leaf litter,
  clover specks, moss and dry-grass patches, plus a tileable normal map for micro relief. Trail is slightly sunken.
- **Foliage** (`Foliage.ts`): alpha-tested leaf cards instead of solid blobs — arching fern clumps, crossed grass
  tufts, volumetric leaf-cluster crowns and wildflower patches, all thin-instanced.
- **Trees / houses** (`World.ts`): textured bark, shadow-casting canopy cores under leaf-card crowns, tree wall
  past the playable edge, outer low-poly ground to the horizon. Two-storey timber houses with plank walls, gabled
  thatch roofs, balconies, banners and lanterns, merged into one mesh each.
- **Atmosphere** (`Atmosphere.ts`): procedural sky (gradient, clouds, sun, stars), distant fogged ridges, sun
  shafts, pollen by day / fireflies by night, and a post stack (4× MSAA, bloom, ACES tone mapping, colour
  curves, vignette). Day/night blends smoothly.
- **Renderer** (`RavanGame.ts`): cascaded shadow maps (falls back to a single map on failure), sprint FOV,
  camera-over-terrain guard, adaptive resolution when FPS stays low.
- **Tests**: `Noise.test.ts`, `TerrainPaint.test.ts`, extra `World.test.ts` case.

All art is generated in code; nothing is copied from any game. `ForestSurface.ts` is no longer used by `World.ts`.

## Must be checked in a real browser (not verified by automated tests)

Run `npm run typecheck`, `npm test`, `npm run build`, then open the scene and confirm:

- Scene starts (no "Graphics unavailable"); console has no shader/texture errors.
- Ground shows the trail aligned with the 3D path; grass/fern cards are visible and not black or fully see-through.
- House gables and roofs are visible from outside; houses face the trail; collision matches the footprint.
- Sky, haze, shafts, bloom look right at day and night; pollen/fireflies visible.
- Shadows are stable while moving; FPS acceptable (adaptive scaling lowers resolution if not).
- Startup time: the ground bake is the main one-off CPU cost (~1–2 s).
- Save/load, day/night toggle, scene teardown and relaunch still work.

Tuning knobs: palettes in `Atmosphere.ts` (`DAY`/`NIGHT`), sun direction in `RavanGame.ts`,
instance counts in `World.ts`, bake resolution `createGroundAlbedo(..., size)`.
