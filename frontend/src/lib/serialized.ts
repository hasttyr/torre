/**
 * A backend response type as it arrives over JSON: every `Date` in it is an
 * ISO string. The contract (@contracts) describes what the backend builds;
 * this is what the frontend receives.
 */
export type Serialized<T> = T extends Date
  ? string
  : T extends readonly (infer Item)[]
    ? Serialized<Item>[]
    : T extends object
      ? { [Key in keyof T]: Serialized<T[Key]> }
      : T;
