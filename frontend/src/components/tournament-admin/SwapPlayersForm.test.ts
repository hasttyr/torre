import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { i18n } from "../../i18n";
import type { Round } from "../../services/rounds";
import SwapPlayersForm from "./SwapPlayersForm.vue";

const ROUND: Round = {
  id: "r-1",
  number: 1,
  status: "GENERATED",
  createdAt: "2026-09-19T00:00:00.000Z",
  matches: [
    {
      id: "m-1",
      board: 1,
      status: "SCHEDULED",
      white: { playerId: "p1", name: "Ana Torres" },
      black: { playerId: "p2", name: "Luis Gómez" },
      result: null,
      isBye: false,
    },
  ],
};

enableAutoUnmount(afterEach);

// attachTo: a failed submit moves focus, which jsdom only tracks for attached nodes.
const mountForm = (submit = vi.fn(async () => true)) =>
  mount(SwapPlayersForm, {
    props: { round: ROUND, busy: false, submit },
    global: { plugins: [i18n] },
    attachTo: document.body,
  });

async function fillAndSubmit(wrapper: ReturnType<typeof mountForm>) {
  await wrapper.get("#swapPlayerA").setValue("p1");
  await wrapper.get("#swapPlayerB").setValue("p2");
  await wrapper.get("#swapReason").setValue("Mismo club");
  await wrapper.get("form").trigger("submit.prevent");
  await flushPromises();
}

describe("SwapPlayersForm (HU29)", () => {
  it("explains what's missing next to each field instead of silently disabling the button", async () => {
    const submit = vi.fn(async () => true);
    const wrapper = mountForm(submit);
    expect(wrapper.get("button[type='submit']").attributes("disabled")).toBeUndefined();

    await wrapper.get("#swapReason").setValue("no");
    await wrapper.get("form").trigger("submit.prevent");
    await flushPromises();

    expect(submit).not.toHaveBeenCalled();
    expect(wrapper.get("#swapPlayerA").attributes("aria-invalid")).toBe("true");
    expect(wrapper.get("#swapPlayerB").attributes("aria-invalid")).toBe("true");
    expect(wrapper.get(`#${wrapper.get("#swapReason").attributes("aria-describedby")}`).text()).toContain(
      "al menos 3 caracteres",
    );
    expect(document.activeElement).toBe(wrapper.get("#swapPlayerA").element);
  });

  it("sends the swap once both players and a reason are given, then clears the form", async () => {
    const submit = vi.fn(async () => true);
    const wrapper = mountForm(submit);

    await fillAndSubmit(wrapper);

    expect(submit).toHaveBeenCalledWith({ playerAId: "p1", playerBId: "p2", reason: "Mismo club" });
    expect((wrapper.get("#swapReason").element as HTMLInputElement).value).toBe("");
    expect(wrapper.get("#swapReason").attributes()).toMatchObject({ name: "swapReason", autocomplete: "off" });
  });

  it("keeps both players and the reason when the server refuses the swap, so nothing has to be typed again", async () => {
    const wrapper = mountForm(vi.fn(async () => false));

    await fillAndSubmit(wrapper);

    expect((wrapper.get("#swapPlayerA").element as HTMLSelectElement).value).toBe("p1");
    expect((wrapper.get("#swapPlayerB").element as HTMLSelectElement).value).toBe("p2");
    expect((wrapper.get("#swapReason").element as HTMLInputElement).value).toBe("Mismo club");
  });
});
