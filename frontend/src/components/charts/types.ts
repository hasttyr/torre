export interface BarListItem {
  key: string;
  label: string;
  value: number;
  // Text printed at the bar's tip (defaults to the raw value).
  valueLabel?: string;
  // Secondary text under the label (e.g. "2 inactivos").
  detail?: string;
}

export interface LinePoint {
  key: string;
  // Short x-axis label (e.g. "oct 25").
  label: string;
  // 0-1 ratio: the y axis is a fixed 0-100% scale.
  value: number;
  // Tooltip content, one line each; the first is shown as the title.
  tooltip: string[];
}
