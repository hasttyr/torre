import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { useConfirmStore } from "./confirm";

describe("useConfirmStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("opens with the given options and resolves true on resolve(true)", async () => {
    const store = useConfirmStore();

    const pending = store.ask({ title: "Eliminar club", message: "¿Seguro?", danger: true });

    expect(store.open).toBe(true);
    expect(store.title).toBe("Eliminar club");
    expect(store.message).toBe("¿Seguro?");
    expect(store.danger).toBe(true);

    store.resolve(true);

    expect(store.open).toBe(false);
    await expect(pending).resolves.toBe(true);
  });

  it("resolves false and closes on resolve(false)", async () => {
    const store = useConfirmStore();

    const pending = store.ask({ title: "T", message: "M" });
    store.resolve(false);

    await expect(pending).resolves.toBe(false);
  });

  it("defaults danger to false when not given", () => {
    const store = useConfirmStore();
    store.ask({ title: "T", message: "M" });
    expect(store.danger).toBe(false);
  });

  it("resolves a stale pending confirmation as false when a new one is asked", async () => {
    const store = useConfirmStore();

    const first = store.ask({ title: "First", message: "M" });
    const second = store.ask({ title: "Second", message: "M" });

    await expect(first).resolves.toBe(false);
    expect(store.title).toBe("Second");

    store.resolve(true);
    await expect(second).resolves.toBe(true);
  });
});
