import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { i18n } from "../i18n";
import { useLocaleStore } from "./locale";

describe("useLocaleStore", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  afterEach(async () => {
    await useLocaleStore().setLocale("es");
  });

  it("ships only Spanish up front, and loads English the first time it's chosen", async () => {
    expect(i18n.global.availableLocales).not.toContain("en");

    await useLocaleStore().setLocale("en");

    expect(i18n.global.locale.value).toBe("en");
    expect(i18n.global.t("common.cancel")).toBe("Cancel");
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem("torre.locale")).toBe("en");
  });

  it("applies the saved language before the app renders, on any page", async () => {
    localStorage.setItem("torre.locale", "en");

    await useLocaleStore().init();

    expect(i18n.global.locale.value).toBe("en");
    expect(i18n.global.t("common.cancel")).toBe("Cancel");
  });

  it("ends on the last language picked, even if an earlier one finishes loading later", async () => {
    const store = useLocaleStore();

    const english = store.setLocale("en");
    const spanish = store.setLocale("es");
    await Promise.all([english, spanish]);

    expect(store.locale).toBe("es");
    expect(i18n.global.locale.value).toBe("es");
  });
});
