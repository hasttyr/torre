import { createPinia } from "pinia";
import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { i18n } from "./i18n";
import { installSessionExpiryHandler } from "./lib/sessionExpiry";
import { router } from "./router";
import { useLocaleStore } from "./stores/locale";

const pinia = createPinia();
const app = createApp(App).use(pinia).use(router).use(i18n);
installSessionExpiryHandler(router);

// The saved language is applied before the first render, on every page
// (English's messages are fetched first if that's the saved choice).
const locale = useLocaleStore(pinia);
try {
  await locale.init();
} catch {
  // English couldn't load (offline, say): start in Spanish rather than not at all.
  locale.$patch({ locale: "es" });
}
app.mount("#app");
