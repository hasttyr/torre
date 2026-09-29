import { CONFIGURABLE_ROLES, WIDGET_KEYS, type ConfigurableRole, type WidgetKey } from "../../contracts/catalogs";

// The widget keys and the configurable roles are part of the API contract.
export { CONFIGURABLE_ROLES, WIDGET_KEYS, type ConfigurableRole, type WidgetKey };

/** Narrows an arbitrary string (e.g. a stored `role_widgets.widget_key`) to a known widget key. */
export function isWidgetKey(value: string): value is WidgetKey {
  return (WIDGET_KEYS as readonly string[]).includes(value);
}
