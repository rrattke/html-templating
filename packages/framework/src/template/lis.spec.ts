import { describe, expect, it } from "vitest";
import { longestIncreasingSubsequence } from "./render.js";

describe("longestIncreasingSubsequence", () => {
  it("should handle empty arrays", () => {
    expect(longestIncreasingSubsequence([])).toEqual([]);
  });

  it("should handle single element arrays", () => {
    expect(longestIncreasingSubsequence([5])).toEqual([0]);
  });

  it("should find LIS in already sorted array", () => {
    // Values: [1, 2, 3, 4]
    // Indices: [0, 1, 2, 3]
    expect(longestIncreasingSubsequence([1, 2, 3, 4])).toEqual([0, 1, 2, 3]);
  });

  it("should find LIS in reverse sorted array", () => {
    // Values: [4, 3, 2, 1]
    // LIS: [1] (or [2], [3], [4]) -> length 1.
    // This implementation usually picks the last one ending valid sequence of length 1?
    // Let's trace:
    // i=0, val=4, res=[0]
    // i=1, val=3, < 4, replace 0 with 1. res=[1]
    // i=2, val=2, < 3, replace 1 with 2. res=[2]
    // i=3, val=1, < 2, replace 2 with 3. res=[3]
    // Returns [3] (index of 1) which is a valid LIS of length 1.
    expect(longestIncreasingSubsequence([4, 3, 2, 1])).toHaveLength(1);
    expect(longestIncreasingSubsequence([4, 3, 2, 1])).toEqual([3]);
  });

  it("should find LIS in random array", () => {
    // Values: [10, 22, 9, 33, 21, 50, 41, 60]
    // Indices: [0, 1, 2, 3, 4, 5, 6, 7]
    // Possible LIS:
    // [10, 22, 33, 50, 60] (length 5)
    // [10, 22, 33, 41, 60] (length 5)

    const input = [10, 22, 9, 33, 21, 50, 41, 60];
    const result = longestIncreasingSubsequence(input);
    const values = result.map((i) => input[i]);

    expect(values).toHaveLength(5);

    // Check strict increasing property
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }

    // Check it matches one of the valid paths
    expect(values[4]).toBe(60);
    expect(values[0]).toBe(10);
  });

  it("should handle duplicates (strictly increasing)", () => {
    // LIS is strictly increasing, so duplicates break the sequence.
    // [1, 2, 2, 3] -> [1, 2, 3] (indices 0, 1, 3 or 0, 2, 3)
    const input = [1, 2, 2, 3];
    const result = longestIncreasingSubsequence(input);
    const values = result.map((i) => input[i]);

    expect(values).toEqual([1, 2, 3]);
  });

  it("should handle complex mix", () => {
    // [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15]
    // LIS length is 6: [0, 2, 6, 9, 11, 15] -> values [0, 4, 6, 9, 11, 15]
    // Or [0, 2, 6, 9, 13, 15] -> [0, 2, 6, 9, 11, 15] is NOT increasing (2 > 0 but 6 > 2... wait)
    // Values: 0, 2, 6, 9, 11, 15
    const input = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15];
    const result = longestIncreasingSubsequence(input);
    const values = result.map((i) => input[i]);

    // Verify it's strictly increasing
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }

    expect(values.length).toBe(6);
  });
});
