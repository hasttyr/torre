import { describe, expect, it } from "vitest";

import { parseTrustProxy } from "./env";

describe("parseTrustProxy", () => {
  it("leaves proxies untrusted when TRUST_PROXY isn't set, so a client can't forge its address", () => {
    expect(parseTrustProxy(undefined)).toBeUndefined();
    expect(parseTrustProxy("")).toBeUndefined();
  });

  it("reads a number as how many proxy hops to trust", () => {
    expect(parseTrustProxy("1")).toBe(1);
  });

  it("passes anything else through, as Express understands it (e.g. 'loopback', a subnet)", () => {
    expect(parseTrustProxy("loopback")).toBe("loopback");
    expect(parseTrustProxy("10.0.0.0/8")).toBe("10.0.0.0/8");
  });
});
