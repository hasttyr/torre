import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import TournamentCard from "./TournamentCard.vue";

const TOURNAMENT = {
  id: "3f2b8c1e-6a4d-4e2f-9b7a-1c5d8e9f0a2b",
  name: "Copa Otoño",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
  status: "IN_PROGRESS" as const,
};

function mountCard(props: Record<string, unknown> = {}, slot?: string) {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/:p(.*)*", component: { template: "<div />" } }],
  });
  return mount(TournamentCard, {
    props: { tournament: TOURNAMENT, ...props },
    slots: slot ? { default: slot } : {},
    global: { plugins: [router, i18n] },
  });
}

describe("TournamentCard", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("names the tournament, its dates and its state", () => {
    const wrapper = mountCard();

    expect(wrapper.get("h3").text()).toBe("Copa Otoño");
    expect(wrapper.text()).toContain("1 oct 2026");
    expect(wrapper.text()).toContain("3 oct 2026");
    expect(wrapper.get(".pill").text()).toBe("En curso");
  });

  it("is one link to the tournament's page when it has one", () => {
    const wrapper = mountCard({ to: `/torneos/${TOURNAMENT.id}` });

    expect(wrapper.element.tagName).toBe("A");
    expect(wrapper.attributes("href")).toBe(`/torneos/${TOURNAMENT.id}`);
  });

  it("fits the page's outline with the heading level it's given", () => {
    expect(mountCard({ headingLevel: 2 }).find("h2").text()).toBe("Copa Otoño");
  });

  it("shows what the page adds about it", () => {
    expect(mountCard({}, "<p>Tus jugadores: Ana</p>").text()).toContain("Tus jugadores: Ana");
  });
});
