import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import { i18n } from "../../i18n";
import BarList from "./BarList.vue";
import LineChart from "./LineChart.vue";
import ResultSplitBar from "./ResultSplitBar.vue";

const global = { plugins: [i18n] };

describe("BarList", () => {
  it("scales bars to the largest value, keeps a stub for zero, and prints every value", () => {
    const wrapper = mount(BarList, {
      global,
      props: {
        label: "Torneos por estado",
        items: [
          { key: "a", label: "En curso", value: 4 },
          { key: "b", label: "Finalizado", value: 2, valueLabel: "dos", detail: "1 inactiva" },
          { key: "c", label: "Preliminar", value: 0 },
        ],
      },
    });

    const bars = wrapper.findAll(".bg-chart-1");
    expect(bars.map((bar) => bar.attributes("style"))).toEqual(["width: 85%;", "width: 42.5%;", "width: 0%;"]);
    expect(bars[2].classes()).toContain("min-w-[2px]");
    expect(wrapper.text()).toContain("dos");
    expect(wrapper.text()).toContain("1 inactiva");
    expect(wrapper.get("ul").attributes("aria-label")).toBe("Torneos por estado");
  });
});

describe("ResultSplitBar", () => {
  it("sizes segments by count, skips empty ones and states the split in text", () => {
    const wrapper = mount(ResultSplitBar, {
      global,
      props: { tally: { wins: 3, draws: 0, losses: 1 }, label: "Con blancas" },
    });

    expect(wrapper.findAll("[style*='flex-grow']")).toHaveLength(2);
    expect(wrapper.text()).toContain("3 V · 0 T · 1 D");
    expect(wrapper.get("[role='img']").attributes("aria-label")).toBe("Con blancas: 3 V · 0 T · 1 D");
  });

  it("reads as white/black results from the board's perspective", () => {
    const wrapper = mount(ResultSplitBar, {
      global,
      props: { tally: { wins: 2, draws: 1, losses: 3 }, label: "Ronda 1", perspective: "board" },
    });

    expect(wrapper.text()).toContain("2 blancas · 1 tablas · 3 negras");
  });
});

describe("LineChart", () => {
  const points = [
    { key: "t1", label: "mar 26", value: 0.5, tooltip: ["Copa", "Rendimiento: 50 %"] },
    { key: "t2", label: "jun 26", value: 0.8, tooltip: ["Liga", "Rendimiento: 80 %"] },
  ];

  it("draws one focusable marker per point and labels the last value", () => {
    const wrapper = mount(LineChart, {
      global,
      props: { points, label: "Evolución", formatValue: (value: number) => `${value * 100}%` },
    });

    const markers = wrapper.findAll("circle");
    expect(markers).toHaveLength(2);
    expect(markers[0].attributes("tabindex")).toBe("0");
    expect(markers[1].attributes("aria-label")).toBe("Liga, Rendimiento: 80 %");
    expect(wrapper.text()).toContain("80%");
  });

  it("shows a point's tooltip on keyboard focus and hides it on blur", async () => {
    const wrapper = mount(LineChart, {
      global,
      props: { points, label: "Evolución", formatValue: (value: number) => `${value}` },
    });

    await wrapper.findAll("circle")[0].trigger("focus");
    expect(wrapper.get("[role='tooltip']").text()).toContain("Copa");

    await wrapper.findAll("circle")[0].trigger("blur");
    expect(wrapper.find("[role='tooltip']").exists()).toBe(false);
  });
});
