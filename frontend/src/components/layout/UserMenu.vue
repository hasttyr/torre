<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "reka-ui";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import { useAuthStore } from "../../stores/auth";
import { useLocaleStore } from "../../stores/locale";
import { useThemeStore } from "../../stores/theme";

// reka-ui's DropdownMenu owns the menu behavior: role="menu" with its items,
// arrow keys and typeahead, Escape or an outside click closing it, and focus
// returning to the avatar button afterwards.
const auth = useAuthStore();
const theme = useThemeStore();
const locale = useLocaleStore();
const router = useRouter();
const { t } = useI18n();

// Highlighted (hover or arrow keys) instead of an outline, like any menu.
const ITEM_CLASS =
  "flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium outline-none select-none data-[highlighted]:bg-accent/10";

/** Derives a two-letter avatar label from the user's full name (e.g. "Nilson Aldair Molina Rengifo" -> "NM"). */
const initials = computed((): string => {
  const fullName = auth.user?.name?.trim() ?? "";
  const words = fullName.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  const first = words[0][0];
  const middle = words[Math.floor(words.length / 2)][0];
  return `${first}${middle}`.toUpperCase();
});

/** Applies a preference without closing the menu, so its new value shows right there. */
function toggleInPlace(event: Event, toggle: () => void): void {
  event.preventDefault();
  toggle();
}

async function onLogout(): Promise<void> {
  await auth.logout();
  router.push("/");
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-[#17130a] transition-opacity hover:opacity-90"
      :aria-label="t('userMenu.menuAria', { name: auth.user?.name ?? '' })"
    >
      {{ initials }}
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="8"
        class="z-20 w-56 overflow-hidden rounded-lg border border-border bg-bg-elevated shadow-lg"
      >
        <DropdownMenuLabel class="border-b border-border-soft px-3 py-2.5">
          <p class="truncate text-sm font-semibold text-text">{{ auth.user?.name }}</p>
          <p class="truncate text-xs text-text-muted">{{ auth.user?.email }}</p>
          <p v-if="auth.user" class="truncate text-xs text-text-muted">{{ t(`roles.${auth.user.role}`) }}</p>
        </DropdownMenuLabel>

        <div class="py-1.5">
          <DropdownMenuItem :class="ITEM_CLASS" @select="toggleInPlace($event, () => theme.toggle())">
            <span class="text-text">{{ t("userMenu.theme") }}</span>
            <span
              class="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-text"
            >
              <svg
                v-if="theme.theme === 'dark'"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.75" />
                <path
                  d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.55 1.55M18.25 18.25l1.55 1.55M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.55-1.55M18.25 5.75l1.55-1.55"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                />
              </svg>
              <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                <path
                  d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linejoin="round"
                />
              </svg>
              {{ theme.theme === "dark" ? t("userMenu.dark") : t("userMenu.light") }}
            </span>
          </DropdownMenuItem>

          <DropdownMenuItem :class="ITEM_CLASS" @select="toggleInPlace($event, () => locale.toggle())">
            <span class="text-text">{{ t("userMenu.language") }}</span>
            <span class="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-text" translate="no">
              {{ locale.locale.toUpperCase() }}
            </span>
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator class="h-px bg-border-soft" />

        <div class="py-1.5">
          <DropdownMenuItem as-child :class="ITEM_CLASS">
            <RouterLink to="/cuenta" class="text-text">{{ t("userMenu.myProfile") }}</RouterLink>
          </DropdownMenuItem>
          <DropdownMenuItem :class="[ITEM_CLASS, 'text-error']" @select="onLogout">
            {{ t("userMenu.logout") }}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
