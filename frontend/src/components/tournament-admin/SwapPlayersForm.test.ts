import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

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
const mountForm = () =>
  mount(SwapPlayersForm, {
    props: { round: ROUND, busy: false },
    global: { plugins: [i18n] },
    attachTo: document.body,
  });

describe("SwapPlayersForm (HU29)", () => {
  it("explains what's missing next to each field instead of silently disabling the button", async () => {
    const wrapper = mountForm();
    expect(wrapper.get("button[type='submit']").attributes("disabled")).toBeUndefined();

    await wrapper.get("#swapReason").setValue("no");
    await wrapper.get("form").trigger("submit.prevent");
    await flushPromises();

    expect(wrapper.emitted("swap")).toBeUndefined();
    expect(wrapper.get("#swapPlayerA").attributes("aria-invalid")).toBe("true");
    expect(wrapper.get("#swapPlayerB").attributes("aria-invalid")).toBe("true");
    expect(wrapper.get(`#${wrapper.get("#swapReason").attributes("aria-describedby")}`).text()).toContain(
      "al menos 3 caracteres",
    );
    expect(document.activeElement).toBe(wrapper.get("#swapPlayerA").element);
  });

  it("sends the swap once both players and a reason are given, then clears the form", async () => {
    const wrapper = mountForm();

    await wrapper.get("#swapPlayerA").setValue("p1");
    await wrapper.get("#swapPlayerB").setValue("p2");
    await wrapper.get("#swapReason").setValue("Mismo club");
    await wrapper.get("form").trigger("submit.prevent");

    expect(wrapper.emitted("swap")).toEqual([[{ playerAId: "p1", playerBId: "p2", reason: "Mismo club" }]]);
    expect((wrapper.get("#swapReason").element as HTMLInputElement).value).toBe("");
    expect(wrapper.get("#swapReason").attributes()).toMatchObject({ name: "swapReason", autocomplete: "off" });
  });
});
