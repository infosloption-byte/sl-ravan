# Forest Village — source art location

No high-fidelity assets have been imported yet. The scene manifest in content/visual-slice/forest-village.json describes requirements. Add only original or licensed optimized glTF/GLB, PBR textures and HDRI files, with a license register entry. The existing procedural scene remains the fallback. No commercial screenshot textures or ripped game models.

### Current integration

`/?artlab` isolates the GLB viewer from the game, and the game optionally loads `/assets/visual-slice/vegetation/hero-tree.glb`. The expected output can be created with `npm run art:install-tree -- --file=<your-model.glb> --source=<https-url> --author=<creator> --license=CC0-1.0` after verifying asset rights. The GLB binary is intentionally ignored by Git. See `docs/HERO_TREE_IMPORT.md`. No real hero model is bundled yet.
