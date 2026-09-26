/**
 * A two-letter avatar label from a full name: the first name's initial and
 * the middle word's ("Nilson Aldair Molina Rengifo" -> "NM"), or a
 * single name's first two letters. "?" when there's no name.
 */
export function initialsOf(fullName: string | undefined): string {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[Math.floor(words.length / 2)][0]}`.toUpperCase();
}
