import { describe, expect, it } from "vitest";
import { createMotionState, stepAvatarMotion } from "./AvatarMotion";

describe("articulated player locomotion", () => {
  it("returns a stable, low-motion idle pose", () => {
    const state = createMotionState();
    let pose = stepAvatarMotion(state, { moving: false, sprinting: false, grounded: true }, 1/60);
    for (let n=0;n<120;n++) pose=stepAvatarMotion(state, { moving: false, sprinting: false, grounded: true }, 1/60);
    expect(state.speed).toBe(0);
    expect(Math.abs(pose.leftLeg)).toBeLessThan(.01);
    expect(Math.abs(pose.rightArm)).toBeLessThan(.01);
    expect(Math.abs(pose.bodyBob)).toBeLessThan(.01);
  });

  it("transitions smoothly from walking to running and back to idle", () => {
    const state=createMotionState();
    for(let n=0;n<60;n++)stepAvatarMotion(state,{moving:true,sprinting:false,grounded:true},1/60);
    const walk=state.speed;
    for(let n=0;n<60;n++)stepAvatarMotion(state,{moving:true,sprinting:true,grounded:true},1/60);
    expect(state.speed).toBeGreaterThan(walk);
    expect(state.speed).toBeLessThanOrEqual(1.45);
    for(let n=0;n<120;n++)stepAvatarMotion(state,{moving:false,sprinting:false,grounded:true},1/60);
    expect(state.speed).toBeLessThan(.001);
  });

  it("uses a separate jump pose without moving the game position", () => {
    const state=createMotionState();
    for(let n=0;n<40;n++)stepAvatarMotion(state,{moving:true,sprinting:false,grounded:true},1/60);
    const onGround=stepAvatarMotion(state,{moving:true,sprinting:false,grounded:true},1/60);
    for(let n=0;n<30;n++)stepAvatarMotion(state,{moving:true,sprinting:false,grounded:false},1/60);
    const inAir=stepAvatarMotion(state,{moving:true,sprinting:false,grounded:false},1/60);
    expect(Math.abs(inAir.leftArm-onGround.leftArm)).toBeGreaterThan(.05);
    expect(state.airborne).toBeGreaterThan(.9);
    for(let n=0;n<50;n++)stepAvatarMotion(state,{moving:true,sprinting:false,grounded:true},1/60);
    expect(state.airborne).toBeLessThan(.01);
  });

  it("is bounded when the browser drops a frame", () => {
    const state=createMotionState();
    const pose=stepAvatarMotion(state,{moving:true,sprinting:true,grounded:false},100);
    expect(Object.values(pose).every(Number.isFinite)).toBe(true);
    expect(state.elapsed).toBeLessThanOrEqual(.05);
    expect(Number.isFinite(state.phase)).toBe(true);
  });

  it("has similar transition speed at 30 and 60 FPS", () => {
    const fast=createMotionState();
    const slow=createMotionState();
    for(let n=0;n<60;n++)stepAvatarMotion(fast,{moving:true,sprinting:false,grounded:true},1/60);
    for(let n=0;n<30;n++)stepAvatarMotion(slow,{moving:true,sprinting:false,grounded:true},1/30);
    expect(Math.abs(fast.speed-slow.speed)).toBeLessThan(.0001);
  });
});
