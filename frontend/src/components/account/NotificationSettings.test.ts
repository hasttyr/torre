import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "../../i18n";
import NotificationSettings from "./NotificationSettings.vue";

vi.mock("../../services/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/auth")>()),
  getNotificationSettings: vi.fn(),
  updateNotificationSettings: vi.fn(),
}));

import { getNotificationSettings, updateNotificationSettings } from "../../services/auth";

async function mountSettings() {
  const wrapper = mount(NotificationSettings, { global: { plugins: [i18n] } });
  await flushPromises();
  return wrapper;
}

const box = (wrapper: Awaited<ReturnType<typeof mountSettings>>) =>
  wrapper.get<HTMLInputElement>("input[name='roundPublished']");

// #141: the player's choice about the email on a round's publication.
describe("NotificationSettings", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("shows the current choice", async () => {
    vi.mocked(getNotificationSettings).mockResolvedValue({ roundPublished: true, emailAvailable: true });

    const wrapper = await mountSettings();

    expect(box(wrapper).element.checked).toBe(true);
    expect(wrapper.text()).toContain("Avisarme por correo");
    expect(wrapper.text()).not.toContain("no tiene correo configurado");
  });

  it("saves the player's choice when they untick it", async () => {
    vi.mocked(getNotificationSettings).mockResolvedValue({ roundPublished: true, emailAvailable: true });
    vi.mocked(updateNotificationSettings).mockResolvedValue({ roundPublished: false, emailAvailable: true });
    const wrapper = await mountSettings();

    await box(wrapper).setValue(false);
    await flushPromises();

    expect(updateNotificationSettings).toHaveBeenCalledWith(false);
    expect(box(wrapper).element.checked).toBe(false);
  });

  it("puts the box back and says so when the choice can't be saved", async () => {
    vi.mocked(getNotificationSettings).mockResolvedValue({ roundPublished: true, emailAvailable: true });
    vi.mocked(updateNotificationSettings).mockRejectedValue(new Error("offline"));
    const wrapper = await mountSettings();

    await box(wrapper).setValue(false);
    await flushPromises();

    expect(box(wrapper).element.checked).toBe(true);
    expect(wrapper.text()).toContain("No se pudo guardar tu elección");
  });

  it("warns that no notice is going out when the system has no email", async () => {
    vi.mocked(getNotificationSettings).mockResolvedValue({ roundPublished: true, emailAvailable: false });

    expect((await mountSettings()).text()).toContain("los avisos no se están enviando");
  });

  it("offers to try again when the choice can't be loaded", async () => {
    vi.mocked(getNotificationSettings).mockRejectedValue(new Error("offline"));

    expect((await mountSettings()).text()).toContain("No se pudieron cargar tus avisos");
  });
});
