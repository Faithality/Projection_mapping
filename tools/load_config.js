// Завантаження конфігу: config/stage_config.json + необов'язковий файл майданчика поверх нього.
// Файл майданчика (експорт з превізу) має ті самі ключі, що й конфіг; об'єкти зливаються, масиви замінюються,
// ключі на «_» (коментарі) ігноруються.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (k.startsWith('_')) continue;
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? merge(base[k], v) : v;
  }
  return out;
}

export function loadConfig(configPath, venuePath) {
  const cfg = JSON.parse(readFileSync(resolve(configPath), 'utf8'));
  if (!venuePath) return cfg;
  return merge(cfg, JSON.parse(readFileSync(resolve(venuePath), 'utf8')));
}

// Витягає --venue <шлях> з argv; повертає [шлях або undefined, решта аргументів].
export function takeVenueArg(argv) {
  const i = argv.indexOf('--venue');
  if (i < 0) return [undefined, argv];
  if (!argv[i + 1]) { console.error('--venue: потрібен шлях до файлу майданчика'); process.exit(1); }
  return [argv[i + 1], [...argv.slice(0, i), ...argv.slice(i + 2)]];
}
