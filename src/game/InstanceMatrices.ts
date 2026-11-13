import type { Matrix } from "@babylonjs/core";

/** Babylon thin instances require tightly packed 16-float matrices.
 * Do not use Array.flatMap(matrix => matrix.asArray()): Matrix.asArray()
 * returns a typed array, which flatMap does not flatten.
 */
export function packInstanceMatrices(matrices: readonly Matrix[]): Float32Array {
  const packed = new Float32Array(matrices.length * 16);
  for (let i = 0; i < matrices.length; i++) {
    matrices[i].copyToArray(packed, i * 16);
  }
  return packed;
}
