export function deriveLightPostItColors(projectHex: string): {
  bgHex: string;
  borderHex: string;
} {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(projectHex.trim())
    ? projectHex.trim()
    : '#1D4ED8';

  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);

  const mixWithWhite = (channel: number, weight: number) =>
    Math.round(channel * weight + 255 * (1 - weight));

  const toHex = (val: number) =>
    Math.max(0, Math.min(255, val)).toString(16).padStart(2, '0');

  const bgHex = `#${toHex(mixWithWhite(r, 0.14))}${toHex(
    mixWithWhite(g, 0.14)
  )}${toHex(mixWithWhite(b, 0.14))}`;

  const borderHex = `#${toHex(mixWithWhite(r, 0.38))}${toHex(
    mixWithWhite(g, 0.38)
  )}${toHex(mixWithWhite(b, 0.38))}`;

  return { bgHex, borderHex };
}
