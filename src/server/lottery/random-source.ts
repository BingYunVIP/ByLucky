import "server-only";

import { randomInt } from "node:crypto";
import type { RandomSource } from "./types";

export const cryptoRandomSource: RandomSource = {
  int(minInclusive, maxExclusive) {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive) || maxExclusive <= minInclusive) {
      throw new Error("Invalid random range");
    }
    return randomInt(minInclusive, maxExclusive);
  },
};
