import { describe, expect, it } from "vitest";
import { assertStrictlyIncreasingSequence } from "./runtime-sequencing";

describe("runtime-sequencing", () => {
  it("assertStrictlyIncreasingSequence aceita sequência crescente", () => {
    expect(() => assertStrictlyIncreasingSequence(0, 1)).not.toThrow();
  });

  it("assertStrictlyIncreasingSequence rejeita não crescente", () => {
    expect(() => assertStrictlyIncreasingSequence(2, 2)).toThrow();
  });
});
