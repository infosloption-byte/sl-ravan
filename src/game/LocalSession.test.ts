import { describe, expect, it } from "vitest";
import { LocalSession, validateSave } from "./LocalSession";

describe("local save validation", () => {
  it("rejects incompatible versions and malformed coordinates", () => {
    expect(validateSave({ version: 2, position: { x: 0, y: 0, z: 0 } })).toBeNull();
    expect(validateSave({ version: 1, position: { x: Infinity, y: 0, z: 0 } })).toBeNull();
    expect(validateSave({ version: 1, position: { x: 1, y: 0, z: "nope" } })).toBeNull();
  });

  it("persists and restores valid player progress", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    const session = new LocalSession(storage);
    expect(session.load()).toBeNull();
    expect(session.save({ version: 1, position: { x: 5, y: 1, z: 15 }, night: true, discoveredShrine: false })).toBe(true);
    expect(session.load()?.position).toEqual({ x: 5, y: 1, z: 15 });
    expect(session.load()?.night).toBe(true);
  });

  it("handles blocked browser storage without crashing", () => {
    const broken = { getItem: (): string => { throw Error("blocked"); }, setItem: (): void => { throw Error("blocked"); } };
    const session = new LocalSession(broken);
    expect(session.load()).toBeNull();
    expect(session.save({ version: 1, position: { x: 0, y: 0, z: 0 }, night: false, discoveredShrine: false })).toBe(false);
  });
});
