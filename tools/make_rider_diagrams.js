// Схеми для техрайдера з config/stage_config.json: вид зверху і розріз по осі сцени.
// Запуск: node make_rider_diagrams.js [config] [outDir]
// Вихід: rider_top.{svg,png}, rider_section.{svg,png}
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const here = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(resolve(process.argv[2] ?? join(here, '../config/stage_config.json')), 'utf8'));
const outDir = resolve(process.argv[3] ?? join(here, '../docs/img'));

const { stage, scrim, canvas, props, projectors: pr, shadow_checks: sh } = cfg;
const S = stage.height_above_floor;
const [RW, RH] = canvas.resolution;
const Hc = canvas.width * RH / RW;
const Y = scrim.z, D = pr.distance_to_scrim, H = pr.lens_height_from_floor, OFF = pr.offset_from_axis;
const PZ = Y - D; // z лінзи

const SC = 50; // px на метр
const FONT = 'font-family="Arial, sans-serif"';
const C = { line: '#222', dim: '#555', stage: '#d9dde1', scrim: '#1f8fb0', prop: '#e07a2a', proj: '#e07a2a', beam: '#1f8fb0', band: '#9aa3ab', text: '#222' };
const f = n => (Math.round(n * 100) / 100).toString();

function doc(w, h, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="#fff"/>
<text x="16" y="26" ${FONT} font-size="17" font-weight="bold" fill="${C.text}">${title}</text>
<text x="16" y="${h - 12}" ${FONT} font-size="12" fill="${C.dim}">Розміри в метрах. Схема в масштабі, 1 клітинка = 1 м.</text>
${body}
</svg>
`;
}

// Розмірна лінія між двома точками (px) з підписом.
function dim(x1, y1, x2, y2, label, side = -1) {
  const vert = Math.abs(x1 - x2) < 1e-6;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const t = 5;
  const ticks = vert
    ? `<line x1="${x1 - t}" y1="${y1}" x2="${x1 + t}" y2="${y1}"/><line x1="${x2 - t}" y1="${y2}" x2="${x2 + t}" y2="${y2}"/>`
    : `<line x1="${x1}" y1="${y1 - t}" x2="${x1}" y2="${y1 + t}"/><line x1="${x2}" y1="${y2 - t}" x2="${x2}" y2="${y2 + t}"/>`;
  const tx = vert ? `<text x="${mx + side * 8}" y="${my + 4}" text-anchor="${side < 0 ? 'end' : 'start'}">${label}</text>`
    : `<text x="${mx}" y="${my + (side < 0 ? -7 : 16)}" text-anchor="middle">${label}</text>`;
  return `<g stroke="${C.dim}" stroke-width="1.2" fill="${C.dim}" ${FONT} font-size="13"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>${ticks}<g stroke="none">${tx}</g></g>`;
}

function grid(x0, y0, w, h) {
  const o = [];
  for (let x = x0; x <= x0 + w + 0.1; x += SC) o.push(`<line x1="${x}" y1="${y0}" x2="${x}" y2="${y0 + h}"/>`);
  for (let y = y0; y <= y0 + h + 0.1; y += SC) o.push(`<line x1="${x0}" y1="${y}" x2="${x0 + w}" y2="${y}"/>`);
  return `<g stroke="#eef0f2" stroke-width="1">${o.join('')}</g>`;
}

// ---- Вид зверху: сцена вгорі, зала внизу. x праворуч, z вниз до залу.
function top() {
  const halfW = Math.max(stage.width / 2, OFF + 1) + 1.5;
  const zMin = PZ - 1.5, zMax = stage.depth + 0.7;
  const pad = 60;
  const W = Math.round(2 * halfW * SC + 2 * pad + 80), Hh = Math.round((zMax - zMin) * SC + 2 * pad);
  const X = x => pad + (x + halfW) * SC;
  const Z = z => pad + (zMax - z) * SC;
  const o = [grid(X(-halfW), Z(zMax), 2 * halfW * SC, (zMax - zMin) * SC)];

  o.push(`<rect x="${X(-stage.width / 2)}" y="${Z(stage.depth)}" width="${stage.width * SC}" height="${stage.depth * SC}" fill="${C.stage}" stroke="${C.line}" stroke-width="2"/>`);
  o.push(`<line x1="${X(-stage.width / 2)}" y1="${Z(stage.depth) - 4}" x2="${X(stage.width / 2)}" y2="${Z(stage.depth) - 4}" stroke="#000" stroke-width="5"/>`);
  o.push(`<text x="${X(0)}" y="${Z(stage.depth) - 12}" ${FONT} font-size="13" text-anchor="middle" fill="${C.text}">чорний задник (клуб)</text>`);
  // Зона пропсів.
  o.push(`<rect x="${X(-stage.width / 2)}" y="${Z(props.zone_z[1])}" width="${stage.width * SC}" height="${(props.zone_z[1] - props.zone_z[0]) * SC}" fill="${C.prop}" fill-opacity="0.15"/>`);
  o.push(`<text x="${X(0)}" y="${Z((props.zone_z[0] + props.zone_z[1]) / 2) + 5}" ${FONT} font-size="13" text-anchor="middle" fill="#a0521a">зона пропсів ${props.zone_z[0]}–${props.zone_z[1]} м</text>`);
  // Бенд.
  o.push(`<text x="${X(0)}" y="${Z((Y + stage.depth) / 2) + 5}" ${FONT} font-size="13" text-anchor="middle" fill="${C.text}">бенд (за сіткою)</text>`);
  // Сітка.
  o.push(`<line x1="${X(-scrim.width / 2)}" y1="${Z(Y)}" x2="${X(scrim.width / 2)}" y2="${Z(Y)}" stroke="${C.scrim}" stroke-width="5"/>`);
  o.push(`<text x="${X(scrim.width / 2) + 8}" y="${Z(Y) + 4}" ${FONT} font-size="13" fill="${C.scrim}">сітка ${scrim.width} м</text>`);
  // Промені і проєктори.
  for (const sx of [-OFF, OFF]) {
    o.push(`<polygon points="${X(sx)},${Z(PZ)} ${X(-canvas.width / 2)},${Z(Y)} ${X(canvas.width / 2)},${Z(Y)}" fill="${C.beam}" fill-opacity="0.06" stroke="${C.beam}" stroke-opacity="0.5" stroke-dasharray="6 5"/>`);
    o.push(`<rect x="${X(sx) - 14}" y="${Z(PZ) - 9}" width="28" height="18" fill="${C.proj}"/>`);
  }
  o.push(`<text x="${X(0)}" y="${Z(PZ) + 32}" ${FONT} font-size="13" text-anchor="middle" fill="${C.text}">2 проєктори (stack), лінза ${f(H)} м над підлогою зали</text>`);

  const right = X(halfW) + 10;
  o.push(dim(X(-stage.width / 2), Z(stage.depth) - 30, X(stage.width / 2), Z(stage.depth) - 30, `сцена ${f(stage.width)} м`, -1));
  o.push(dim(right, Z(stage.depth), right, Z(0), `${f(stage.depth)} м`, 1));
  o.push(dim(right + 40, Z(Y), right + 40, Z(0), `${f(Y)}`, 1));
  o.push(dim(right, Z(0), right, Z(PZ), `${f(D - Y)} м до краю сцени`, 1));
  o.push(dim(X(-OFF), Z(PZ) + 50, X(OFF), Z(PZ) + 50, `${f(2 * OFF)} м`, 1));
  o.push(`<text x="${X(-stage.width / 2) - 8}" y="${Z(0) + 4}" ${FONT} font-size="12" text-anchor="end" fill="${C.dim}">край сцени</text>`);
  o.push(`<text x="${X(-halfW) + 6}" y="${Z(PZ / 2)}" ${FONT} font-size="13" fill="${C.dim}">ЗАЛА</text>`);
  return doc(W, Hh, o.join('\n'), 'LOVIXX · вид зверху');
}

// ---- Розріз по осі: зала ліворуч, сцена праворуч. y — від підлоги зали.
function section() {
  const zMin = PZ - 1.2, zMax = stage.depth + 0.6;
  const yMax = Math.max(H, S + Math.max(scrim.height, Hc)) + 0.8;
  const pad = 60;
  const W = Math.round((zMax - zMin) * SC + 2 * pad + 60), Hh = Math.round(yMax * SC + 2 * pad);
  const Zx = z => pad + (z - zMin) * SC;
  const Yy = y => pad + (yMax - y) * SC;
  const o = [grid(Zx(zMin), Yy(yMax), (zMax - zMin) * SC, yMax * SC)];

  o.push(`<line x1="${Zx(zMin)}" y1="${Yy(0)}" x2="${Zx(zMax)}" y2="${Yy(0)}" stroke="${C.line}" stroke-width="2"/>`);
  o.push(`<rect x="${Zx(0)}" y="${Yy(S)}" width="${stage.depth * SC}" height="${S * SC}" fill="${C.stage}" stroke="${C.line}" stroke-width="2"/>`);
  o.push(`<line x1="${Zx(stage.depth) + 3}" y1="${Yy(S)}" x2="${Zx(stage.depth) + 3}" y2="${Yy(S + scrim.height + 0.6)}" stroke="#000" stroke-width="5"/>`);
  // Промінь: від лінзи до низу і верху кадру.
  const top = S + Hc;
  o.push(`<polygon points="${Zx(PZ)},${Yy(H)} ${Zx(Y)},${Yy(S)} ${Zx(Y)},${Yy(top)}" fill="${C.beam}" fill-opacity="0.07" stroke="${C.beam}" stroke-opacity="0.6" stroke-dasharray="6 5"/>`);
  // Сітка.
  o.push(`<line x1="${Zx(Y)}" y1="${Yy(S)}" x2="${Zx(Y)}" y2="${Yy(S + scrim.height)}" stroke="${C.scrim}" stroke-width="5"/>`);
  o.push(`<text x="${Zx(Y) + 8}" y="${Yy(S + scrim.height) + 4}" ${FONT} font-size="13" fill="${C.scrim}">сітка</text>`);
  // Артист перед сіткою, умовні пропси в зоні.
  const az = Y - sh.artist.distance_before_scrim;
  o.push(`<rect x="${Zx(az) - 6}" y="${Yy(S + sh.artist.height)}" width="12" height="${sh.artist.height * SC}" rx="6" fill="${C.band}"/>`);
  o.push(`<text x="${Zx(az)}" y="${Yy(S + sh.artist.height) - 8}" ${FONT} font-size="12" text-anchor="middle" fill="${C.text}">артист</text>`);
  o.push(`<rect x="${Zx(props.zone_z[0])}" y="${Yy(S) - 3}" width="${(props.zone_z[1] - props.zone_z[0]) * SC}" height="3" fill="${C.prop}"/>`);
  o.push(`<text x="${Zx((props.zone_z[0] + props.zone_z[1]) / 2)}" y="${Yy(S) + 16}" ${FONT} font-size="12" text-anchor="middle" fill="#a0521a">пропси</text>`);
  // Глядачі: голови й руки.
  for (let z = -0.6; z > PZ + 1.5; z -= 1.2) {
    o.push(`<line x1="${Zx(z)}" y1="${Yy(0)}" x2="${Zx(z)}" y2="${Yy(sh.crowd_heads.height_from_floor)}" stroke="#c4cad0" stroke-width="8" stroke-linecap="round"/>`);
  }
  o.push(`<line x1="${Zx(-0.6) + 6}" y1="${Yy(sh.crowd_heads.height_from_floor - 0.3)}" x2="${Zx(-0.6) + 6}" y2="${Yy(sh.front_row_hands.height_from_floor)}" stroke="#aab2ba" stroke-width="4" stroke-linecap="round"/>`);
  o.push(`<text x="${Zx(-0.6) - 4}" y="${Yy(sh.front_row_hands.height_from_floor) - 6}" ${FONT} font-size="12" text-anchor="end" fill="${C.dim}">руки ${sh.front_row_hands.height_from_floor} м</text>`);
  // Проєктор на стійці.
  o.push(`<line x1="${Zx(PZ)}" y1="${Yy(0)}" x2="${Zx(PZ)}" y2="${Yy(H)}" stroke="${C.line}" stroke-width="2"/>`);
  o.push(`<rect x="${Zx(PZ) - 14}" y="${Yy(H) - 9}" width="28" height="18" fill="${C.proj}"/>`);

  o.push(dim(Zx(PZ) - 30, Yy(0), Zx(PZ) - 30, Yy(H), `${f(H)} м`, -1));
  o.push(dim(Zx(0) - 12, Yy(0), Zx(0) - 12, Yy(S), `${f(S)}`, -1));
  o.push(dim(Zx(Y) + 40, Yy(S), Zx(Y) + 40, Yy(S + scrim.height), `${f(scrim.height)} м`, 1));
  o.push(dim(Zx(PZ), Yy(0) + 26, Zx(0), Yy(0) + 26, `${f(D - Y)} м`, 1));
  o.push(dim(Zx(0), Yy(0) + 26, Zx(Y), Yy(0) + 26, `${f(Y)}`, 1));
  o.push(dim(Zx(PZ), Yy(0) + 54, Zx(Y), Yy(0) + 54, `лінза → сітка ${f(D)} м`, 1));
  o.push(`<text x="${Zx(PZ / 2)}" y="${Yy(0) - 8 - sh.crowd_heads.height_from_floor * SC}" ${FONT} font-size="13" text-anchor="middle" fill="${C.dim}">ЗАЛА</text>`);
  return doc(W, Hh + 50, o.join('\n'), 'LOVIXX · розріз по осі сцени');
}

function save(name, svg) {
  writeFileSync(join(outDir, name + '.svg'), svg);
  const png = new Resvg(svg, { fitTo: { mode: 'zoom', value: 2 }, font: { loadSystemFonts: true, defaultFontFamily: 'Arial' } }).render().asPng();
  writeFileSync(join(outDir, name + '.png'), png);
}

mkdirSync(outDir, { recursive: true });
save('rider_top', top());
save('rider_section', section());
console.log(`схеми → ${outDir}`);
