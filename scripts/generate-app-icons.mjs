import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await fs.readFile(path.join(projectRoot, 'app.json'), 'utf8')).expo;
const source = path.resolve(projectRoot, config.ios.icon);

// Use Icon Composer's renderer. Xcode's Developer/usr/bin/ictool is a different,
// compiler-only executable and cannot export previews.
const candidates = [
  process.env.ICON_COMPOSER_ICTOOL,
  '/Applications/Icon Composer.app/Contents/Executables/ictool',
  '/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool',
];
try {
  const developerDir = execFileSync('xcode-select', ['-p'], { encoding: 'utf8' }).trim();
  candidates.push(path.resolve(developerDir, '../Applications/Icon Composer.app/Contents/Executables/ictool'));
} catch {
  // Standalone Icon Composer does not require Xcode's command-line tools.
}

let renderer;
for (const candidate of candidates.filter(Boolean)) {
  try {
    await fs.access(candidate, fs.constants.X_OK);
    renderer = candidate;
    break;
  } catch {
    // Try the next supported installation location.
  }
}
if (!renderer) {
  throw new Error('Install Icon Composer on macOS, or set ICON_COMPOSER_ICTOOL to its Contents/Executables/ictool.');
}

const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'buckys-bites-icons-'));
try {
  const renderedIcon = path.join(temporaryDirectory, 'icon.png');
  execFileSync(renderer, [
    source,
    '--export-image',
    '--output-file', renderedIcon,
    '--platform', 'iOS',
    '--rendition', 'Default',
    '--width', '1024',
    '--height', '1024',
    '--scale', '1',
  ], { stdio: 'inherit' });

  // iOS uses the layered source directly. These rendered PNGs are for Expo's
  // general icon (including legacy Android launchers) and the web favicon.
  for (const [target, size] of [[config.icon, 1024], [config.web.favicon, 64]]) {
    const destination = path.resolve(projectRoot, target);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await sharp(renderedIcon).resize(size, size).toColourspace('srgb').png().toFile(destination);
    console.log(`Generated ${path.relative(projectRoot, destination)} (${size}×${size}).`);
  }
} finally {
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}
