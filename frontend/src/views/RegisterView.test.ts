import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "../i18n";
import RegisterView from "./RegisterView.vue";

vi.mock("../services/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/auth")>();
  return {
    ...actual,
    registerUser: vi.fn(),
  };
});

import { registerUser } from "../services/auth";

const registerUserMock = vi.mocked(registerUser);

async function fillBaseFields(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('input[type="text"]').setValue("Ana Torres");
  await wrapper.find('input[type="email"]').setValue("ana@example.com");
  await wrapper.find('input[type="password"]').setValue("password123");
}

async function selectRol(wrapper: ReturnType<typeof mount>, rol: string) {
  await wrapper.find(`input[type="radio"][value="${rol}"]`).setValue();
}

describe("RegisterView", () => {
  beforeEach(() => {
    registerUserMock.mockReset();
  });

  it("shows player fields by default (initial role JUGADOR)", () => {
    const wrapper = mount(RegisterView, { global: { plugins: [i18n] } });

    expect(wrapper.find("fieldset").exists()).toBe(true);
    expect(wrapper.text()).toContain("Datos de jugador");
  });

  it("hides player fields when another role is chosen", async () => {
    const wrapper = mount(RegisterView, { global: { plugins: [i18n] } });

    await selectRol(wrapper, "ORGANIZADOR");

    expect(wrapper.find("fieldset").exists()).toBe(false);
  });

  it("shows validation errors and does not call the backend when the form is empty", async () => {
    const wrapper = mount(RegisterView, { global: { plugins: [i18n] } });

    await selectRol(wrapper, "ORGANIZADOR");
    await wrapper.find("form").trigger("submit.prevent");

    expect(wrapper.text()).toContain("El nombre debe tener al menos 2 caracteres");
    expect(wrapper.text()).toContain("El correo no es válido");
    expect(wrapper.text()).toContain("La contraseña debe tener al menos 8 caracteres");
    expect(registerUserMock).not.toHaveBeenCalled();
  });

  it("validates the additional player fields before submitting", async () => {
    const wrapper = mount(RegisterView, { global: { plugins: [i18n] } });

    await fillBaseFields(wrapper);
    await wrapper.find("form").trigger("submit.prevent");

    expect(wrapper.text()).toContain("El código universitario es requerido");
    expect(wrapper.text()).toContain("El programa es requerido");
    expect(registerUserMock).not.toHaveBeenCalled();
  });

  it("sends the correct payload and shows success for a valid player registration", async () => {
    registerUserMock.mockResolvedValue({
      id: "1",
      name: "Ana Torres",
      email: "ana@example.com",
      status: "ACTIVO",
      role: "JUGADOR",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const wrapper = mount(RegisterView, { global: { plugins: [i18n] } });
    await fillBaseFields(wrapper);

    const [codigoInput, programaInput, semestreInput] = wrapper.findAll("fieldset input");
    await codigoInput.setValue("U12345");
    await programaInput.setValue("Ingeniería de Sistemas");
    await semestreInput.setValue("5");

    await wrapper.find("form").trigger("submit.prevent");
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(registerUserMock).toHaveBeenCalledWith({
      name: "Ana Torres",
      email: "ana@example.com",
      password: "password123",
      role: "JUGADOR",
      universityCode: "U12345",
      program: "Ingeniería de Sistemas",
      semester: 5,
    });
    expect(wrapper.text()).toContain("Cuenta creada para ana@example.com");
  });

  it("does not include player fields in the payload for other roles", async () => {
    registerUserMock.mockResolvedValue({
      id: "2",
      name: "Carlos Ruiz",
      email: "carlos@example.com",
      status: "ACTIVO",
      role: "ORGANIZADOR",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const wrapper = mount(RegisterView, { global: { plugins: [i18n] } });
    await selectRol(wrapper, "ORGANIZADOR");
    await wrapper.find('input[type="text"]').setValue("Carlos Ruiz");
    await wrapper.find('input[type="email"]').setValue("carlos@example.com");
    await wrapper.find('input[type="password"]').setValue("password123");

    await wrapper.find("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(registerUserMock).toHaveBeenCalledWith({
      name: "Carlos Ruiz",
      email: "carlos@example.com",
      password: "password123",
      role: "ORGANIZADOR",
    });
  });

  it("shows the error message returned by the backend (e.g. duplicate email)", async () => {
    registerUserMock.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Ya existe una cuenta registrada con ese correo" } },
    });

    const wrapper = mount(RegisterView, { global: { plugins: [i18n] } });
    await selectRol(wrapper, "ORGANIZADOR");
    await wrapper.find('input[type="text"]').setValue("Ana Torres");
    await wrapper.find('input[type="email"]').setValue("ana@example.com");
    await wrapper.find('input[type="password"]').setValue("password123");

    await wrapper.find("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Ya existe una cuenta registrada con ese correo");
  });

  it("shows a generic message when there is no response from the server (network error)", async () => {
    registerUserMock.mockRejectedValue(new Error("Network Error"));

    const wrapper = mount(RegisterView, { global: { plugins: [i18n] } });
    await selectRol(wrapper, "ORGANIZADOR");
    await wrapper.find('input[type="text"]').setValue("Ana Torres");
    await wrapper.find('input[type="email"]').setValue("ana@example.com");
    await wrapper.find('input[type="password"]').setValue("password123");

    await wrapper.find("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("No se pudo conectar con el servidor");
  });
});
