import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

import { i18n } from "../../i18n";
import type { Match } from "../../services/rounds";
import ResultEntry from "./ResultEntry.vue";

enableAutoUnmount(afterEach);

const match = (result: Match["result"]) => ({ id: "m-1", board: 1, result }) as Match;

// attachTo: focus only moves between attached nodes in jsdom.
const mountEntry = (result: Match["result"]) =>
  mount(ResultEntry, {
    props: { match: match(result), busy: false },
    global: { plugins: [i18n] },
    attachTo: document.body,
  });

const focused = () => document.activeElement as HTMLElement;
const button = (wrapper: ReturnType<typeof mountEntry>, text: string) =>
  wrapper.findAll("button").find((node) => node.text() === text || node.attributes("aria-label") === text)!;

describe("ResultEntry", () => {
  it("records a result straight from the picker when the game has none", async () => {
    const wrapper = mountEntry(null);

    await button(wrapper, "Tablas").trigger("click");

    expect(wrapper.emitted("record")).toEqual([["1/2-1/2"]]);
  });

  it("asks for an explicit correction of a recorded result, with an optional reason", async () => {
    const wrapper = mountEntry("1-0");

    await button(wrapper, "Corregir").trigger("click");
    await button(wrapper, "Ganan negras").trigger("click");
    await wrapper.get("input").setValue("  planilla mal transcrita ");
    await button(wrapper, "Guardar corrección").trigger("click");

    expect(wrapper.emitted("correct")).toEqual([["0-1", "planilla mal transcrita"]]);
  });

  describe("keeps keyboard focus where the user is working", () => {
    it("opening a correction focuses the result it would change", async () => {
      const wrapper = mountEntry("1-0");

      await button(wrapper, "Corregir").trigger("click");
      await flushPromises();

      expect(focused().getAttribute("aria-label")).toBe("Ganan blancas");
      expect(focused().getAttribute("aria-pressed")).toBe("true");
    });

    it.each([
      ["cancelling", (wrapper: ReturnType<typeof mountEntry>) => button(wrapper, "Cancelar").trigger("click")],
      ["pressing Escape", (wrapper: ReturnType<typeof mountEntry>) => wrapper.get("input").trigger("keydown.esc")],
      [
        "saving",
        async (wrapper: ReturnType<typeof mountEntry>) => {
          await button(wrapper, "Tablas").trigger("click");
          await button(wrapper, "Guardar corrección").trigger("click");
        },
      ],
    ])("closing it by %s returns focus to Correct", async (_, close) => {
      const wrapper = mountEntry("1-0");
      await button(wrapper, "Corregir").trigger("click");
      await flushPromises();

      await close(wrapper);
      await flushPromises();

      expect(focused()).toBe(button(wrapper, "Corregir").element);
    });

    it("once a result it recorded is saved, focus moves to its Correct button", async () => {
      const wrapper = mountEntry(null);
      const draw = button(wrapper, "Tablas");
      (draw.element as HTMLButtonElement).focus();
      await draw.trigger("click");

      await wrapper.setProps({ match: match("1/2-1/2") });
      await flushPromises();

      expect(focused()).toBe(button(wrapper, "Corregir").element);
    });

    it("a result recorded elsewhere (live update) doesn't take focus", async () => {
      const wrapper = mountEntry(null);

      await wrapper.setProps({ match: match("1-0") });
      await flushPromises();

      expect(focused()).toBe(document.body);
    });
  });
});
