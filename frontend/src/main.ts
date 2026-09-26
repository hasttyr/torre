import { createPinia } from "pinia";
import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { i18n } from "./i18n";
import { installSessionExpiryHandler } from "./lib/sessionExpiry";
import { router } from "./router";

createApp(App).use(createPinia()).use(router).use(i18n).mount("#app");
installSessionExpiryHandler(router);
