import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import { i18n } from "../../i18n";
import LoadError from "./LoadError.vue";

vi.mock("../../lib/pageLoad", () => ({ reloadPage: vi.fn() }));

import { reloadPage } from "../../lib/pageLoad";

describe("LoadError", () => {
  it("says what failed and offers the way forward: trying again", async () => {
    const retry = vi.fn();
    const wrapper = mount(LoadError, {
      props: { message: "No se pudo cargar el panel", retry },
      global: { plugins: [i18n] },
    });

    expect(wrapper.attributes("role")).toBe("alert");
    expect(wrapper.text()).toContain("No se pudo cargar el panel");
    await wrapper.get("button").trigger("click");

    expect(wrapper.get("button").text()).toBe("Reintentar");
    expect(retry).toHaveBeenCalledOnce();
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it("retries by reloading the page when the view gives no retry of its own", async () => {
    const wrapper = mount(LoadError, { props: { message: "x" }, global: { plugins: [i18n] } });

    await wrapper.get("button").trigger("click");

    expect(reloadPage).toHaveBeenCalledOnce();
  });
});
