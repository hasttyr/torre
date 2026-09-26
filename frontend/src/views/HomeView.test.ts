import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../i18n";
import es from "../i18n/locales/es.json";
import HomeView from "./HomeView.vue";

async function mountHome() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/:p(.*)*", component: { template: "<div />" } }],
  });
  await router.push("/");
  return mount(HomeView, { global: { plugins: [router, i18n] } });
}

const hrefs = (links: { attributes: (name: string) => string | undefined }[]) =>
  links.map((link) => link.attributes("href"));

describe("HomeView", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("doesn't dress its feature cards up as clickable: no hover lift on something that isn't a link", async () => {
    const cards = (await mountHome()).findAll("article");

    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.find("a").exists()).toBe(false);
      expect(card.classes().filter((name) => name.startsWith("hover:") || name === "transition-all")).toEqual([]);
    }
  });

  it("opens with the product's promise and two ways in: sign up, or see how it works first", async () => {
    const hero = (await mountHome()).get("main section");

    expect(hero.get("h1").text()).toContain(es.home.titleLine1);
    expect(hrefs(hero.findAll("a"))).toEqual(["/registro", "#funciona"]);
  });

  it("sums up what the system covers in four facts", async () => {
    const facts = (await mountHome()).get(`ul[aria-label="${es.home.factsLabel}"]`);

    expect(facts.findAll("li")).toHaveLength(4);
    expect(facts.text()).toContain(es.home.fact1Label);
  });

  it("shows each of the six features under #funciona, named by a heading", async () => {
    const features = (await mountHome()).get("#funciona");
    const titles = [1, 2, 3, 4, 5, 6].map((n) => es.home[`feature${n}Title` as keyof typeof es.home]);

    expect(features.findAll("article h3").map((heading) => heading.text())).toEqual(expect.arrayContaining(titles));
    expect(features.findAll("article")).toHaveLength(6);
  });

  it("keeps every illustration out of the accessibility tree: they show sample data, not content", async () => {
    const renders = (await mountHome()).findAll("[data-render]");

    // The hero's board, plus one per feature.
    expect(renders).toHaveLength(7);
    for (const render of renders) expect(render.attributes("aria-hidden")).toBe("true");
  });

  it("walks through the four steps of a tournament in order", async () => {
    const section = (await mountHome())
      .findAll("main > section")
      .find((candidate) => candidate.find("h2").exists() && candidate.get("h2").text() === es.home.stepsTitle)!;
    const steps = section.findAll("ol > li");

    expect(steps.map((step) => step.get("h3").text())).toEqual([
      es.home.step1Title,
      es.home.step2Title,
      es.home.step3Title,
      es.home.step4Title,
    ]);
  });

  it("closes with a call to sign up, and a way in for those who already have an account", async () => {
    const sections = (await mountHome()).findAll("main > section");
    const closing = sections[sections.length - 1]!;

    expect(closing.get("h2").text()).toBe(es.home.ctaTitle);
    expect(hrefs(closing.findAll("a"))).toEqual(["/registro", "/login"]);
  });

  it("ends with a footer to log in, sign up or read the source code", async () => {
    const footer = (await mountHome()).get("footer");

    expect(hrefs(footer.findAll("a"))).toEqual(
      expect.arrayContaining(["/login", "/registro", "https://github.com/hasttyr/torre"]),
    );
  });
});
