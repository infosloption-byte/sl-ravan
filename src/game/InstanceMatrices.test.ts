import { describe, expect, it } from "vitest";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core";
import { packInstanceMatrices } from "./InstanceMatrices";

describe("instance matrix packing", () => {
  it("produces a contiguous finite buffer with correct positions", () => {
    const first = Matrix.Compose(new Vector3(2, 3, 4), Quaternion.Identity(), new Vector3(12, 7, -9));
    const second = Matrix.Compose(new Vector3(.7, 1.2, 2), Quaternion.Identity(), new Vector3(-4, 2, 31));
    const packed = packInstanceMatrices([first, second]);
    expect(packed).toBeInstanceOf(Float32Array);
    expect(packed).toHaveLength(32);
    expect(Array.from(packed).every(Number.isFinite)).toBe(true);
    expect(Array.from(packed.slice(12, 15))).toEqual([12, 7, -9]);
    expect(Array.from(packed.slice(28, 31))).toEqual([-4, 2, 31]);
  });

  it("handles an empty group without creating phantom instances", () => {
    expect(packInstanceMatrices([])).toHaveLength(0);
  });

  it("does not treat typed arrays as arrays of matrices", () => {
    const transform = Matrix.Identity();
    const packed = packInstanceMatrices([transform]);
    expect(packed).toHaveLength(16);
    expect(packed[0]).toBe(1);
    expect(packed[5]).toBe(1);
    expect(packed[10]).toBe(1);
    expect(packed[15]).toBe(1);
  });
});
