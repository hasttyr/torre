<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import { navLinks } from "../../lib/navigation";
import { prefetchRoute } from "../../lib/prefetchRoute";
import { useAuthStore } from "../../stores/auth";

// On phones a signed-in user's sections sit in a floating bar at the
// bottom, in reach of the thumb: the same links as the header's desktop
// nav (a role has at most five), each with a glyph above its name.
const auth = useAuthStore();
const router = useRouter();
const { t } = useI18n();

const items = computed(() => navLinks(router.getRoutes(), auth.user?.role));

// One outline glyph per section, keyed by its label. Anything new without
// a glyph gets the plain dot until it's given one.
const GLYPHS: Record<string, string> = {
  "header.panel": "M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z",
  "header.myTournaments": "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M9 20h6M10 17h4",
  "header.tournaments": "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M9 20h6M10 17h4",
  "header.clubs": "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z",
  "header.live":
    "M12 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8",
  "header.myPlayers":
    "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6 6 0 0 1 3 6",
  "header.users": "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0",
  "header.auditLog": "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
};
const DOT = "M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6";
</script>

<template>
  <nav
    v-if="auth.isAuthenticated && items.length > 0"
    :aria-label="t('header.sections')"
    data-tab-bar
    class="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 lg:hidden"
  >
    <ul
      class="glass-strong m-0 mx-auto flex max-w-md list-none justify-around gap-0.5 rounded-[28px] p-1 shadow-lg ring-1 ring-glass-border"
    >
      <li v-for="item in items" :key="item.to" class="min-w-0 flex-1">
        <RouterLink
          :to="item.to"
          class="flex min-h-14 flex-col items-center justify-center gap-1 rounded-[22px] px-0.5 text-micro font-medium tracking-[-0.01em] text-text-muted no-underline transition-[background-color,color,scale] duration-200 active:scale-95 [&.router-link-active]:bg-surface [&.router-link-active]:text-text [&.router-link-active]:shadow-md"
          @touchstart.passive="prefetchRoute(router, item.to)"
          @focus="prefetchRoute(router, item.to)"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
            <path
              :d="GLYPHS[item.labelKey] ?? DOT"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="max-w-full truncate">{{ t(item.labelKey) }}</span>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
