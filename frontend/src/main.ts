import { createPinia } from "pinia";
import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { i18n } from "./i18n";
import { installSessionExpiryHandler } from "./lib/sessionExpiry";
import { installStaleChunkRecovery } from "./lib/staleChunks";
import { router } from "./router";
import { useLocaleStore } from "./stores/locale";

const pinia = createPinia();
const app = createApp(App).use(pinia).use(router).use(i18n);
installSessionExpiryHandler(router);
installStaleChunkRecovery(router);

// The saved language is applied before the first render, on every page
// (English's messages are fetched first if that's the saved choice). A
// promise chain on purpose, not a top-level await: an entry that awaits
// makes the bundler split every module it shares with a lazy page into its
// own file (so a page can't deadlock waiting on it), tripling the files
// every page needs at startup.
const locale = useLocaleStore(pinia);
locale
  .init()
  // English couldn't load (offline, say): start in Spanish rather than not at all.
  .catch(() => locale.$patch({ locale: "es" }))
  .finally(() => app.mount("#app")); // NOSONAR: top-level await avoided on purpose, see above
