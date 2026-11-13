# First high-detail GLB: Hero Tree Integration

## Current implementation

The **Art Lab** at http://127.0.0.1:5186/?artlab is an isolated Babylon.js preview scene. It compares the existing generated tree with a self-contained, higher-fidelity GLB selected on disk. It does not modify game saves or missions.

The main game now tries one optional file:
public/assets/visual-slice/vegetation/hero-tree.glb

If present and loadable, that tree appears near the forest entry at approximately (-22, -30), and the generated tree is kept further down the lane. If missing or invalid, the original tree stays at both locations. This is a **safe integration hook**, not a claim that high-quality art has been installed.

## Recommended CC0 source for the FIRST artist-approved tree

A concrete source to evaluate is the [Poly Haven Jacaranda Tree](https://polyhaven.com/a/jacaranda_tree) by Rico Cilliers (with guidance from Rob Tuytel). Its model page lists 312K triangles, tree bark and leaf maps, LODs and a CC0 license. It is a candidate, not yet downloaded, decimated or approved for SL Ravan. Large source assets must not be blindly copied into the browser app.

Download a 1K glTF or Blender version from the official site, **inspect the full source**, and in Blender:
1. Choose an appropriate LOD and remove unnecessary high-resolution subdivisions.
2. Keep leaf alpha/textures, correct normals, single rooted hierarchy and a grounded pivot.
3. Prefer a self-contained GLB with baked/albedo, normal, metallic-roughness and opacity maps.
4. Export glTF 2.0 in GLB format with textures included.
5. Test model appearance in the Art Lab before integrating.
6. Target <=600K triangles, <=80MiB as initial import guards; for final use aim much smaller and tune after profiling.
7. Capture the source URL, creator and license record. Poly Haven assets are CC0; keep provenance even when attribution is optional.

Other candidate: [Island Tree 02](https://polyhaven.com/a/island_tree_02) for its sculptural twisted trunk. Verify its polygon count and size before use.

### Local installation

Replace the path below with the actual exported GLB path:

~~~powershell
npm run art:install-tree -- --file="C:\Users\YourUser\Downloads\hero-tree.glb" --source="https://polyhaven.com/a/jacaranda_tree" --author="Rico Cilliers" --license="CC0-1.0"
~~~

The installer checks the binary GLB header and primitive count, applies size/triangle/embedded-texture guards, records SHA-256, and writes a provenance receipt next to the copied model. It does **not** automatically mark the asset approved in the scene manifest.

The output GLB is ignored by Git pending a documented asset distribution strategy. Production assets should be shipped via an optimized, versioned asset bundle or CDN once art and redistribution rights have been reviewed.

### Browser preview

~~~powershell
npm run dev
~~~

Visit http://127.0.0.1:5186/?artlab, choose **Imported high-detail hero tree**, orbit and zoom around the model, and assess materials and proportions. The viewer also accepts a local GLB through its file picker without installing it.

If the model looks good, return to the game at http://127.0.0.1:5186/ and check the entrance area. Confirm shadows, movement and 1080p FPS remain acceptable, and inspect the browser console for the informational "Verified local high-detail tree imported" message.

## Criteria for Gate A approval

- [ ] Detailed leaves and branches look organic at normal camera distance, not spherical low-poly foliage.
- [ ] Bark, leaves and opacity are textured correctly and not excessively shiny.
- [ ] Correct vertical scale, anchored at the ground with no floating root.
- [ ] Alpha edges / double-sided foliage / shadows look correct from several angles.
- [ ] Draw calls, triangles and FPS are measured; no serious stutter.
- [ ] Original source and license provenance recorded.
- [ ] Captured in-game screenshot compared with the original user reference.
- [ ] Gameplay, 24 baseline tests and additional asset tests pass.

**Do not call Gate A complete on the basis of a successful GLB import alone.**

## Optional direct Poly Haven candidate download

You can preview the real Jacaranda glTF source without first converting it to GLB:

~~~powershell
npm run art:fetch-candidate
npm run dev
~~~

Open http://127.0.0.1:5186/?artlab and choose **Poly Haven Jacaranda candidate**.

The downloader uses the public Poly Haven files API for jacaranda_tree, chooses the 1K glTF variant and downloads its referenced textures and binary dependencies. It verifies declared file sizes, supplied MD5 hashes, safe relative paths and allowed Poly Haven source hosts. The candidate lives in public/assets/visual-slice/candidates/jacaranda and is ignored by Git.

**Important:** The actual remote API response/download has not been tested in this assistant environment. If a file variant is unavailable or is too large for the 90 MiB guard, the command fails with an error rather than silently replacing it with placeholder artwork. The model is still candidate-only and does not automatically appear in the game.

After visual review, export a smaller self-contained GLB from Blender and install it with npm run art:install-tree. If it exceeds the 600K triangle guard, decimate or use an appropriate LOD. Record the source, final asset hash and performance before changing its manifest status.
