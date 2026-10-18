// Підкладки для MadMapper-проєкту «Полотно» з config/stage_config.json.
// Запуск: node make_guides.js [config] [outDir]
// Вихід: facade_guide_WxH.{svg,png}, facade_id_frame.{svg,png}, surfaces.csv, surfaces.md
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const here = dirname(fileURLToPath(import.meta.url));
const cfgPath = resolve(process.argv[2] ?? join(here, '../config/stage_config.json'));
const outDir = resolve(process.argv[3] ?? join(here, '../guides'));
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));

const { canvas, scrim, props } = cfg;
const [RW, RH] = canvas.resolution;
const PXM = RW / canvas.width;
const CH = canvas.width * RH / RW;
const X0 = canvas.center_x - canvas.width / 2;

const px = (x, y) => [(x - X0) * PXM, RH - (y - canvas.bottom_y) * PXM];
const r1 = n => Math.round(n * 10) / 10;
const m = n => n.toFixed(2);

// Поверхні в порядку малювання: сітка позаду, пропси попереду.
const surfaces = [
  { name: 'scrim', kind: 'scrim', x: 0, y: scrim.bottom_y, width: scrim.width, height: scrim.height },
  ...props.items.map(p => ({ ...p, kind: 'prop' }))
];

const warnings = [];
for (const s of surfaces) {
  if (s.x - s.width / 2 < X0 - 1e-9 || s.x + s.width / 2 > X0 + canvas.width + 1e-9 || s.y < canvas.bottom_y - 1e-9 || s.y + s.height > canvas.bottom_y + CH + 1e-9)
    warnings.push(`${s.name}: виходить за кадр полотна`);
  if (s.kind === 'prop' && (s.z < props.zone_z[0] || s.z > props.zone_z[1]))
    warnings.push(`${s.name}: z = ${s.z} поза зоною пропсів ${props.zone_z.join('–')} м`);
}
const names = surfaces.map(s => s.name);
names.forEach((n, i) => { if (names.indexOf(n) !== i) warnings.push(`назва ${n} повторюється`); });

// Кути за годинниковою стрілкою від верхнього лівого, як дивиться зал.
function corners(s) {
  const l = s.x - s.width / 2, r = s.x + s.width / 2, b = s.y, t = s.y + s.height;
  return [['TL', l, t], ['TR', r, t], ['BR', r, b], ['BL', l, b]].map(([c, x, y]) => {
    const [u, v] = px(x, y);
    return { c, x, y, px: r1(u), py: r1(v), u: u / RW, v: v / RH };
  });
}
const rect = (s, attrs) => {
  const [x, y] = px(s.x - s.width / 2, s.y + s.height);
  return `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(s.width * PXM)}" height="${r1(s.height * PXM)}" ${attrs}/>`;
};
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const FONT = 'font-family="Arial, sans-serif"';

function guideSvg() {
  const o = [];
  o.push(`<rect width="${RW}" height="${RH}" fill="#000"/>`);
  // Метрова сітка: 0.5 м тонко, 1 м товще.
  for (let x = Math.ceil(X0 * 2) / 2; x <= X0 + canvas.width + 1e-9; x += 0.5) {
    const [u] = px(x, 0); const major = Math.abs(x % 1) < 1e-9;
    o.push(`<line x1="${r1(u)}" y1="0" x2="${r1(u)}" y2="${RH}" stroke="${major ? '#3a3f45' : '#1f2328'}" stroke-width="${major ? 2 : 1}"/>`);
    if (major) o.push(`<text x="${r1(u) + 4}" y="${RH - 6}" ${FONT} font-size="16" fill="#7d8790">${x > 0 ? '+' : ''}${x} м</text>`);
  }
  for (let y = canvas.bottom_y; y <= canvas.bottom_y + CH + 1e-9; y += 0.5) {
    const [, v] = px(0, y); const major = Math.abs(y % 1) < 1e-9;
    o.push(`<line x1="0" y1="${r1(v)}" x2="${RW}" y2="${r1(v)}" stroke="${major ? '#3a3f45' : '#1f2328'}" stroke-width="${major ? 2 : 1}"/>`);
    if (major && y > canvas.bottom_y) o.push(`<text x="6" y="${r1(v) - 6}" ${FONT} font-size="16" fill="#7d8790">${y} м</text>`);
  }
  const [axisX] = px(0, 0);
  o.push(`<line x1="${r1(axisX)}" y1="0" x2="${r1(axisX)}" y2="${RH}" stroke="#5b6670" stroke-width="2" stroke-dasharray="12 10"/>`);

  // Над сіткою — поза полотном сітки.
  const sTop = scrim.bottom_y + scrim.height;
  if (sTop < canvas.bottom_y + CH) {
    const [, v] = px(0, sTop);
    o.push(`<rect x="0" y="0" width="${RW}" height="${r1(v)}" fill="#2a1414" fill-opacity="0.6"/>`);
    o.push(`<text x="${RW / 2}" y="${r1(v / 2) + 7}" ${FONT} font-size="20" fill="#c06a6a" text-anchor="middle">поза сіткою (${m(canvas.bottom_y + CH - sTop)} м)</text>`);
  }
  // Темна зона внизу сітки.
  const dz = { x: 0, y: scrim.bottom_y, width: scrim.width, height: scrim.dark_zone_height };
  o.push(rect(dz, 'fill="#5a2a00" fill-opacity="0.35"'));
  const [, dzv] = px(0, scrim.bottom_y + scrim.dark_zone_height);
  o.push(`<text x="${RW - 14}" y="${r1(dzv) + 26}" ${FONT} font-size="20" fill="#d08a40" text-anchor="end">темна зона ${scrim.dark_zone_height} м — тіні артистів і рук</text>`);

  const sc = surfaces[0];
  o.push(rect(sc, 'fill="none" stroke="#4CC3E3" stroke-width="4"'));
  const [, scTop] = px(0, sTop);
  o.push(`<text x="${r1(axisX)}" y="${r1(scTop) + 34}" ${FONT} font-size="26" font-weight="bold" fill="#4CC3E3" text-anchor="middle">СІТКА ${scrim.width} × ${scrim.height} м</text>`);

  for (const s of surfaces.slice(1)) {
    o.push(rect(s, 'fill="#F2802E" fill-opacity="0.18" stroke="#F2802E" stroke-width="3"'));
    const [u, v] = px(s.x, s.y + s.height / 2);
    o.push(`<text x="${r1(u)}" y="${r1(v)}" ${FONT} font-size="18" fill="#F2B27E" text-anchor="middle">${esc(s.name)}</text>`);
    o.push(`<text x="${r1(u)}" y="${r1(v) + 22}" ${FONT} font-size="14" fill="#F2B27E" text-anchor="middle">${m(s.width)} × ${m(s.height)} м, z ${m(s.z)}</text>`);
  }
  if (surfaces.length === 1)
    o.push(`<text x="${r1(axisX)}" y="${RH - 40}" ${FONT} font-size="18" fill="#8a7a6a" text-anchor="middle">пропси не задані (config: props.items)</text>`);

  o.push(`<text x="14" y="28" ${FONT} font-size="18" fill="#9aa4ad">LOVIXX · фасад ${RW}×${RH} = ${m(canvas.width)} × ${m(CH)} м · ${PXM.toFixed(1)} px/м · низ кадру = планшет сцени</text>`);
  return svgDoc(o);
}

const ID_COLORS = ['#00E5FF', '#FF2D95', '#FFE600', '#39FF14', '#FF7A00', '#9D4DFF', '#FF1E1E', '#00FFA8', '#4D7CFF', '#FFFFFF'];
function idSvg() {
  const o = [`<rect width="${RW}" height="${RH}" fill="#000"/>`];
  surfaces.forEach((s, i) => o.push(rect(s, `fill="${ID_COLORS[i % ID_COLORS.length]}"`)));
  surfaces.forEach(s => {
    // L-кутик усередині поверхні: видно й тоді, коли кут лежить на краю кадру.
    const L = Math.min(32, s.width * PXM / 3, s.height * PXM / 3);
    for (const k of corners(s)) {
      const dx = k.c.endsWith('L') ? 1 : -1, dy = k.c.startsWith('T') ? 1 : -1;
      // Зовнішній край кутика = кут поверхні: біла смуга 0–8 px, чорна підкладка 8–16 px усередину.
      const at = w => { const x = k.px + dx * w / 2, y = k.py + dy * w / 2; return `M${r1(x + dx * (L - w / 2))},${r1(y)} L${r1(x)},${r1(y)} L${r1(x)},${r1(y + dy * (L - w / 2))}`; };
      o.push(`<path d="${at(16)}" fill="none" stroke="#000" stroke-width="16"/>`);
      o.push(`<path d="${at(8)}" fill="none" stroke="#fff" stroke-width="8"/>`);
    }
    const [u, v] = px(s.x, s.y + s.height / 2);
    o.push(`<text x="${r1(u)}" y="${r1(v) + 8}" ${FONT} font-size="${s.kind === 'scrim' ? 40 : 20}" font-weight="bold" fill="#000" text-anchor="middle">${esc(s.name)}</text>`);
  });
  return svgDoc(o);
}

function svgDoc(parts) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${RW}" height="${RH}" viewBox="0 0 ${RW} ${RH}">\n${parts.join('\n')}\n</svg>\n`;
}

function save(name, svg) {
  writeFileSync(join(outDir, name + '.svg'), svg);
  const png = new Resvg(svg, { fitTo: { mode: 'original' }, font: { loadSystemFonts: true, defaultFontFamily: 'Arial' } }).render().asPng();
  writeFileSync(join(outDir, name + '.png'), png);
}

mkdirSync(outDir, { recursive: true });
save(`facade_guide_${RW}x${RH}`, guideSvg());
save('facade_id_frame', idSvg());

const rows = [['surface', 'corner', 'x_m', 'y_m', 'px_x', 'px_y', 'u', 'v']];
for (const s of surfaces) for (const k of corners(s)) rows.push([s.name, k.c, m(k.x), m(k.y), k.px, k.py, k.u.toFixed(4), k.v.toFixed(4)]);
writeFileSync(join(outDir, 'surfaces.csv'), rows.map(r => r.join(',')).join('\n') + '\n');

const md = [
  '# Поверхні полотна',
  '',
  `Згенеровано з \`config/stage_config.json\`. Кадр ${RW}×${RH} = ${m(canvas.width)} × ${m(CH)} м, ${PXM.toFixed(1)} px/м.`,
  'Пікселі від верхнього лівого кута кадру; u, v — те саме в частках кадру (0–1). x, y — метри: x від осі сцени, y над планшетом.',
  'Кути: TL — верх-ліво, TR — верх-право, BR — низ-право, BL — низ-ліво (як дивиться зал).',
  ''
];
for (const s of surfaces) {
  md.push(`## ${s.name}`, '', `${m(s.width)} × ${m(s.height)} м${s.kind === 'prop' ? `, фронт на z ${m(s.z)} м` : ''}`, '', '| кут | x, м | y, м | px x | px y | u | v |', '|---|---|---|---|---|---|---|');
  for (const k of corners(s)) md.push(`| ${k.c} | ${m(k.x)} | ${m(k.y)} | ${k.px} | ${k.py} | ${k.u.toFixed(4)} | ${k.v.toFixed(4)} |`);
  md.push('');
}
if (warnings.length) md.push('## Попередження', '', ...warnings.map(w => `- ${w}`), '');
writeFileSync(join(outDir, 'surfaces.md'), md.join('\n'));

console.log(`${surfaces.length} поверхонь → ${outDir}`);
warnings.forEach(w => console.warn('УВАГА: ' + w));
