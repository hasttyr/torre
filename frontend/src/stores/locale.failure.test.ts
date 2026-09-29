import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// English's messages can't be downloaded (offline, or a deploy just removed the old chunk).
vi.mock("../i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../i18n")>()),
  loadLocaleMessages: vi.fn(async (locale: string) => {
    if (locale === "en") throw new Error("Failed to fetch dynamically imported module");
  }),
}));

import { i18n } from "../i18n";
import { useLocaleStore } from "./locale";

describe("switching language when English can't be loaded", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the current language and says the switch failed, instead of failing silently", async () => {
    const locale = useLocaleStore();

    await expect(locale.toggle()).resolves.toBeUndefined();

    expect(locale.locale).toBe("es");
    expect(i18n.global.locale.value).toBe("es");
    expect(locale.switchFailed).toBe(true);
  });

  it("lets the notice go after a few seconds", async () => {
    vi.useFakeTimers();
    const locale = useLocaleStore();
    await locale.toggle();

    await vi.advanceTimersByTimeAsync(5000);

    expect(locale.switchFailed).toBe(false);
  });
});
