# SL Ravan — Character Animation Milestone

## Current stage

The original hero had a rigid body with basic limb oscillation. This milestone replaces it with an original, more expressive **articulated visual proxy** representing a traveler in a fantasy interpretation of ancient Lanka. The proxy has independently movable arms, legs, head and cape, richer textile/metal decoration and an optional jump pose.

This is **not** a skinned Blender-exported GLB character, and is not equivalent to motion-capture animation. We deliberately keep the game rules separate from the artwork, so a future skinned hero model can use the same locomotion state.

## Motion architecture

\`src/game/AvatarMotion.ts\` is engine-independent TypeScript. Its inputs are movement intent (moving / sprinting), whether the player is grounded, and elapsed time in seconds. The \`stepAvatarMotion\` function emits joint angles and body offsets.

\`src/game/Player.ts\` owns Babylon visual meshes and applies that pose to articulated nodes. \`src/game/RavanGame.ts\` supplies movement state once per simulation update.

Animation poses do **not** change the authoritative world position, save state or collisions. The game controller still owns those systems.

## Animation acceptance checks

1. At rest the avatar has subtle breathing, not an exaggerated walk swing.
2. Walk begins smoothly; holding Shift transitions into faster sprint swings.
3. Releasing WASD returns smoothly to idle.
4. Jump produces an arm/leg tuck before settling back into locomotion.
5. Mouse orbit and camera following work normally.
6. Collisions, object interaction, shrine progress and local saves are unaffected.
7. No thrown errors during scene teardown or repeated launch.

The five animation unit tests cover bounded values, transitions, jump behavior, idle behavior and time-step independence. The visuals still require inspection in a browser.

## Next step: rigged GLB hero

1. Create an original rigged human mesh in Blender. Export one glTF 2.0/GLB with skin weights, compatible joint hierarchy and animation clips: \`Idle\`, \`Walk\`, \`Run\`, \`Jump\`, \`Land\`.
2. Import with the already established \`@babylonjs/loaders\` pipeline. Keep the proxy fallback until GLB asset loads are verified.
3. Use Babylon animation groups and crossfade weights mapped from \`AvatarMotion\` state, without changing local movement rules.
4. Test correct facing, pivots, feet on ground, texture color spaces, shadows, animation state transitions, frame time and download size.
5. Credit any external reference or motion assets and verify redistribution rights. Avoid using commercial game assets without licenses.

## Browser performance

Additional hero polygons and materials may increase GPU cost. Profile alongside the existing 48 FPS reference screenshot; do not assume this milestone improves FPS.
