/**
 * Self-contained SVG data-URI placeholder assets for the demo. Using data
 * URIs keeps the demo working with no network access or asset pipeline.
 */

function svg(source: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(source)}`;
}

export const PRODUCT_IMAGE = svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffd8a8"/>
      <stop offset="1" stop-color="#ff922b"/>
    </linearGradient>
  </defs>
  <rect width="600" height="400" fill="url(#bg)"/>
  <rect x="205" y="140" width="190" height="150" rx="16" fill="#fff" opacity="0.92"/>
  <path d="M245 150 v-22 a28 28 0 0 1 56 0 v22" fill="none" stroke="#e8590c" stroke-width="10" stroke-linecap="round"/>
  <rect x="185" y="185" width="230" height="24" rx="12" fill="#e8590c" opacity="0.5"/>
  <text x="300" y="345" font-family="system-ui, sans-serif" font-size="28" font-weight="700" fill="#7f3c00" text-anchor="middle">PRODUCT</text>
</svg>`);

export const BRAND_LOGO = svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 160">
  <rect width="400" height="160" fill="none"/>
  <path d="M40 118 L40 42 L120 42 L120 64 L68 64 L68 72 L112 72 L112 94 L68 94 L68 118 Z" fill="#1971c2"/>
  <path d="M140 118 L140 42 L168 42 L168 96 L210 96 L210 118 Z" fill="#1971c2"/>
  <circle cx="248" cy="80" r="34" fill="none" stroke="#1971c2" stroke-width="12"/>
  <text x="300" y="96" font-family="system-ui, sans-serif" font-size="46" font-weight="800" fill="#1971c2" letter-spacing="4">M</text>
</svg>`);
