import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const versionFilePath = path.join(__dirname, '..', 'public', 'version.json');

try {
  let currentVersion = 'v1.1.0';
  if (fs.existsSync(versionFilePath)) {
    const data = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
    if (data.version) {
      currentVersion = data.version;
    }
  }

  // Parse version parts e.g. v1.1.0 -> [1, 1, 0]
  const versionMatch = currentVersion.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  let major = 1;
  let minor = 1;
  let patch = 0;

  if (versionMatch) {
    major = parseInt(versionMatch[1], 10);
    minor = parseInt(versionMatch[2], 10);
    patch = parseInt(versionMatch[3], 10) + 1;
  }

  const newVersion = `v${major}.${minor}.${patch}`;
  const nowISO = new Date().toISOString();

  const newVersionData = {
    version: newVersion,
    buildTime: nowISO
  };

  fs.writeFileSync(versionFilePath, JSON.stringify(newVersionData, null, 2) + '\n', 'utf8');
  console.log(`\x1b[32m[Version Auto-Update]\x1b[0m Version updated successfully: \x1b[36m${newVersion}\x1b[0m (${nowISO})`);
} catch (error) {
  console.error('\x1b[31m[Version Auto-Update Error]\x1b[0m', error);
  process.exit(1);
}
