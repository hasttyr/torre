import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/auth", () => ({ logoutUser: vi.fn() }));
vi.mock("./pageLoad", () => ({ loadPage: vi.fn() }));

import { logoutUser } from "../services/auth";
import { useAuthStore } from "../stores/auth";
import { loadPage } from "./pageLoad";
import { signOut } from "./signOut";

describe("signOut", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("ends the session on the server and starts the app over, so nothing of this user stays in memory", async () => {
    useAuthStore().$patch({ user: { id: "u-1", name: "Ana", role: "PLAYER" } as never });

    await signOut();

    expect(logoutUser).toHaveBeenCalledOnce();
    expect(useAuthStore().isAuthenticated).toBe(false);
    expect(loadPage).toHaveBeenCalledWith("/");
  });

  it("still starts over when the server can't be reached", async () => {
    useAuthStore().$patch({ user: { id: "u-1", name: "Ana", role: "PLAYER" } as never });
    vi.mocked(logoutUser).mockRejectedValueOnce(new Error("offline"));

    await signOut();

    expect(loadPage).toHaveBeenCalledWith("/");
  });
});
