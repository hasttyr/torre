<script setup lang="ts" generic="TData extends RowData">
import {
  FlexRender,
  useTable,
  type ColumnDef,
  type PaginationState,
  type RowData,
  type SortDirection,
  type SortingState,
} from "@tanstack/vue-table";
import { computed, ref, useId, watch } from "vue";
import { useI18n } from "vue-i18n";

import { useQueryParam } from "../../lib/useQueryParam";
import { dataTableFeatures, type DataTableFeatures } from "./dataTableFeatures";

// Headless by design (TanStack Table owns sorting/filtering/pagination
// *state*, never markup or styling): every <th>/<td> below is styled with
// this project's own Tailwind primitives, the same as the tables built by
// hand (standings, pairings), so a DataTable and a plain <table> read
// identically from the outside.
const props = withDefaults(
  defineProps<{
    // TanStack's own ColumnDef is invariant enough in its value type that a
    // generic wrapper can't accept a column list typed per-column (string,
    // number, ...) as `ColumnDef<TData, unknown>[]` — this `any` is the
    // documented escape hatch for exactly that, not a shortcut.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    columns: ColumnDef<DataTableFeatures, TData, any>[];
    data: TData[];
    searchPlaceholder?: string;
    emptyMessage?: string;
    pageSize?: number;
    // Turns off the search box for small, already-filtered lists where a
    // search input would just be noise (e.g. a single club's roster).
    searchable?: boolean;
    // Keeps search, sort and page in the URL (?buscar, ?orden, ?pagina) so a
    // reload or a shared link reopens the table as it was. For a page's one
    // main table: two synced tables would share the same params.
    syncUrl?: boolean;
  }>(),
  { pageSize: 10, searchable: true, syncUrl: false },
);

// A page renders a column's cells itself with a `#cell-<column id>` slot
// (a control, a badge…), given the row and the cell's value; any other
// column renders as its definition says.
defineSlots<{ [slot: `cell-${string}`]: (props: { row: TData; value: unknown }) => unknown }>();

const { t } = useI18n();

const searchInputId = useId();
const globalFilter = ref("");
const sorting = ref<SortingState>([]);
const pagination = ref<PaginationState>({ pageIndex: 0, pageSize: props.pageSize });

/** "-age" <-> [{ id: "age", desc: true }]; one sorted column at a time. */
const parseSort = (param: string): SortingState =>
  param ? [{ id: param.replace(/^-/, ""), desc: param.startsWith("-") }] : [];
function formatSort(state: SortingState): string {
  const [column] = state;
  if (!column) return "";
  return column.desc ? `-${column.id}` : column.id;
}

if (props.syncUrl) {
  // The search box keeps its own ref (a URL-backed value would lag behind
  // fast typing): the URL is read once here, then written as state changes.
  const searchParam = useQueryParam("buscar");
  const sortParam = useQueryParam("orden");
  const pageParam = useQueryParam("pagina", "1");
  globalFilter.value = searchParam.value;
  sorting.value = parseSort(sortParam.value);
  pagination.value.pageIndex = Math.max(0, Math.trunc(Number(pageParam.value)) - 1 || 0);
  watch(globalFilter, (value) => (searchParam.value = value.trim()));
  watch(sorting, (value) => (sortParam.value = formatSort(value)));
  watch(
    () => pagination.value.pageIndex,
    (index) => (pageParam.value = String(index + 1)),
  );
}

// TanStack Table memoizes each row model internally, keyed on the `data`
// array's *reference* — it never inspects contents. A caller that mutates
// its array in place (`.push`, index assignment) keeps the same reference,
// so the table would silently keep showing stale rows. Spreading here reads
// every index (and `.length`), so Vue's reactivity still invalidates this
// computed on an in-place mutation, and TanStack always gets a fresh array
// to compare against.
const tableData = computed(() => [...props.data]);

const table = useTable<DataTableFeatures, TData>({
  features: dataTableFeatures,
  data: tableData,
  columns: computed(() => props.columns),
  state: {
    get sorting() {
      return sorting.value;
    },
    get globalFilter() {
      return globalFilter.value;
    },
    get pagination() {
      return pagination.value;
    },
  },
  onSortingChange: (updater) => {
    sorting.value = typeof updater === "function" ? updater(sorting.value) : updater;
  },
  onGlobalFilterChange: (updater) => {
    globalFilter.value = typeof updater === "function" ? updater(globalFilter.value) : updater;
  },
  onPaginationChange: (updater) => {
    pagination.value = typeof updater === "function" ? updater(pagination.value) : updater;
  },
});

const ARIA_SORT: Record<SortDirection, "ascending" | "descending"> = { asc: "ascending", desc: "descending" };

/** aria-sort for a sortable header: the sorted column's direction, "none" for the others. */
function ariaSort(isSorted: false | SortDirection, canSort: boolean): "ascending" | "descending" | "none" | undefined {
  if (!canSort) return undefined;
  return isSorted ? ARIA_SORT[isSorted] : "none";
}

/**
 * A column's name as plain text: the label a phone shows beside each cell.
 * The project's headers are strings or `() => t(...)`, which read no context.
 */
function columnLabel(column: { columnDef: { header?: unknown } }): string {
  const header = column.columnDef.header;
  if (typeof header === "function") return String((header as () => unknown)() ?? "");
  return typeof header === "string" ? header : "";
}

// On a phone the header row is only the sort controls: none, no row.
const sortable = computed(() => table.getAllLeafColumns().some((column) => column.getCanSort()));

const pageIndex = computed(() => pagination.value.pageIndex);
const pageCount = computed(() => table.getPageCount());

const filterStatus = computed(() => {
  if (!globalFilter.value.trim()) return "";
  const count = table.getFilteredRowModel().rows.length;
  return t("dataTable.resultCount", { count }, count);
});
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="searchable" class="field max-w-xs">
      <label :for="searchInputId" class="sr-only">{{ searchPlaceholder ?? t("dataTable.searchLabel") }}</label>
      <input
        :id="searchInputId"
        v-model="globalFilter"
        type="search"
        name="tableSearch"
        autocomplete="off"
        spellcheck="false"
        :placeholder="searchPlaceholder ?? t('dataTable.searchLabel')"
      />
      <!-- The rows change silently as the user types: say how many are left. -->
      <p class="sr-only" role="status">{{ filterStatus }}</p>
    </div>

    <!-- Below sm each row stacks into a short card and the header row turns
         into the sort controls (style.css, .data-table). The explicit roles
         keep it a table for screen readers once the CSS changes its display. -->
    <div class="overflow-x-auto">
      <table class="data-table w-full border-collapse" role="table">
        <thead role="rowgroup" :class="{ 'max-sm:hidden': !sortable }">
          <tr
            v-for="headerGroup in table.getHeaderGroups()"
            :key="headerGroup.id"
            role="row"
            :data-sort-label="t('dataTable.sortBy')"
          >
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              role="columnheader"
              class="text-left text-caption font-semibold text-text-muted sm:border-b sm:border-border-soft sm:px-3 sm:py-3 sm:pointer-coarse:py-0"
              :class="{ 'max-sm:hidden': !header.column.getCanSort() || !columnLabel(header.column) }"
              :aria-sort="ariaSort(header.column.getIsSorted(), header.column.getCanSort())"
            >
              <button
                v-if="header.column.getCanSort()"
                type="button"
                class="inline-flex items-center gap-1 font-semibold hover:text-accent pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                @click="header.column.getToggleSortingHandler()?.($event)"
              >
                <FlexRender :header="header" />
                <span aria-hidden="true">{{
                  { asc: "▲", desc: "▼" }[header.column.getIsSorted() as string] ?? ""
                }}</span>
              </button>
              <FlexRender v-else :header="header" />
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            role="row"
            class="transition-colors hover:bg-text/3"
          >
            <td
              v-for="cell in row.getAllCells()"
              :key="cell.id"
              role="cell"
              class="text-body-sm sm:border-b sm:border-border-soft/60 sm:px-3 sm:py-3.5"
              :data-label="columnLabel(cell.column)"
            >
              <slot :name="`cell-${cell.column.id}`" :row="cell.row.original" :value="cell.getValue()">
                <FlexRender :cell="cell" />
              </slot>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-if="table.getRowModel().rows.length === 0" class="py-6 text-center text-sm text-text-muted">
        {{ emptyMessage ?? t("dataTable.noResults") }}
      </p>
    </div>

    <div v-if="pageCount > 1" class="flex items-center justify-between gap-3 text-sm">
      <button type="button" class="btn btn-ghost" :disabled="!table.getCanPreviousPage()" @click="table.previousPage()">
        {{ t("dataTable.previous") }}
      </button>
      <span class="text-text-muted">{{ t("dataTable.pageStatus", { current: pageIndex + 1, total: pageCount }) }}</span>
      <button type="button" class="btn btn-ghost" :disabled="!table.getCanNextPage()" @click="table.nextPage()">
        {{ t("dataTable.next") }}
      </button>
    </div>
  </div>
</template>
