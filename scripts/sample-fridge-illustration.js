// Source of assets/sample-fridge.jpg — the flat illustration used by the
// onboarding "sample scan". Not a photo (nothing to license or leak): every item
// drawn here is one of the 12 items in src/constants/sampleFridge.js.
// To regenerate: render `svg` (900x1200) in any headless browser and save it as
// a JPEG, e.g. with Playwright:
//   const { svg, W, H } = require("./sample-fridge-illustration");
//   await page.setContent(`<body style="margin:0">${svg}</body>`);
//   await page.screenshot({ path: "assets/sample-fridge.jpg", type: "jpeg", quality: 90 });
// Flat-vector "open fridge" illustration, 900x1200. Output: SVG string.
const W = 900, H = 1200;
const out = [];
const add = (s) => out.push(s);

const shadow = (cx, cy, rx, ry = 7, o = 0.18) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#1b3a4b" opacity="${o}"/>`;

function milk(x, yb) {
  return `
  ${shadow(x + 45, yb + 2, 52)}
  <polygon points="${x},${yb - 150} ${x + 90},${yb - 150} ${x + 72},${yb - 188} ${x + 18},${yb - 188}" fill="#E4EEF7" stroke="#C5D6E4" stroke-width="2"/>
  <rect x="${x + 55}" y="${yb - 200}" width="22" height="14" rx="4" fill="#2F7BD6"/>
  <rect x="${x}" y="${yb - 150}" width="90" height="150" rx="6" fill="#FFFFFF" stroke="#C5D6E4" stroke-width="2"/>
  <rect x="${x}" y="${yb - 106}" width="90" height="62" fill="#4F9BE8"/>
  <path d="M${x + 45} ${yb - 98} q-14 18 0 28 q14 -10 0 -28z" fill="#FFFFFF" opacity="0.95"/>
  <rect x="${x + 8}" y="${yb - 140}" width="26" height="8" rx="4" fill="#4F9BE8" opacity="0.35"/>`;
}
function yogurt(x, yb, lid) {
  return `
  ${shadow(x + 35, yb + 2, 40, 6)}
  <polygon points="${x},${yb - 72} ${x + 70},${yb - 72} ${x + 61},${yb} ${x + 9},${yb}" fill="#FFFFFF" stroke="#CFDDE8" stroke-width="2"/>
  <polygon points="${x + 3},${yb - 52} ${x + 67},${yb - 52} ${x + 62},${yb - 14} ${x + 8},${yb - 14}" fill="${lid}" opacity="0.55"/>
  <rect x="${x - 4}" y="${yb - 82}" width="78" height="12" rx="6" fill="${lid}"/>`;
}
function cheese(x, yb) {
  const holes = [[24, 28, 7], [62, 44, 9], [92, 26, 6], [48, 18, 5]]
    .map(([a, b, r]) => `<circle cx="${x + a}" cy="${yb - b}" r="${r}" fill="#F0B73B"/>`).join('');
  return `
  ${shadow(x + 62, yb + 2, 70)}
  <polygon points="${x},${yb - 74} ${x + 24},${yb - 96} ${x + 144},${yb - 96} ${x + 124},${yb - 74}" fill="#FFE38A"/>
  <rect x="${x}" y="${yb - 74}" width="124" height="74" rx="8" fill="#FFD45C" stroke="#E5AE2E" stroke-width="2"/>
  <polygon points="${x + 124},${yb - 74} ${x + 144},${yb - 96} ${x + 144},${yb - 22} ${x + 124},${yb}" fill="#F2BC3A"/>
  ${holes}`;
}
function butter(x, yb) {
  return `
  ${shadow(x + 48, yb + 2, 56, 6)}
  <rect x="${x}" y="${yb - 46}" width="96" height="46" rx="7" fill="#FFF0B0" stroke="#E8CF6A" stroke-width="2"/>
  <rect x="${x}" y="${yb - 30}" width="96" height="14" fill="#F6C945"/>
  <rect x="${x + 14}" y="${yb - 40}" width="30" height="5" rx="2.5" fill="#E8B730" opacity="0.7"/>`;
}
function eggs(x, yb) {
  const e = [];
  for (let i = 0; i < 6; i++) {
    const cx = x + 30 + i * 36;
    e.push(`<ellipse cx="${cx}" cy="${yb - 52}" rx="22" ry="29" fill="#FBEBD3" stroke="#E4CDA8" stroke-width="2"/><ellipse cx="${cx - 7}" cy="${yb - 62}" rx="5" ry="9" fill="#FFFFFF" opacity="0.55"/>`);
  }
  return `
  ${shadow(x + 115, yb + 2, 130, 7)}
  ${e.join('')}
  <path d="M${x} ${yb - 40} h232 l-8 40 h-216z" fill="#CDBFA7" stroke="#B5A68B" stroke-width="2"/>
  <path d="M${x + 14} ${yb - 24} h204" stroke="#B5A68B" stroke-width="3" stroke-linecap="round" opacity="0.6"/>`;
}
function jar(x, yb, body, lid) {
  return `
  ${shadow(x + 38, yb + 2, 44, 6)}
  <rect x="${x}" y="${yb - 92}" width="76" height="92" rx="14" fill="${body}" stroke="rgba(0,0,0,0.12)" stroke-width="2"/>
  <rect x="${x + 6}" y="${yb - 104}" width="64" height="18" rx="5" fill="${lid}"/>
  <rect x="${x + 10}" y="${yb - 66}" width="56" height="38" rx="6" fill="#FFF8E7"/>
  <rect x="${x + 18}" y="${yb - 56}" width="40" height="5" rx="2.5" fill="${body}" opacity="0.55"/>
  <rect x="${x + 18}" y="${yb - 45}" width="28" height="5" rx="2.5" fill="${body}" opacity="0.35"/>
  <rect x="${x + 8}" y="${yb - 84}" width="8" height="70" rx="4" fill="#FFFFFF" opacity="0.28"/>`;
}
function bottle(x, yb, body, cap, h = 150, w = 58, label = '#FFFFFF') {
  const nh = 44;
  return `
  ${shadow(x + w / 2, yb + 2, w * 0.75, 6)}
  <rect x="${x + w * 0.31}" y="${yb - h - 14}" width="${w * 0.38}" height="${nh + 20}" rx="6" fill="${body}"/>
  <rect x="${x + w * 0.27}" y="${yb - h - 26}" width="${w * 0.46}" height="16" rx="5" fill="${cap}"/>
  <rect x="${x}" y="${yb - h + nh - 6}" width="${w}" height="${h - nh + 6}" rx="16" fill="${body}"/>
  <rect x="${x + 5}" y="${yb - h * 0.62}" width="${w - 10}" height="${h * 0.34}" rx="6" fill="${label}" opacity="0.92"/>
  <rect x="${x + 10}" y="${yb - h + nh + 6}" width="7" height="${h - nh - 22}" rx="3.5" fill="#FFFFFF" opacity="0.3"/>`;
}
function tomato(cx, yb, r = 32) {
  const cy = yb - r + 4;
  return `
  ${shadow(cx, yb + 2, r + 4, 6)}
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#E53935"/>
  <ellipse cx="${cx - r * 0.35}" cy="${cy - r * 0.4}" rx="${r * 0.22}" ry="${r * 0.12}" fill="#FFFFFF" opacity="0.4" transform="rotate(-30 ${cx - r * 0.35} ${cy - r * 0.4})"/>
  <path d="M${cx} ${cy - r + 4} l-14 -2 l8 8 l-12 6 l14 -2 l4 10 l4 -10 l14 2 l-12 -6 l8 -8z" fill="#2E8B3A" transform="translate(0,-2)"/>`;
}
function pepper(x, yb, color, dark) {
  return `
  ${shadow(x + 36, yb + 2, 44, 6)}
  <path d="M${x + 36} ${yb - 86} c-34 -4 -46 18 -40 46 c4 22 16 40 40 40 c24 0 36 -18 40 -40 c6 -28 -6 -50 -40 -46z" fill="${color}"/>
  <path d="M${x + 36} ${yb - 80} c-4 28 -4 52 0 80" stroke="${dark}" stroke-width="3" fill="none" opacity="0.45"/>
  <path d="M${x + 14} ${yb - 74} c-8 14 -8 34 -2 50" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.3"/>
  <path d="M${x + 36} ${yb - 86} c-2 -12 4 -20 14 -24" stroke="#2E7D32" stroke-width="9" stroke-linecap="round" fill="none"/>`;
}
function lemon(cx, yb) {
  const cy = yb - 28;
  return `
  ${shadow(cx, yb + 2, 44, 6)}
  <path d="M${cx - 44} ${cy} q4 -14 16 -22 q28 -12 56 0 q12 8 16 22 q-4 14 -16 22 q-28 12 -56 0 q-12 -8 -16 -22z" fill="#FDD835" stroke="#E9BD1E" stroke-width="2"/>
  <ellipse cx="${cx - 12}" cy="${cy - 10}" rx="12" ry="5" fill="#FFFFFF" opacity="0.45"/>`;
}
function spinach(x, yb) {
  const leaf = (cx, cy, rx, ry, rot, c) => `<g transform="rotate(${rot} ${cx} ${cy})"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}"/><path d="M${cx - rx + 6} ${cy} H${cx + rx - 6}" stroke="#1F7A3A" stroke-width="3" opacity="0.5"/></g>`;
  return `
  ${shadow(x + 90, yb + 2, 110, 8)}
  ${leaf(x + 40, yb - 36, 44, 24, -35, '#2F9E4F')}
  ${leaf(x + 100, yb - 52, 46, 26, 12, '#43B65F')}
  ${leaf(x + 150, yb - 34, 40, 22, 38, '#2F9E4F')}
  ${leaf(x + 78, yb - 28, 46, 25, -8, '#3AAE58')}
  ${leaf(x + 120, yb - 28, 40, 22, 20, '#2A9148')}`;
}
function carrot(x, yb, len = 150) {
  return `
  <polygon points="${x},${yb - 40} ${x + 34},${yb - 40} ${x + 17},${yb + len - 40}" fill="#FB8C00"/>
  <polygon points="${x + 22},${yb - 40} ${x + 34},${yb - 40} ${x + 17},${yb + len - 40}" fill="#EF7B00"/>
  <path d="M${x + 6} ${yb - 12} h14 M${x + 10} ${yb + 28} h12 M${x + 12} ${yb + 62} h8" stroke="#D96C00" stroke-width="3" stroke-linecap="round"/>
  <path d="M${x + 17} ${yb - 40} l-10 -26 M${x + 17} ${yb - 40} l4 -30 M${x + 17} ${yb - 40} l14 -22" stroke="#43A047" stroke-width="7" stroke-linecap="round"/>`;
}
function onion(cx, yb) {
  const cy = yb - 36;
  return `
  ${shadow(cx, yb + 2, 44, 6)}
  <path d="M${cx} ${cy - 50} c10 10 12 18 14 24 c24 4 34 22 28 40 c-6 18 -24 26 -42 26 c-18 0 -36 -8 -42 -26 c-6 -18 4 -36 28 -40 c2 -6 4 -14 14 -24z" fill="#DDA95E" stroke="#B9843B" stroke-width="2"/>
  <path d="M${cx - 14} ${cy - 20} c-6 22 -6 44 0 60 M${cx + 14} ${cy - 20} c6 22 6 44 0 60 M${cx} ${cy - 24} c0 24 0 48 0 64" stroke="#C0883F" stroke-width="3" fill="none" opacity="0.65"/>
  <path d="M${cx - 8} ${yb - 4} l-6 8 M${cx} ${yb - 2} l0 8 M${cx + 8} ${yb - 4} l6 8" stroke="#9A6B2E" stroke-width="2.5" stroke-linecap="round"/>
  <ellipse cx="${cx - 18}" cy="${cy - 6}" rx="6" ry="12" fill="#FFFFFF" opacity="0.3" transform="rotate(12 ${cx - 18} ${cy - 6})"/>`;
}
function shelf(y) {
  return `
  <rect x="62" y="${y}" width="650" height="14" rx="6" fill="#D6E8F0" stroke="#B9D4E0" stroke-width="2"/>
  <rect x="62" y="${y + 10}" width="650" height="9" rx="4" fill="#C3DCE8"/>
  <rect x="80" y="${y + 3}" width="300" height="3" rx="1.5" fill="#FFFFFF" opacity="0.8"/>
  <rect x="62" y="${y + 20}" width="650" height="46" fill="url(#shelfShadow)"/>`;
}

add(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBFDFE"/><stop offset="1" stop-color="#E3ECF1"/></linearGradient>
  <linearGradient id="wallL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C9D7E0"/><stop offset="1" stop-color="#E7EEF3"/></linearGradient>
  <linearGradient id="door" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#D3E0E8"/><stop offset="1" stop-color="#EEF3F7"/></linearGradient>
  <linearGradient id="shelfShadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b3a4b" stop-opacity="0.16"/><stop offset="1" stop-color="#1b3a4b" stop-opacity="0"/></linearGradient>
  <radialGradient id="glow" cx="0.45" cy="0" r="0.8"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
  <linearGradient id="drawer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CFE6F0" stop-opacity="0.55"/><stop offset="1" stop-color="#A9CFE0" stop-opacity="0.75"/></linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<rect x="0" y="0" width="62" height="${H}" fill="url(#wallL)"/>
${[100, 220, 340, 460, 580, 700, 820, 940, 1060].map((y) => `<rect x="10" y="${y}" width="44" height="5" rx="2.5" fill="#B7C9D4" opacity="0.7"/>`).join('')}
<rect x="0" y="0" width="${W}" height="150" fill="url(#glow)"/>
<rect x="712" y="0" width="188" height="${H}" fill="url(#door)"/>
<rect x="708" y="0" width="6" height="${H}" fill="#B8CBD6"/>
`);

// Door shelves (right)
for (const y of [330, 620, 910]) {
  add(`<rect x="724" y="${y - 6}" width="170" height="68" rx="10" fill="#CBE3EE" opacity="0.5" stroke="#B3D2E0" stroke-width="2"/>`);
}
add(bottle(738, 330, '#C62828', '#F5F5F5', 130, 50));       // ketchup
add(bottle(800, 330, '#2E5E3A', '#1E1E1E', 170, 44, '#E8E2C0'));    // olive oil
add(bottle(850, 330, '#C7E3F2', '#42A5F5', 150, 40, '#FFFFFF'));    // water
add(bottle(740, 620, '#FFB300', '#6D4C41', 120, 56, '#FFFFFF'));    // mustard / sauce
add(jar(814, 620, '#7B3F2A', '#9E9E9E'));
add(bottle(742, 910, '#8E24AA', '#CE93D8', 130, 54, '#FFFFFF'));
add(bottle(812, 910, '#FB8C00', '#2E7D32', 150, 56, '#FFFFFF'));

// Shelf 1 (y=330)
add(shelf(330));
add(milk(96, 330));
add(yogurt(214, 330, '#F48FB1'));
add(yogurt(296, 330, '#81C784'));
add(cheese(398, 330));
add(butter(560, 330));
// Shelf 2 (y=620)
add(shelf(620));
add(eggs(92, 620));
add(jar(350, 620, '#C62828', '#F9A825'));
add(jar(440, 620, '#8BC34A', '#9E9E9E'));
add(bottle(540, 620, '#FB8C00', '#2E7D32', 150, 60));
add(yogurt(624, 620, '#64B5F6'));
// Shelf 3 (y=910)
add(shelf(910));
add(tomato(120, 910));
add(tomato(180, 910, 30));
add(tomato(150, 868, 28));
add(pepper(226, 910, '#D32F2F', '#8E1B1B'));
add(pepper(316, 910, '#FBC02D', '#B58500'));
add(lemon(450, 910));
add(lemon(520, 910));
add(onion(616, 910));
// Crisper drawers
add(`<rect x="76" y="984" width="300" height="190" rx="16" fill="url(#drawer)" stroke="#9FC6D8" stroke-width="3"/>`);
add(spinach(100, 1130));
add(`<rect x="76" y="1118" width="300" height="56" rx="16" fill="#B5D7E6" opacity="0.7"/>`);
add(`<rect x="170" y="1136" width="112" height="9" rx="4.5" fill="#FFFFFF" opacity="0.8"/>`);
add(`<rect x="394" y="984" width="300" height="190" rx="16" fill="url(#drawer)" stroke="#9FC6D8" stroke-width="3"/>`);
add(carrot(430, 1040, 120));
add(carrot(474, 1048, 110));
add(carrot(518, 1036, 126));
add(carrot(562, 1050, 104));
add(`<rect x="394" y="1118" width="300" height="56" rx="16" fill="#B5D7E6" opacity="0.7"/>`);
add(`<rect x="488" y="1136" width="112" height="9" rx="4.5" fill="#FFFFFF" opacity="0.8"/>`);
add(`</svg>`);
module.exports = { svg: out.join('\n'), W, H };
