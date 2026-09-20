import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import { useAuthStore } from "../../stores/auth";
import UsersView from "./UsersView.vue";

vi.mock("../../services/adminUsers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/adminUsers")>();
  return {
    ...actual,
    listUsers: vi.fn(),
    updateUserRole: vi.fn(),
    updateUserStatus: vi.fn(),
  };
});

import { listUsers, updateUserRole, updateUserStatus } from "../../services/adminUsers";

const listUsersMock = vi.mocked(listUsers);
const updateUserRoleMock = vi.mocked(updateUserRole);
const updateUserStatusMock = vi.mocked(updateUserStatus);

const DATA_CONSENT = { accepted: true, date: "2026-01-01T00:00:00.000Z", version: "2026-08-01" };

const ADMIN = {
  id: "admin-1",
  name: "Admin Demo",
  email: "admin@test.com",
  status: "ACTIVE",
  role: "ADMINISTRATOR",
  createdAt: "2026-01-01T00:00:00.000Z",
  dataConsent: DATA_CONSENT,
};

const ORGANIZER = {
  id: "user-2",
  name: "Carlos Ruiz",
  email: "carlos@example.com",
  status: "ACTIVE",
  role: "ORGANIZER",
  createdAt: "2026-01-01T00:00:00.000Z",
  dataConsent: DATA_CONSENT,
};

async function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/usuarios", component: UsersView }],
  });
  router.push("/usuarios");
  await router.isReady();

  const auth = useAuthStore();
  auth.$patch({ token: "token", user: ADMIN });

  const wrapper = mount(UsersView, { global: { plugins: [router, i18n] } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper.vm.$nextTick();
  return { wrapper };
}

describe("UsersView", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("lists every user with their role and status", async () => {
    listUsersMock.mockResolvedValue([ADMIN, ORGANIZER]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("Carlos Ruiz");
    expect(wrapper.text()).toContain("carlos@example.com");
  });

  it("changes a user's role from the row's selector", async () => {
    listUsersMock.mockResolvedValue([ADMIN, ORGANIZER]);
    updateUserRoleMock.mockResolvedValue({ ...ORGANIZER, role: "ARBITER" });

    const { wrapper } = await mountView();

    const selects = wrapper.findAll("select");
    const organizerSelect = selects[1];
    await organizerSelect.setValue("ARBITER");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(updateUserRoleMock).toHaveBeenCalledWith("user-2", "ARBITER");
  });

  it("deactivates a user after confirmation", async () => {
    listUsersMock.mockResolvedValue([ADMIN, ORGANIZER]);
    updateUserStatusMock.mockResolvedValue({ ...ORGANIZER, status: "INACTIVE" });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    const { wrapper } = await mountView();

    // buttons[0] is the ADMIN row's own (disabled) toggle; buttons[1] is the organizer's.
    const deactivateBtn = wrapper.findAll("tbody button")[1];
    await deactivateBtn.trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(updateUserStatusMock).toHaveBeenCalledWith("user-2", "INACTIVE");
    expect(wrapper.text()).toContain("Inactiva");

    confirmSpy.mockRestore();
  });

  it("disables role and status controls for the current admin's own row", async () => {
    listUsersMock.mockResolvedValue([ADMIN, ORGANIZER]);

    const { wrapper } = await mountView();

    const selects = wrapper.findAll("select");
    expect(selects[0].attributes("disabled")).toBeDefined();

    const buttons = wrapper.findAll("tbody button");
    expect(buttons[0].attributes("disabled")).toBeDefined();
  });

  it("shows an error when loading fails", async () => {
    listUsersMock.mockRejectedValue(new Error("network error"));

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("No se pudieron cargar los usuarios");
  });
});
