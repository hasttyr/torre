import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, useTemplateRef } from "vue";

import { stubIntersectionObserver } from "../test-support/intersectionObserver";
import { useInView } from "./useInView";

enableAutoUnmount(afterEach);

/** Renders whether its root element has come into view, as `data-in-view`. */
const Probe = defineComponent({
  props: { rootMargin: { type: String, default: undefined } },
  setup(props) {
    const inView = useInView(useTemplateRef<HTMLElement>("root"), { rootMargin: props.rootMargin });
    return () => h("div", { ref: "root", "data-in-view": String(inView.value) });
  },
});

const inView = (wrapper: ReturnType<typeof mount>) => wrapper.attributes("data-in-view");

describe("useInView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stays false until the element comes into view, then stays true and stops watching", async () => {
    const { observer, reveal } = stubIntersectionObserver();
    const wrapper = mount(Probe);
    expect(inView(wrapper)).toBe("false");

    reveal();
    await nextTick();

    expect(inView(wrapper)).toBe("true");
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it("watches with the root margin it's given", () => {
    const { observer } = stubIntersectionObserver();

    mount(Probe, { props: { rootMargin: "400px" } });

    expect(observer.options?.rootMargin).toBe("400px");
  });

  it("is true from the start where there's no IntersectionObserver, so nothing waits hidden for it", () => {
    vi.stubGlobal("IntersectionObserver", undefined);

    expect(inView(mount(Probe))).toBe("true");
  });

  it("stops watching when its component goes away", () => {
    const { observer } = stubIntersectionObserver();

    mount(Probe).unmount();

    expect(observer.disconnect).toHaveBeenCalled();
  });
});
