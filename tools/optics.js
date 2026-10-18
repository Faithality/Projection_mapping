// Калькулятор оптики. Значення за замовчуванням — з config/stage_config.json, будь-яке можна перекрити прапорцем.
// Запуск: node optics.js [--D 12.5] [--H 4] [--off 2] [--Y 2.5] [--lumens 6000] [--n 2]
//                        [--tr-min 1.2] [--tr-max 2.0] [--reflectance 0.3] [--config шлях]
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HELP = `Прапорці (метри, якщо не сказано інше):
  --D            відстань лінза → сітка
  --H            висота лінзи від підлоги зали
  --off          розведення проєкторів від осі сцени
  --Y            сітка від краю сцени
  --lumens       ANSI лм одного проєктора (за замовч. максимум з конфігу)
  --n            кількість проєкторів у stack
  --tr-min, --tr-max   діапазон throw ratio лінзи
  --scrim-w, --scrim-h розміри сітки
  --reflectance  коефіцієнт відбиття сітки 0–1 (без нього nit не рахується)
  --artist-h, --artist-d  ріст артиста і відстань перед сіткою
  --config       шлях до stage_config.json`;

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '-h' || a === '--help') { console.log(HELP); process.exit(0); }
  if (!a.startsWith('--') || argv[i + 1] === undefined) { console.error(`Незрозумілий аргумент: ${a}\n\n${HELP}`); process.exit(1); }
  args[a.slice(2)] = argv[++i];
}
const here = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(resolve(args.config ?? join(here, '../config/stage_config.json')), 'utf8'));
const num = (key, def) => {
  if (args[key] === undefined) return def;
  const v = parseFloat(String(args[key]).replace(',', '.'));
  if (!Number.isFinite(v)) { console.error(`--${key}: не число (${args[key]})`); process.exit(1); }
  return v;
};

const { stage, scrim, canvas, projectors: pr, shadow_checks: sh } = cfg;
const S = stage.height_above_floor;
const p = {
  D: num('D', pr.distance_to_scrim),
  H: num('H', pr.lens_height_from_floor),
  off: num('off', pr.offset_from_axis),
  Y: num('Y', scrim.z),
  lumens: num('lumens', pr.lumens_ansi[1]),
  n: num('n', pr.count),
  trMin: num('tr-min', pr.throw_ratio[0]),
  trMax: num('tr-max', pr.throw_ratio[1]),
  scrimW: num('scrim-w', scrim.width),
  scrimH: num('scrim-h', scrim.height),
  refl: num('reflectance', null),
  artistH: num('artist-h', sh.artist.height),
  artistD: num('artist-d', sh.artist.distance_before_scrim)
};

// Кадр 16:9 на всю ширину сітки, низ кадру на рівні сцени (як у конфігу полотна).
const [RW, RH] = canvas.resolution;
const W = p.scrimW, Hc = W * RH / RW;
const SEP_MIN = 0.45; // зсув тіней двох проєкторів, від якого вони стають напівтінями

const r = {};
r.trNeed = p.D / W;
r.zoomOk = r.trNeed >= p.trMin && r.trNeed <= p.trMax;
r.imgWMin = p.D / p.trMax;
r.imgWMax = p.D / p.trMin;
r.dMin = p.trMin * W;
r.dMax = p.trMax * W;
r.toEdge = p.D - p.Y;
r.lux = p.n * p.lumens / (W * Hc);
r.nit = p.refl === null ? null : r.lux * p.refl / Math.PI;
r.shift = (p.H - (S + Hc / 2)) / Hc;
r.artist = p.H + (S + p.artistH - p.H) * p.D / (p.D - p.artistD) - S;
r.hands = p.H + (sh.front_row_hands.height_from_floor - p.H) * p.D / (p.D - p.Y) - S;
r.sep = 2 * p.off * p.artistD / (p.D - p.artistD);
r.scrimFits = p.scrimH <= Hc;

// Нижній край променя: від лінзи до низу кадру на сітці. Де він опускається до висоти h над підлогою зали.
function beamReaches(h) {
  if (p.H <= h) return { always: true };
  const t = p.D * (p.H - h) / (p.H - S); // від лінзи по глибині
  return { beforeEdge: p.D - p.Y - t };   // >0 — у залі перед краєм сцени
}
r.beamHands = beamReaches(sh.front_row_hands.height_from_floor);
r.beamHeads = beamReaches(sh.crowd_heads.height_from_floor);

const f = (v, d = 2) => v.toFixed(d);
const ok = b => (b ? '  ' : '! ');
const rows = [];
const row = (flag, label, value) => rows.push([flag, label, value]);

row('  ', 'Відстань лінза → сітка', `${f(p.D)} м (до краю сцени ${f(r.toEdge)} м)`);
row('  ', 'Висота лінзи від підлоги', `${f(p.H)} м`);
row('  ', 'Кадр на сітці', `${f(W)} × ${f(Hc)} м (16:9, низ на рівні сцени)`);
row(ok(r.scrimFits), 'Сітка в кадрі по висоті', r.scrimFits ? `так, ${f(p.scrimH)} ≤ ${f(Hc)} м` : `ні, ${f(p.scrimH)} > ${f(Hc)} м`);
row(ok(r.zoomOk), 'Потрібний throw ratio', `${f(r.trNeed)} (лінза ${f(p.trMin, 1)}–${f(p.trMax, 1)})`);
row('  ', 'Ширина зображення на цій D', `${f(r.imgWMin)}–${f(r.imgWMax)} м по зуму`);
row('  ', 'Допустима D для цієї лінзи', `${f(r.dMin, 1)}–${f(r.dMax, 1)} м`);
row(ok(r.shift <= pr.min_vertical_shift), 'Vertical lens shift', `потрібно ${Math.round(r.shift * 100)}% (у вимогах до лінзи ≥ ${Math.round(pr.min_vertical_shift * 100)}%)`);
row('  ', 'Освітленість сітки', `≈ ${Math.round(r.lux)} lux (${p.n} × ${p.lumens} лм, номінал)`);
row('  ', 'Яскравість сітки', r.nit === null ? '— (задай --reflectance)' : `≈ ${Math.round(r.nit)} nit при відбитті ${p.refl}`);
row(ok(r.artist <= 1.7), 'Тінь артиста на сітці', `до ${f(Math.max(0, r.artist))} м над сценою (${p.artistH} м, за ${p.artistD} м перед сіткою)`);
row(ok(r.hands <= 0.8), 'Тінь рук першого ряду', r.hands > 0 ? `до ${f(r.hands)} м над сценою` : 'немає');
row(ok(p.n >= 2 && r.sep >= SEP_MIN), 'Зсув тіней двох проєкторів', p.n < 2 ? 'один проєктор — тіні чорні' : `${f(r.sep)} м → ${r.sep >= SEP_MIN ? 'напівтіні' : 'накладаються'} (поріг ${SEP_MIN} м)`);
const beamText = (b, what) => b.always ? `${what}: увесь промінь нижче лінзи — перевір` : b.beforeEdge > 0 ? `${what} у промені на ${f(b.beforeEdge)} м перед краєм сцени` : `${what}: промінь не опускається до них у залі`;
row('  ', 'Нижній край променя', beamText(r.beamHands, `руки ${sh.front_row_hands.height_from_floor} м`));
row('  ', '', beamText(r.beamHeads, `голови ${sh.crowd_heads.height_from_floor} м`));

const w = Math.max(...rows.map(x => x[1].length));
console.log(rows.map(([fl, l, v]) => `${fl}${l.padEnd(w)}  ${v}`).join('\n'));
if (r.nit !== null) console.log('\nnit — оцінка для дифузної поверхні (lux × відбиття / π). Сітка пропускає частину світла, реальне значення перевіряється тестом зразка.');
