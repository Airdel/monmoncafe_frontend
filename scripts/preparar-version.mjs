// Turns the "Sin publicar" section of CHANGELOG.md into a new version.
// Usage: node scripts/preparar-version.mjs <patch|minor|major>
// Bumps package.json, dates the section and writes its notes to release-notes.md.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const bump = process.argv[2];
if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error('Usage: node scripts/preparar-version.mjs <patch|minor|major>');
  process.exit(1);
}

const UNRELEASED = '## [Sin publicar]';
const changelog = readFileSync('CHANGELOG.md', 'utf8');
const start = changelog.indexOf(UNRELEASED);
if (start < 0) throw new Error(`CHANGELOG.md has no "${UNRELEASED}" section`);
const bodyStart = start + UNRELEASED.length;
const next = changelog.indexOf('\n## ', bodyStart);
const bodyEnd = next < 0 ? changelog.length : next;
const notes = changelog.slice(bodyStart, bodyEnd).trim();
if (!notes) {
  console.error('::error::"Sin publicar" in CHANGELOG.md is empty: add what changed before publishing a version');
  process.exit(1);
}

const [major, minor, patch] = JSON.parse(readFileSync('package.json', 'utf8')).version.split('.').map(Number);
const version =
  bump === 'major' ? `${major + 1}.0.0` : bump === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
execSync(`npm version ${version} --no-git-tag-version`, { stdio: 'ignore' });

// Date in the café's time zone
const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mazatlan' });
writeFileSync(
  'CHANGELOG.md',
  `${changelog.slice(0, bodyStart)}\n\n## [${version}] - ${date}\n\n${notes}\n${changelog.slice(bodyEnd)}`,
);
writeFileSync('release-notes.md', `${notes}\n`);
console.log(version);
