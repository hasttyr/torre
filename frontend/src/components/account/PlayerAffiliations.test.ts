import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "../../i18n";
import PlayerAffiliations from "./PlayerAffiliations.vue";

vi.mock("../../services/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/auth")>();
  return {
    ...actual,
    listMyCoaches: vi.fn(),
  };
});

import { listMyCoaches } from "../../services/auth";

const listMyCoachesMock = vi.mocked(listMyCoaches);

describe("PlayerAffiliations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the club name when the player belongs to one", async () => {
    listMyCoachesMock.mockResolvedValue([]);

    const wrapper = mount(PlayerAffiliations, {
      props: { club: { id: "club-1", name: "Club Ajedrez Central" } },
      global: { plugins: [i18n] },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.text()).toContain("Club Ajedrez Central");
  });

  it("shows an empty-state message when there's no club or coaches", async () => {
    listMyCoachesMock.mockResolvedValue([]);

    const wrapper = mount(PlayerAffiliations, {
      props: { club: null },
      global: { plugins: [i18n] },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Sin club asignado");
    expect(wrapper.text()).toContain("Todavía no tienes ningún entrenador vinculado");
  });

  it("lists the linked coaches", async () => {
    listMyCoachesMock.mockResolvedValue([{ id: "coach-1", name: "Marta Ríos", email: "marta@example.com" }]);

    const wrapper = mount(PlayerAffiliations, {
      props: { club: null },
      global: { plugins: [i18n] },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Marta Ríos");
    expect(wrapper.text()).toContain("marta@example.com");
  });

  it("shows an error when loading coaches fails", async () => {
    listMyCoachesMock.mockRejectedValue(new Error("network error"));

    const wrapper = mount(PlayerAffiliations, {
      props: { club: null },
      global: { plugins: [i18n] },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("No se pudieron cargar tus entrenadores vinculados");
  });
});
