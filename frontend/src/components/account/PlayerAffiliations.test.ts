import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "../../i18n";
import { clickConfirmDialogButton, mountConfirmDialogHost } from "../../test-support/confirmDialog";
import PlayerAffiliations from "./PlayerAffiliations.vue";

vi.mock("../../services/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/auth")>();
  return {
    ...actual,
    listMyCoaches: vi.fn(),
    acceptMyCoach: vi.fn(),
    removeMyCoach: vi.fn(),
  };
});

import { acceptMyCoach, listMyCoaches, removeMyCoach } from "../../services/auth";

const listMyCoachesMock = vi.mocked(listMyCoaches);
const MARTA = { id: "coach-1", name: "Marta Ríos", email: "marta@example.com", acceptedAt: "2026-09-01T00:00:00.000Z" };
// Asked to follow the player, who hasn't answered yet (HU24).
const PEDRO = { id: "coach-2", name: "Pedro Gil", email: "pedro@example.com", acceptedAt: null };

async function mountAffiliations(club: { id: string; name: string } | null = null) {
  const wrapper = mount(PlayerAffiliations, { props: { club }, global: { plugins: [i18n] } });
  await flushPromises();
  return wrapper;
}

const buttonLabelled = (wrapper: Awaited<ReturnType<typeof mountAffiliations>>, label: string) =>
  wrapper.findAll("button").find((button) => button.attributes("aria-label") === label);
const removeButton = (wrapper: Awaited<ReturnType<typeof mountAffiliations>>) =>
  buttonLabelled(wrapper, "Quitar a Marta Ríos")!;

describe("PlayerAffiliations", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("shows the club name when the player belongs to one", async () => {
    listMyCoachesMock.mockResolvedValue([]);

    const wrapper = await mountAffiliations({ id: "club-1", name: "Club Ajedrez Central" });

    expect(wrapper.text()).toContain("Club Ajedrez Central");
  });

  it("shows an empty-state message when there's no club or coaches", async () => {
    listMyCoachesMock.mockResolvedValue([]);

    const wrapper = await mountAffiliations();

    expect(wrapper.text()).toContain("Sin club asignado");
    expect(wrapper.text()).toContain("Todavía no tienes ningún entrenador vinculado");
  });

  it("lists the linked coaches", async () => {
    listMyCoachesMock.mockResolvedValue([MARTA]);

    const wrapper = await mountAffiliations();

    expect(wrapper.text()).toContain("Marta Ríos");
    expect(wrapper.text()).toContain("marta@example.com");
  });

  it("shows a coach's request apart, to accept or decline, without giving access yet", async () => {
    listMyCoachesMock.mockResolvedValue([MARTA, PEDRO]);

    const wrapper = await mountAffiliations();

    expect(wrapper.text()).toContain("Pedro Gil");
    expect(wrapper.text()).toContain("quiere seguir tu progreso");
    expect(buttonLabelled(wrapper, "Aceptar a Pedro Gil")).toBeDefined();
    expect(buttonLabelled(wrapper, "Rechazar a Pedro Gil")).toBeDefined();
    expect(buttonLabelled(wrapper, "Quitar a Pedro Gil")).toBeUndefined();
  });

  it("accepting a request lets that coach follow the player's progress", async () => {
    listMyCoachesMock.mockResolvedValue([PEDRO]);
    vi.mocked(acceptMyCoach).mockResolvedValue();
    const wrapper = await mountAffiliations();

    await buttonLabelled(wrapper, "Aceptar a Pedro Gil")!.trigger("click");
    await flushPromises();

    expect(acceptMyCoach).toHaveBeenCalledWith("coach-2");
    expect(buttonLabelled(wrapper, "Quitar a Pedro Gil")).toBeDefined();
    expect(wrapper.text()).not.toContain("quiere seguir tu progreso");
  });

  it("declining a request drops it, without asking: nothing was shared", async () => {
    listMyCoachesMock.mockResolvedValue([PEDRO]);
    vi.mocked(removeMyCoach).mockResolvedValue();
    mountConfirmDialogHost();
    const wrapper = await mountAffiliations();

    await buttonLabelled(wrapper, "Rechazar a Pedro Gil")!.trigger("click");
    await flushPromises();

    expect(removeMyCoach).toHaveBeenCalledWith("coach-2");
    expect(wrapper.text()).not.toContain("Pedro Gil");
  });

  it("keeps the request and says why when answering it fails", async () => {
    listMyCoachesMock.mockResolvedValue([PEDRO]);
    vi.mocked(acceptMyCoach).mockRejectedValue(new Error("network error"));
    const wrapper = await mountAffiliations();

    await buttonLabelled(wrapper, "Aceptar a Pedro Gil")!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("quiere seguir tu progreso");
    expect(wrapper.get("[role='alert']").text()).toContain("No se pudo responder la solicitud");
  });

  it("shows an error when loading coaches fails", async () => {
    listMyCoachesMock.mockRejectedValue(new Error("network error"));

    const wrapper = await mountAffiliations();

    expect(wrapper.text()).toContain("No se pudieron cargar tus entrenadores vinculados");
  });

  it("lets the player stop a coach from following their progress, after confirming (HU24)", async () => {
    listMyCoachesMock.mockResolvedValue([MARTA]);
    vi.mocked(removeMyCoach).mockResolvedValue();
    mountConfirmDialogHost();
    const wrapper = await mountAffiliations();

    await removeButton(wrapper).trigger("click");
    await clickConfirmDialogButton("Quitar");
    await flushPromises();

    expect(removeMyCoach).toHaveBeenCalledWith("coach-1");
    expect(wrapper.text()).not.toContain("Marta Ríos");
  });

  it("keeps the coach when the confirmation is dismissed", async () => {
    listMyCoachesMock.mockResolvedValue([MARTA]);
    mountConfirmDialogHost();
    const wrapper = await mountAffiliations();

    await removeButton(wrapper).trigger("click");
    await clickConfirmDialogButton("Cancelar");
    await flushPromises();

    expect(removeMyCoach).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Marta Ríos");
  });

  it("keeps the coach and says why when removing fails", async () => {
    listMyCoachesMock.mockResolvedValue([MARTA]);
    vi.mocked(removeMyCoach).mockRejectedValue(new Error("network error"));
    mountConfirmDialogHost();
    const wrapper = await mountAffiliations();

    await removeButton(wrapper).trigger("click");
    await clickConfirmDialogButton("Quitar");
    await flushPromises();

    expect(wrapper.text()).toContain("Marta Ríos");
    expect(wrapper.get("[role='alert']").text()).toContain("No se pudo quitar al entrenador");
  });
});
