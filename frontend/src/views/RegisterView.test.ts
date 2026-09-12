import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("muestra los campos de jugador por default (rol inicial JUGADOR)", () => {
    const wrapper = mount(RegisterView);

    expect(wrapper.find("fieldset").exists()).toBe(true);
    expect(wrapper.text()).toContain("Datos de jugador");
  });

  it("oculta los campos de jugador cuando se elige otro rol", async () => {
    const wrapper = mount(RegisterView);

    await selectRol(wrapper, "ORGANIZADOR");

    expect(wrapper.find("fieldset").exists()).toBe(false);
  });

  it("muestra errores de validación y no llama al backend si el formulario está vacío", async () => {
    const wrapper = mount(RegisterView);

    await selectRol(wrapper, "ORGANIZADOR");
    await wrapper.find("form").trigger("submit.prevent");

    expect(wrapper.text()).toContain("El nombre debe tener al menos 2 caracteres");
    expect(wrapper.text()).toContain("El correo no es válido");
    expect(wrapper.text()).toContain("La contraseña debe tener al menos 8 caracteres");
    expect(registerUserMock).not.toHaveBeenCalled();
  });

  it("valida los campos adicionales de jugador antes de enviar", async () => {
    const wrapper = mount(RegisterView);

    await fillBaseFields(wrapper);
    await wrapper.find("form").trigger("submit.prevent");

    expect(wrapper.text()).toContain("El código universitario es requerido");
    expect(wrapper.text()).toContain("El programa es requerido");
    expect(registerUserMock).not.toHaveBeenCalled();
  });

  it("envía el payload correcto y muestra éxito para un registro de jugador válido", async () => {
    registerUserMock.mockResolvedValue({
      id: "1",
      nombre: "Ana Torres",
      email: "ana@example.com",
      estado: "ACTIVO",
      rol: "JUGADOR",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const wrapper = mount(RegisterView);
    await fillBaseFields(wrapper);

    const [codigoInput, programaInput, semestreInput] = wrapper.findAll("fieldset input");
    await codigoInput.setValue("U12345");
    await programaInput.setValue("Ingeniería de Sistemas");
    await semestreInput.setValue("5");

    await wrapper.find("form").trigger("submit.prevent");
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(registerUserMock).toHaveBeenCalledWith({
      nombre: "Ana Torres",
      email: "ana@example.com",
      password: "password123",
      rol: "JUGADOR",
      codigoUniversitario: "U12345",
      programa: "Ingeniería de Sistemas",
      semestre: 5,
    });
    expect(wrapper.text()).toContain("Cuenta creada para ana@example.com");
  });

  it("no incluye campos de jugador en el payload para otros roles", async () => {
    registerUserMock.mockResolvedValue({
      id: "2",
      nombre: "Carlos Ruiz",
      email: "carlos@example.com",
      estado: "ACTIVO",
      rol: "ORGANIZADOR",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const wrapper = mount(RegisterView);
    await selectRol(wrapper, "ORGANIZADOR");
    await wrapper.find('input[type="text"]').setValue("Carlos Ruiz");
    await wrapper.find('input[type="email"]').setValue("carlos@example.com");
    await wrapper.find('input[type="password"]').setValue("password123");

    await wrapper.find("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(registerUserMock).toHaveBeenCalledWith({
      nombre: "Carlos Ruiz",
      email: "carlos@example.com",
      password: "password123",
      rol: "ORGANIZADOR",
    });
  });

  it("muestra el mensaje de error que devuelve el backend (p. ej. correo duplicado)", async () => {
    registerUserMock.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Ya existe una cuenta registrada con ese correo" } },
    });

    const wrapper = mount(RegisterView);
    await selectRol(wrapper, "ORGANIZADOR");
    await wrapper.find('input[type="text"]').setValue("Ana Torres");
    await wrapper.find('input[type="email"]').setValue("ana@example.com");
    await wrapper.find('input[type="password"]').setValue("password123");

    await wrapper.find("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Ya existe una cuenta registrada con ese correo");
  });

  it("muestra un mensaje genérico si no hay respuesta del servidor (error de red)", async () => {
    registerUserMock.mockRejectedValue(new Error("Network Error"));

    const wrapper = mount(RegisterView);
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
