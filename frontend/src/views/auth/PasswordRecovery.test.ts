import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import ForgotPasswordView from "./ForgotPasswordView.vue";
import ResetPasswordView from "./ResetPasswordView.vue";

vi.mock("../../services/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/auth")>()),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));

import { confirmPasswordReset, requestPasswordReset } from "../../services/auth";

async function mountAt(component: unknown, path: string) {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/:p(.*)*", component: component as never }],
  });
  await router.push(path);
  const wrapper = mount(component as never, { global: { plugins: [router, i18n] } });
  await flushPromises();
  return wrapper;
}

describe("ForgotPasswordView (HU19)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("requests the reset link and shows the same message whether or not the account exists", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue();
    const wrapper = await mountAt(ForgotPasswordView, "/olvide-password");

    await wrapper.get("input[type='email']").setValue("  ana@example.com ");
    await wrapper.get("form").trigger("submit.prevent");
    await flushPromises();

    expect(requestPasswordReset).toHaveBeenCalledWith("ana@example.com");
    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.find(".banner--success").exists()).toBe(true);
  });

  it("keeps the form and shows the server's error when the request fails", async () => {
    vi.mocked(requestPasswordReset).mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Servicio no disponible" } },
    });
    const wrapper = await mountAt(ForgotPasswordView, "/olvide-password");

    await wrapper.get("input[type='email']").setValue("ana@example.com");
    await wrapper.get("form").trigger("submit.prevent");
    await flushPromises();

    expect(wrapper.text()).toContain("Servicio no disponible");
    expect(wrapper.find("form").exists()).toBe(true);
  });
});

describe("ResetPasswordView (HU19)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("explains the problem instead of showing a form when the link has no token", async () => {
    const wrapper = await mountAt(ResetPasswordView, "/restablecer-password");

    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.find("[role='alert']").exists()).toBe(true);
  });

  it("validates length and confirmation before calling the server", async () => {
    const wrapper = await mountAt(ResetPasswordView, "/restablecer-password?token=abc");

    await wrapper.get("#newPassword").setValue("short");
    await wrapper.get("#confirmPassword").setValue("different");
    await wrapper.get("form").trigger("submit.prevent");

    expect(confirmPasswordReset).not.toHaveBeenCalled();
    expect(wrapper.findAll(".has-error")).toHaveLength(2);
  });

  it("sends the token from the link with the new password", async () => {
    vi.mocked(confirmPasswordReset).mockResolvedValue();
    const wrapper = await mountAt(ResetPasswordView, "/restablecer-password?token=abc");

    await wrapper.get("#newPassword").setValue("nuevaClave123");
    await wrapper.get("#confirmPassword").setValue("nuevaClave123");
    await wrapper.get("form").trigger("submit.prevent");
    await flushPromises();

    expect(confirmPasswordReset).toHaveBeenCalledWith("abc", "nuevaClave123");
    expect(wrapper.find(".banner--success").exists()).toBe(true);
  });

  it("shows why an expired or used token was rejected", async () => {
    vi.mocked(confirmPasswordReset).mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "El enlace ya fue usado" } },
    });
    const wrapper = await mountAt(ResetPasswordView, "/restablecer-password?token=abc");

    await wrapper.get("#newPassword").setValue("nuevaClave123");
    await wrapper.get("#confirmPassword").setValue("nuevaClave123");
    await wrapper.get("form").trigger("submit.prevent");
    await flushPromises();

    expect(wrapper.text()).toContain("El enlace ya fue usado");
  });
});
