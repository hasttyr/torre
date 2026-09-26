import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import RegisterView from "./RegisterView.vue";

vi.mock("../../services/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/auth")>();
  return {
    ...actual,
    registerUser: vi.fn(),
    loginUser: vi.fn(),
  };
});

import { loginUser, registerUser } from "../../services/auth";

const registerUserMock = vi.mocked(registerUser);
const loginUserMock = vi.mocked(loginUser);

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/", component: { template: "<div />" } },
      { path: "/cuenta", component: { template: "<div />" } },
      { path: "/panel", component: { template: "<div />" } },
    ],
  });
}

async function mountRegisterView() {
  const router = makeRouter();
  router.push("/registro-under-test");
  await router.isReady();

  // attachTo: a failed submit moves focus, which jsdom only tracks for attached nodes.
  const wrapper = mount(RegisterView, { global: { plugins: [router, i18n] }, attachTo: document.body });
  return { wrapper, router };
}

enableAutoUnmount(afterEach);

async function fillBaseFields(wrapper: Awaited<ReturnType<typeof mountRegisterView>>["wrapper"]) {
  await wrapper.find('input[type="text"]').setValue("Ana Torres");
  await wrapper.find('input[type="email"]').setValue("ana@example.com");
  await wrapper.find('input[type="password"]').setValue("password123");
}

async function selectRol(wrapper: Awaited<ReturnType<typeof mountRegisterView>>["wrapper"], rol: string) {
  await wrapper.find(`input[type="radio"][value="${rol}"]`).setValue();
}

async function acceptDataPolicy(wrapper: Awaited<ReturnType<typeof mountRegisterView>>["wrapper"]) {
  await wrapper.find('input[type="checkbox"]').setValue(true);
}

describe("RegisterView", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    registerUserMock.mockReset();
    loginUserMock.mockReset();
  });

  it("shows player fields by default (initial role PLAYER)", async () => {
    const { wrapper } = await mountRegisterView();

    expect(wrapper.find("fieldset").exists()).toBe(true);
    expect(wrapper.text()).toContain("Datos de jugador");
  });

  it("hides player fields when another role is chosen", async () => {
    const { wrapper } = await mountRegisterView();

    await selectRol(wrapper, "COACH");

    expect(wrapper.find("fieldset").exists()).toBe(false);
  });

  it("only offers PLAYER and COACH as self-assignable roles", async () => {
    const { wrapper } = await mountRegisterView();

    const roleInputs = wrapper.findAll('input[type="radio"][name="role"]');
    expect(roleInputs.map((input) => (input.element as HTMLInputElement).value)).toEqual(["PLAYER", "COACH"]);
  });

  it("shows validation errors and does not call the backend when the form is empty", async () => {
    const { wrapper } = await mountRegisterView();

    await selectRol(wrapper, "COACH");
    await wrapper.find("form").trigger("submit.prevent");

    expect(wrapper.text()).toContain("El nombre debe tener al menos 2 caracteres");
    expect(wrapper.text()).toContain("El correo no es válido");
    expect(wrapper.text()).toContain("La contraseña debe tener al menos 8 caracteres");
    expect(registerUserMock).not.toHaveBeenCalled();
  });

  it("ties each error to its field and takes the user to the first one", async () => {
    const { wrapper } = await mountRegisterView();

    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(document.activeElement).toBe(wrapper.get("#name").element);
    expect(wrapper.get("#name").attributes("aria-describedby")).toBe("name-error");
    expect(wrapper.get("#name-error").text()).toBe("El nombre debe tener al menos 2 caracteres");
    expect(wrapper.get("#universityCode").attributes("aria-invalid")).toBe("true");
    expect(wrapper.get("#acceptDataPolicy").attributes("aria-invalid")).toBe("true");
  });

  it("names account fields for autofill, and keeps player data out of its suggestions", async () => {
    const { wrapper } = await mountRegisterView();

    expect(wrapper.get("#name").attributes()).toMatchObject({ name: "name", autocomplete: "name" });
    expect(wrapper.get("#email").attributes()).toMatchObject({
      name: "email",
      autocomplete: "email",
      spellcheck: "false",
    });
    expect(wrapper.get("#password").attributes()).toMatchObject({ name: "password", autocomplete: "new-password" });
    expect(wrapper.get("#universityCode").attributes()).toMatchObject({ autocomplete: "off", spellcheck: "false" });
    expect(wrapper.get("#program").attributes("autocomplete")).toBe("off");
    expect(wrapper.get("#semester").attributes("autocomplete")).toBe("off");
  });

  it("validates the additional player fields before submitting", async () => {
    const { wrapper } = await mountRegisterView();

    await fillBaseFields(wrapper);
    await wrapper.find("form").trigger("submit.prevent");

    expect(wrapper.text()).toContain("El código universitario es requerido");
    expect(wrapper.text()).toContain("El programa es requerido");
    expect(registerUserMock).not.toHaveBeenCalled();
  });

  it("requires accepting the data-treatment policy before submitting (RN-10/HU21)", async () => {
    const { wrapper } = await mountRegisterView();

    await fillBaseFields(wrapper);
    const [codigoInput, programaInput, semestreInput] = wrapper.findAll("fieldset input");
    await codigoInput.setValue("U12345");
    await programaInput.setValue("Ingeniería de Sistemas");
    await semestreInput.setValue("5");

    await wrapper.find("form").trigger("submit.prevent");

    expect(wrapper.text()).toContain("Debés aceptar la política de tratamiento de datos personales");
    expect(registerUserMock).not.toHaveBeenCalled();
  });

  it("registers a player, logs in automatically and redirects to their dashboard", async () => {
    registerUserMock.mockResolvedValue({
      id: "1",
      name: "Ana Torres",
      email: "ana@example.com",
      status: "ACTIVE",
      role: "PLAYER",
      createdAt: "2026-01-01T00:00:00.000Z",
      dataConsent: { accepted: true, date: "2026-01-01T00:00:00.000Z", version: "2026-08-01" },
    });
    loginUserMock.mockResolvedValue({
      token: "token-123",
      user: {
        id: "1",
        name: "Ana Torres",
        email: "ana@example.com",
        status: "ACTIVE",
        role: "PLAYER",
        createdAt: "2026-01-01T00:00:00.000Z",
        dataConsent: { accepted: true, date: "2026-01-01T00:00:00.000Z", version: "2026-08-01" },
      },
    });

    const { wrapper, router } = await mountRegisterView();
    await fillBaseFields(wrapper);

    const [codigoInput, programaInput, semestreInput] = wrapper.findAll("fieldset input");
    await codigoInput.setValue("U12345");
    await programaInput.setValue("Ingeniería de Sistemas");
    await semestreInput.setValue("5");
    await acceptDataPolicy(wrapper);

    await wrapper.find("form").trigger("submit.prevent");
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(registerUserMock).toHaveBeenCalledWith({
      name: "Ana Torres",
      email: "ana@example.com",
      password: "password123",
      acceptDataPolicy: true,
      role: "PLAYER",
      universityCode: "U12345",
      program: "Ingeniería de Sistemas",
      semester: 5,
    });
    expect(loginUserMock).toHaveBeenCalledWith({ email: "ana@example.com", password: "password123" });
    expect(router.currentRoute.value.path).toBe("/panel");
  });

  it("does not include player fields in the payload for COACH, and redirects to their dashboard", async () => {
    registerUserMock.mockResolvedValue({
      id: "2",
      name: "Carlos Ruiz",
      email: "carlos@example.com",
      status: "ACTIVE",
      role: "COACH",
      createdAt: "2026-01-01T00:00:00.000Z",
      dataConsent: { accepted: true, date: "2026-01-01T00:00:00.000Z", version: "2026-08-01" },
    });
    loginUserMock.mockResolvedValue({
      token: "token-123",
      user: {
        id: "2",
        name: "Carlos Ruiz",
        email: "carlos@example.com",
        status: "ACTIVE",
        role: "COACH",
        createdAt: "2026-01-01T00:00:00.000Z",
        dataConsent: { accepted: true, date: "2026-01-01T00:00:00.000Z", version: "2026-08-01" },
      },
    });

    const { wrapper, router } = await mountRegisterView();
    await selectRol(wrapper, "COACH");
    await wrapper.find('input[type="text"]').setValue("Carlos Ruiz");
    await wrapper.find('input[type="email"]').setValue("carlos@example.com");
    await wrapper.find('input[type="password"]').setValue("password123");
    await acceptDataPolicy(wrapper);

    await wrapper.find("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(registerUserMock).toHaveBeenCalledWith({
      name: "Carlos Ruiz",
      email: "carlos@example.com",
      password: "password123",
      acceptDataPolicy: true,
      role: "COACH",
    });
    expect(router.currentRoute.value.path).toBe("/panel");
  });

  it("shows the error message returned by the backend (e.g. duplicate email)", async () => {
    registerUserMock.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Ya existe una cuenta registrada con ese correo" } },
    });

    const { wrapper } = await mountRegisterView();
    await selectRol(wrapper, "COACH");
    await wrapper.find('input[type="text"]').setValue("Ana Torres");
    await wrapper.find('input[type="email"]').setValue("ana@example.com");
    await wrapper.find('input[type="password"]').setValue("password123");
    await acceptDataPolicy(wrapper);

    await wrapper.find("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Ya existe una cuenta registrada con ese correo");
  });

  it("shows a generic message when there is no response from the server (network error)", async () => {
    registerUserMock.mockRejectedValue(new Error("Network Error"));

    const { wrapper } = await mountRegisterView();
    await selectRol(wrapper, "COACH");
    await wrapper.find('input[type="text"]').setValue("Ana Torres");
    await wrapper.find('input[type="email"]').setValue("ana@example.com");
    await wrapper.find('input[type="password"]').setValue("password123");
    await acceptDataPolicy(wrapper);

    await wrapper.find("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("No se pudo conectar con el servidor");
  });
});
