import { flushPromises, mount } from "@vue/test-utils";
import { http, HttpResponse } from "msw";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../i18n";
import { installSessionExpiryHandler } from "../lib/sessionExpiry";
import { useAuthStore } from "../stores/auth";
import { useLocaleStore } from "../stores/locale";
import { API, fakeApi, useFakeApi } from "../test-support/fakeApi";
import AuditLogView from "./admin/AuditLogView.vue";
import LiveTournamentsView from "./tournament/LiveTournamentsView.vue";

// Pages against a fake server, through the real services/api.ts: what the
// other view tests (which mock the services) can't see.

vi.mock("../lib/pageLoad", () => ({ loadPage: vi.fn(), reloadPage: vi.fn() }));

import { loadPage } from "../lib/pageLoad";

useFakeApi();

const TOURNAMENT = {
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  name: "Liga Universitaria",
  startDate: "2026-09-19",
  endDate: "2026-09-26",
  status: "IN_PROGRESS",
  format: "swiss",
  roundsCount: 5,
  timeControl: null,
  restrictedProgram: null,
  minimumSemester: null,
  byePoints: 1,
  organizerId: "o-1",
  tiebreakCriteria: [],
  createdAt: "2026-09-01T00:00:00.000Z",
};

const entry = (id: string, action: string) => ({
  id,
  userId: "u-1",
  userName: "Admin Demo",
  action,
  detail: null,
  createdAt: "2026-09-19T12:00:00.000Z",
});

/** Signs in through the real login request: the server answers with the user and sets the session cookie. */
async function signIn(): Promise<void> {
  fakeApi.use(
    http.post(`${API}/auth/login`, () =>
      HttpResponse.json(
        { user: { id: "u-1", name: "Ana", email: "ana@uni.edu", role: "PLAYER" } },
        { headers: { "Set-Cookie": "torre_session=session.jwt; HttpOnly; Path=/api; SameSite=Lax" } },
      ),
    ),
  );
  await useAuthStore().login("ana@uni.edu", "password123");
}

async function mountPage(component: object, path = "/") {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/:any(.*)*", component: { template: "<div />" } }],
  });
  installSessionExpiryHandler(router);
  await router.push(path);
  const wrapper = mount(component, { global: { plugins: [router, i18n] } });
  await flushPromises();
  return wrapper;
}

describe("pages over HTTP", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  afterEach(async () => {
    useAuthStore().clearSession();
    await useLocaleStore().setLocale("es");
  });

  it("calls the API on the app's own site, with no token for script to steal, and lists what it answers", async () => {
    await signIn();
    let authorization: string | null = "unset";
    fakeApi.use(
      http.get(`${API}/tournaments/live`, ({ request }) => {
        authorization = request.headers.get("authorization");
        return HttpResponse.json([TOURNAMENT]);
      }),
    );

    const wrapper = await mountPage(LiveTournamentsView);

    expect(authorization).toBeNull();
    expect(wrapper.text()).toContain("Liga Universitaria");
    expect(Object.keys(localStorage)).not.toContain("torre.token");
  });

  it("words the server's error code in the reader's language", async () => {
    await useLocaleStore().setLocale("en");
    fakeApi.use(
      http.get(`${API}/tournaments/live`, () =>
        HttpResponse.json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" }, { status: 500 }),
      ),
    );

    const wrapper = await mountPage(LiveTournamentsView);

    expect(wrapper.get("[role='alert']").text()).toContain("Something went wrong on the server");
  });

  it("sends the user to sign in again, back to the same page, when the server ends the session", async () => {
    await signIn();
    fakeApi.use(
      http.get(`${API}/tournaments/live`, () =>
        HttpResponse.json({ error: "Tu sesión ya no es válida", code: "SESSION_REVOKED" }, { status: 401 }),
      ),
    );

    await mountPage(LiveTournamentsView, "/en-juego");

    expect(useAuthStore().isAuthenticated).toBe(false);
    expect(loadPage).toHaveBeenCalledWith("/login?redirect=/en-juego&expired=1");
  });

  it("asks for older audit entries with the cursor the server handed out", async () => {
    const cursors: (string | null)[] = [];
    fakeApi.use(
      http.get(`${API}/audit-logs`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        cursors.push(cursor);
        return cursor === "e-2"
          ? HttpResponse.json({ entries: [entry("e-3", "RESULT_CORRECTED")], nextCursor: null })
          : HttpResponse.json({
              entries: [entry("e-1", "ROLE_CHANGED"), entry("e-2", "PLAYER_WITHDRAWN")],
              nextCursor: "e-2",
            });
      }),
    );
    const wrapper = await mountPage(AuditLogView);

    await wrapper.get("button.btn-ghost").trigger("click");
    await flushPromises();

    expect(cursors).toEqual([null, "e-2"]);
    expect(wrapper.findAll("li")).toHaveLength(3);
    expect(wrapper.find("button.btn-ghost").exists()).toBe(false);
  });
});
