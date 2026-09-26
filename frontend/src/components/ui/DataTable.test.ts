import { createColumnHelper } from "@tanstack/vue-table";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { reactive } from "vue";

import { i18n } from "../../i18n";
import DataTable from "./DataTable.vue";

interface Row {
  id: string;
  name: string;
  age: number;
}

const columnHelper = createColumnHelper<Row>();
const columns = [
  columnHelper.accessor("name", { header: () => "Name" }),
  columnHelper.accessor("age", { header: () => "Age" }),
];

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({ id: `row-${i}`, name: `Player ${i}`, age: 20 + i }));
}

function mountTable(data: Row[], props: Record<string, unknown> = {}) {
  // @vue/test-utils' `mount()` can't infer DataTable's generic <TData> from
  // usage, so it falls back to `unknown` and rejects our Row-typed columns —
  // a known gap in generic-SFC + VTU typings, not a real type mismatch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mount(DataTable as any, {
    props: { columns, data, ...props },
    global: { plugins: [i18n] },
  });
}

describe("DataTable", () => {
  it("renders every row when there are fewer than a page's worth", () => {
    const wrapper = mountTable(makeRows(3));

    expect(wrapper.text()).toContain("Player 0");
    expect(wrapper.text()).toContain("Player 2");
    expect(wrapper.findAll("tbody tr")).toHaveLength(3);
  });

  it("shows the empty-state message when there's no data", () => {
    const wrapper = mountTable([], { emptyMessage: "Nothing here" });

    expect(wrapper.text()).toContain("Nothing here");
    expect(wrapper.findAll("tbody tr")).toHaveLength(0);
  });

  it("paginates when there are more rows than the page size", async () => {
    const wrapper = mountTable(makeRows(15), { pageSize: 10 });

    expect(wrapper.findAll("tbody tr")).toHaveLength(10);
    expect(wrapper.text()).toContain("Player 9");
    expect(wrapper.text()).not.toContain("Player 10");

    const nextBtn = wrapper.findAll("button").find((btn) => btn.text() === "Siguiente")!;
    await nextBtn.trigger("click");

    expect(wrapper.findAll("tbody tr")).toHaveLength(5);
    expect(wrapper.text()).toContain("Player 10");
    expect(wrapper.text()).not.toContain("Player 0");
  });

  it("sorts rows when a sortable header is clicked", async () => {
    const wrapper = mountTable([
      { id: "a", name: "Charlie", age: 30 },
      { id: "b", name: "Alice", age: 25 },
      { id: "c", name: "Bob", age: 28 },
    ]);

    const nameHeader = wrapper.findAll("th button").find((btn) => btn.text().includes("Name"))!;
    await nameHeader.trigger("click");

    let cells = wrapper.findAll("tbody tr td:first-child");
    expect(cells.map((cell) => cell.text())).toEqual(["Alice", "Bob", "Charlie"]);

    await nameHeader.trigger("click");
    cells = wrapper.findAll("tbody tr td:first-child");
    expect(cells.map((cell) => cell.text())).toEqual(["Charlie", "Bob", "Alice"]);
  });

  it("filters rows via the search box (global filter)", async () => {
    const wrapper = mountTable(makeRows(5));

    await wrapper.get("input[type='search']").setValue("Player 3");

    const rows = wrapper.findAll("tbody tr");
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain("Player 3");
  });

  it("announces how many rows the search left, for screen readers", async () => {
    const wrapper = mountTable(makeRows(12));
    const status = () => wrapper.get("[role='status']").text();
    expect(status()).toBe("");

    await wrapper.get("input[type='search']").setValue("Player 1");
    expect(status()).toBe("3 resultados"); // Player 1, 10, 11

    await wrapper.get("input[type='search']").setValue("nadie");
    expect(status()).toBe("Sin resultados");
    expect(wrapper.get("input[type='search']").attributes()).toMatchObject({
      autocomplete: "off",
      spellcheck: "false",
    });
  });

  it("hides the search box when searchable is false", () => {
    const wrapper = mountTable(makeRows(3), { searchable: false });

    expect(wrapper.find("input[type='search']").exists()).toBe(false);
  });

  it("reflects an in-place mutation of the data array (push/index assignment)", async () => {
    // Regression test: TanStack Table memoizes its row model by the `data`
    // array's reference. A caller that pushes/reassigns an index instead of
    // replacing the array must still see the table update.
    const data = reactive(makeRows(2));
    const wrapper = mountTable(data as Row[]);

    expect(wrapper.findAll("tbody tr")).toHaveLength(2);

    data.push({ id: "row-2", name: "Player 2", age: 99 });
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll("tbody tr")).toHaveLength(3);
    expect(wrapper.text()).toContain("Player 2");

    data[0] = { id: "row-0", name: "Renamed", age: 1 };
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Renamed");
  });
});
