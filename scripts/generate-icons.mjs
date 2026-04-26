import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const pub = join(root, 'public');
const svg = readFileSync(join(pub, 'icon-source.svg'));

const sizes = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png',         size: 192 },
  { file: 'icon-512.png',         size: 512 },
  { file: 'favicon-32.png',       size: 32  },
  { file: 'favicon-16.png',       size: 16  },
  { file: '_ico-48.png',          size: 48  }, // temp, bundled into ICO below
];

for (const { file, size } of sizes) {
  await sharp(svg).resize(size, size).png().toFile(join(pub, file));
  console.log(`✓ ${file}`);
}

const ico = await pngToIco([
  join(pub, 'favicon-16.png'),
  join(pub, 'favicon-32.png'),
  join(pub, '_ico-48.png'),
]);
writeFileSync(join(pub, 'favicon.ico'), ico);
console.log('✓ favicon.ico');

// remove temp 48px file
import { unlinkSync } from 'fs';
unlinkSync(join(pub, '_ico-48.png'));
console.log('Done.');
