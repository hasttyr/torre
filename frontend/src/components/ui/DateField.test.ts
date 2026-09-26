import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "../../i18n";
import { useLocaleStore } from "../../stores/locale";
import DateField from "./DateField.vue";

// Bogotá time on purpose: a "YYYY-MM-DD" handed to the picker as-is is read
// as UTC midnight, i.e. the previous evening here.
const originalTimeZone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Bogota";
});
afterAll(() => {
  process.env.TZ = originalTimeZone;
});

function mountFieldNow(props: { modelValue?: string; maxDate?: string } = {}) {
  const wrapper = mount(DateField, {
    props: {
      id: "date",
      modelValue: props.modelValue ?? "",
      maxDate: props.maxDate,
      "onUpdate:modelValue": (value: string) => wrapper.setProps({ modelValue: value }),
    },
    global: { plugins: [i18n] },
  });
  return wrapper;
}

/** Mounts the field once the picker (its own chunk) has loaded. */
async function mountField(props: { modelValue?: string; maxDate?: string } = {}) {
  const wrapper = mountFieldNow(props);
  await vi.dynamicImportSettled();
  await flushPromises();
  return wrapper;
}

/** Types into the picker's input and confirms on blur, as a user does. */
async function type(wrapper: Awaited<ReturnType<typeof mountField>>, text: string): Promise<void> {
  await wrapper.get("#date").setValue(text);
  await wrapper.get("#date").trigger("blur");
}

describe("DateField", () => {
  beforeEach(async () => {
    localStorage.clear();
    setActivePinia(createPinia());
    await useLocaleStore().setLocale("es");
  });

  it("holds the picker's place with a same-looking input, already showing the date, while it loads", async () => {
    const wrapper = mountFieldNow({ modelValue: "2026-10-01" });

    const placeholder = wrapper.get("#date");
    expect(placeholder.attributes("readonly")).toBeDefined();
    expect((placeholder.element as HTMLInputElement).value).toBe("01/10/2026");

    await vi.dynamicImportSettled();
    await flushPromises();
    expect(wrapper.get("#date").attributes("readonly")).toBeUndefined();
    expect((wrapper.get("#date").element as HTMLInputElement).value).toBe("01/10/2026");
  });

  it("leaves naming the input to the field's own <label>", async () => {
    const wrapper = await mountField();

    // The picker's default aria-label ("Datepicker input") would override it.
    expect(wrapper.get("#date").attributes("aria-label")).toBeUndefined();
  });

  it("reads typed dates day-first in Spanish", async () => {
    const wrapper = await mountField();

    await type(wrapper, "01/10/2026");

    expect(wrapper.props("modelValue")).toBe("2026-10-01");
  });

  it("reads typed dates month-first in English, the order it displays them in", async () => {
    await useLocaleStore().setLocale("en");
    const wrapper = await mountField();

    await type(wrapper, "10/01/2026");

    expect(wrapper.props("modelValue")).toBe("2026-10-01");
  });

  it("accepts back, unchanged, the date it shows", async () => {
    await useLocaleStore().setLocale("en");
    const wrapper = await mountField({ modelValue: "2026-10-01" });
    const shown = (wrapper.get("#date").element as HTMLInputElement).value;

    await type(wrapper, shown);

    expect(shown).toBe("10/01/2026");
    expect(wrapper.props("modelValue")).toBe("2026-10-01");
  });

  it("allows the max date itself, taken as the viewer's calendar day", async () => {
    const wrapper = await mountField({ maxDate: "2026-09-25" });

    await type(wrapper, "25/09/2026");

    expect(wrapper.props("modelValue")).toBe("2026-09-25");
  });
});
