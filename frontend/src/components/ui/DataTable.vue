<script setup lang="ts" generic="TData">
import {
  FlexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/vue-table";
import { computed, ref, useId } from "vue";
import { useI18n } from "vue-i18n";

// Headless by design (TanStack Table owns sorting/filtering/pagination
// *state*, never markup or styling): every <th>/<td> below is styled with
// this project's own Tailwind primitives, the same as every other table
// built by hand (see PlayerEnrollmentPanel.vue), so a DataTable and a plain
// <table> read identically from the outside.
const props = withDefaults(
  defineProps<{
    // TanStack's own ColumnDef is invariant enough in its value type that a
    // generic wrapper can't accept a column list typed per-column (string,
    // number, ...) as `ColumnDef<TData, unknown>[]` — this `any` is the
    // documented escape hatch for exactly that, not a shortcut.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    columns: ColumnDef<TData, any>[];
    data: TData[];
    searchPlaceholder?: string;
    emptyMessage?: string;
    pageSize?: number;
    // Turns off the search box for small, already-filtered lists where a
    // search input would just be noise (e.g. a single club's roster).
    searchable?: boolean;
  }>(),
  { pageSize: 10, searchable: true },
);

const { t } = useI18n();

const searchInputId = useId();
const globalFilter = ref("");
const sorting = ref<SortingState>([]);

// TanStack Table memoizes each row model internally, keyed on the `data`
// array's *reference* — it never inspects contents. A caller that mutates
// its array in place (`.push`, index assignment) keeps the same reference,
// so the table would silently keep showing stale rows. Spreading here reads
// every index (and `.length`), so Vue's reactivity still invalidates this
// computed on an in-place mutation, and TanStack always gets a fresh array
// to compare against.
const tableData = computed(() => [...props.data]);

const table = useVueTable({
  get data() {
    return tableData.value;
  },
  get columns() {
    return props.columns;
  },
  state: {
    get sorting() {
      return sorting.value;
    },
    get globalFilter() {
      return globalFilter.value;
    },
  },
  onSortingChange: (updater) => {
    sorting.value = typeof updater === "function" ? updater(sorting.value) : updater;
  },
  onGlobalFilterChange: (updater) => {
    globalFilter.value = typeof updater === "function" ? updater(globalFilter.value) : updater;
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  initialState: { pagination: { pageSize: props.pageSize } },
});

const pageIndex = computed(() => table.getState().pagination.pageIndex);
const pageCount = computed(() => table.getPageCount());
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="searchable" class="field max-w-xs">
      <label :for="searchInputId" class="sr-only">{{ searchPlaceholder ?? t("dataTable.searchLabel") }}</label>
      <input
        :id="searchInputId"
        v-model="globalFilter"
        type="search"
        :placeholder="searchPlaceholder ?? t('dataTable.searchLabel')"
      />
    </div>

    <div class="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
      <table class="w-full border-collapse">
        <thead>
          <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              class="border-b border-border-soft px-2.5 py-2 text-left text-sm"
            >
              <button
                v-if="header.column.getCanSort()"
                type="button"
                class="inline-flex items-center gap-1 font-semibold hover:text-accent"
                @click="header.column.getToggleSortingHandler()?.($event)"
              >
                <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                <span aria-hidden="true">{{
                  { asc: "▲", desc: "▼" }[header.column.getIsSorted() as string] ?? ""
                }}</span>
              </button>
              <FlexRender v-else :render="header.column.columnDef.header" :props="header.getContext()" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in table.getRowModel().rows" :key="row.id">
            <td
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              class="border-b border-border-soft px-2.5 py-2 text-sm"
            >
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
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
