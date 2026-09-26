import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { h, nextTick } from "vue";

import LazyMount from "./LazyMount.vue";

enableAutoUnmount(afterEach);

/** A controllable IntersectionObserver: `reveal()` reports the observed element as visible. */
function stubIntersectionObserver() {
  const observer = {
    observe: vi.fn(),
    disconnect: vi.fn(),
    options: undefined as IntersectionObserverInit | undefined,
  };
  let callback: IntersectionObserverCallback = () => undefined;
  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn(function (this: unknown, cb: IntersectionObserverCallback, options: IntersectionObserverInit) {
      callback = cb;
      observer.options = options;
      return observer;
    }),
  );
  const reveal = () =>
    callback([{ isIntersecting: true } as IntersectionObserverEntry], observer as unknown as IntersectionObserver);
  return { observer, reveal };
}

const mountLazy = () =>
  mount(LazyMount, {
    slots: { default: () => h("p", "Widget"), placeholder: () => h("p", "Esqueleto") },
  });

describe("LazyMount", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the placeholder until the content comes near the viewport, then mounts it for good", async () => {
    const { observer, reveal } = stubIntersectionObserver();
    const wrapper = mountLazy();
    expect(wrapper.text()).toBe("Esqueleto");
    expect(observer.options?.rootMargin).toBe("400px");

    reveal();
    await nextTick();

    expect(wrapper.text()).toBe("Widget");
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it("announces once that it came into view, so its content's data can start loading with its code", () => {
    const { reveal } = stubIntersectionObserver();
    const wrapper = mountLazy();
    expect(wrapper.emitted("visible")).toBeUndefined();

    reveal();
    reveal();

    expect(wrapper.emitted("visible")).toHaveLength(1);
  });

  it("renders straight away where there's no IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);

    const wrapper = mountLazy();

    expect(wrapper.text()).toBe("Widget");
    expect(wrapper.emitted("visible")).toHaveLength(1);
  });
});
