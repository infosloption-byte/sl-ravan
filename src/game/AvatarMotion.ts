/**
 * Deterministic, frame-rate-independent motion controller for the temporary
 * articulated player. Keeps locomotion rules independent of Babylon meshes.
 *
 * A production character GLB can reuse the same locomotion states and replace
 * these procedural joint poses with animation-group blending.
 */
export interface MotionState {
  speed: number;
  phase: number;
  airborne: number;
  elapsed: number;
}

export interface MotionInput {
  moving: boolean;
  sprinting: boolean;
  grounded: boolean;
}

export interface AvatarPose {
  leftLeg: number;
  rightLeg: number;
  leftArm: number;
  rightArm: number;
  bodyBob: number;
  forwardLean: number;
  headTurn: number;
  capeSwing: number;
}

export function createMotionState(): MotionState {
  return { speed: 0, phase: 0, airborne: 0, elapsed: 0 };
}

const clamp = (value: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, value));

/** Advance one animation step. All output angles are radians. */
export function stepAvatarMotion(
  state: MotionState,
  input: MotionInput,
  deltaSeconds: number
): AvatarPose {
  const dt = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.05);
  const targetSpeed = input.moving ? (input.sprinting ? 1.45 : 1) : 0;
  const blend = 1 - Math.exp(-9 * dt);
  state.speed += (targetSpeed - state.speed) * blend;
  state.airborne += ((!input.grounded ? 1 : 0) - state.airborne) * (1 - Math.exp(-14 * dt));
  state.elapsed += dt;
  const cadence = 8.1 * Math.max(.1, state.speed);
  if (state.speed > .04) state.phase += cadence * dt;
  if (state.phase > Math.PI * 2) state.phase %= Math.PI * 2;

  const gait = Math.sin(state.phase);
  const stride = clamp(state.speed / 1.45, 0, 1);
  const groundMotion = 1 - state.airborne;
  const legSwing = gait * .66 * stride * groundMotion;
  const armSwing = -gait * .46 * stride * groundMotion;
  const jumpTuck = state.airborne * .29;
  const breathing = Math.sin(state.elapsed * 1.7) * .007;

  return {
    leftLeg: legSwing - jumpTuck,
    rightLeg: -legSwing - jumpTuck,
    leftArm: armSwing - state.airborne * .22,
    rightArm: -armSwing - state.airborne * .22,
    bodyBob: breathing + Math.abs(gait) * .035 * stride * groundMotion,
    forwardLean: .045 * stride + (input.sprinting ? .06 * stride : 0) - state.airborne * .075,
    headTurn: Math.sin(state.elapsed * .62) * .025 * (1 - stride),
    capeSwing: Math.sin(state.phase + .6) * .1 * stride + state.airborne * .16,
  };
}
