import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  // attachTo: a failed submit moves focus, which jsdom only tracks for attached nodes.
  const wrapper = mount(component as never, { global: { plugins: [router, i18n] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

enableAutoUnmount(afterEach);

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
    // Announced: the form it replaces had focus.
    expect(wrapper.get("[role='status']").classes()).toContain("banner--success");
  });

  it("asks for the email next to the field instead of sending an empty request", async () => {
    const wrapper = await mountAt(ForgotPasswordView, "/olvide-password");

    await wrapper.get("form").trigger("submit.prevent");
    await flushPromises();

    expect(requestPasswordReset).not.toHaveBeenCalled();
    const email = wrapper.get("#email");
    expect(email.attributes()).toMatchObject({ "aria-invalid": "true", name: "email", spellcheck: "false" });
    expect(wrapper.get(`#${email.attributes("aria-describedby")}`).text()).toBe("El correo es requerido");
    expect(document.activeElement).toBe(email.element);
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
    // The way forward, not just the problem.
    expect(wrapper.get("a[href='/olvide-password']").text()).toBe("Solicitar un enlace nuevo");
  });

  it("validates length and confirmation before calling the server", async () => {
    const wrapper = await mountAt(ResetPasswordView, "/restablecer-password?token=abc");

    await wrapper.get("#newPassword").setValue("short");
    await wrapper.get("#confirmPassword").setValue("different");
    await wrapper.get("form").trigger("submit.prevent");

    expect(confirmPasswordReset).not.toHaveBeenCalled();
    expect(wrapper.findAll(".has-error")).toHaveLength(2);
    await flushPromises();
    expect(wrapper.get("#newPassword").attributes("aria-describedby")).toBe("newPassword-error");
    expect(wrapper.get("#confirmPassword").attributes("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(wrapper.get("#newPassword").element);
  });

  it("sends the token from the link with the new password", async () => {
    vi.mocked(confirmPasswordReset).mockResolvedValue();
    const wrapper = await mountAt(ResetPasswordView, "/restablecer-password?token=abc");

    await wrapper.get("#newPassword").setValue("nuevaClave123");
    await wrapper.get("#confirmPassword").setValue("nuevaClave123");
    await wrapper.get("form").trigger("submit.prevent");
    await flushPromises();

    expect(confirmPasswordReset).toHaveBeenCalledWith("abc", "nuevaClave123");
    expect(wrapper.get("[role='status']").classes()).toContain("banner--success");
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
    expect(wrapper.find("a[href='/olvide-password']").exists()).toBe(true);
  });
});
