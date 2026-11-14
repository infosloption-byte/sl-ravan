import { describe, expect, it } from "vitest";
import { startupErrorMessage } from "./startupError";

describe("startup diagnostics", () => {
  it("preserves actual thrown Error messages", () => {
    expect(startupErrorMessage(new Error("Shader registration failed"))).toBe("Shader registration failed");
  });
  it("preserves non-Error strings thrown by loader modules", () => {
    expect(startupErrorMessage("model loader unavailable")).toBe("model loader unavailable");
  });
  it("provides instructions for uninformative values", () => {
    expect(startupErrorMessage(undefined)).toContain("console");
    expect(startupErrorMessage({ message: "no WebGL context" })).toBe("no WebGL context");
  });
});
