/**
 * Default coin logo when the post had no image. Deterministic from the symbol, so the engine (which
 * uploads it to R2 and writes the URL on-chain) and the web app (which renders it inline) produce the
 * exact same picture. A two-tone gradient from the symbol's hash, the ticker in heavy type, and a small
 * post-bubble mark so it's recognisably ours.
 */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function logoPalette(symbol: string): { a: string; b: string; hue: number } {
  const h = hash(symbol.toUpperCase());
  const hue = h % 360;
  const hue2 = (hue + 42 + (h >> 8) % 40) % 360;
  return { a: `hsl(${hue} 72% 46%)`, b: `hsl(${hue2} 80% 26%)`, hue };
}

export function defaultLogoSvg(symbol: string, size = 512): string {
  const sym = symbol.toUpperCase().slice(0, 10);
  const { a, b } = logoPalette(sym);
  // Heavy sans runs ~0.62em per glyph; size the type so the whole ticker spans ~88% of the tile.
  const fs = Math.min(0.42, 0.88 / (0.62 * Math.max(sym.length, 1)));
  const font = Math.round(size * fs);
  const r = Math.round(size * 0.2);
  const markW = Math.round(size * 0.16);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<radialGradient id="s" cx="0.3" cy="0.2" r="0.9"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${size}" height="${size}" rx="${r}" fill="url(#g)"/>
<rect width="${size}" height="${size}" rx="${r}" fill="url(#s)"/>
<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Inter Tight, Inter, Arial, Helvetica, sans-serif" font-weight="800" font-size="${font}" fill="#fff" letter-spacing="-0.03em" style="paint-order:stroke" stroke="rgba(0,0,0,0.18)" stroke-width="${Math.max(2, Math.round(size * 0.012))}">${sym}</text>
<g transform="translate(${size - markW - Math.round(size * 0.07)} ${Math.round(size * 0.07)}) scale(${markW / 32})">
<path d="M6 4h20a4 4 0 0 1 4 4v13a4 4 0 0 1-4 4H14l-6 5v-5H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z" fill="rgba(255,255,255,0.92)"/>
<text x="16" y="20" font-family="Inter Tight, Inter, Arial, sans-serif" font-size="15" font-weight="800" text-anchor="middle" fill="${b}">$</text>
</g>
</svg>`;
}
