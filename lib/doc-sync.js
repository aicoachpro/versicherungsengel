/**
 * lib/doc-sync.js — Versicherungsengel Documentation Sync
 *
 * Based on OpenCLAW Governance Framework
 *
 * WHAT IT DOES:
 *   1. Reads all DOC_FILES from config.js
 *   2. Updates the version string in each file
 *   3. Optionally mirrors files to TheBrain Vault (frontmatter + wikilinks)
 *   4. Creates timestamped changelog entries
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const PROJECT_PATH = process.env.PROJECT_PATH || path.join(__dirname, '..');
const config       = require(path.join(PROJECT_PATH, 'lib/config'));

// --- TheBrain/Obsidian Vault Mapping ---
const OBSIDIAN_MAPPING = {
  'CLAUDE.md': '/Users/togglodyte/Documents/TheBrain/Versicherungsengel/CLAUDE.md',
  'SYSTEM_ARCHITECTURE.md': '/Users/togglodyte/Documents/TheBrain/Versicherungsengel/SYSTEM_ARCHITECTURE.md',
  'CHANGELOG.md': '/Users/togglodyte/Documents/TheBrain/Versicherungsengel/CHANGELOG.md',
};

// --- Changelog ---

const CHANGELOG_PATH = path.join(PROJECT_PATH, 'CHANGELOG.md');

function appendChangelog(version, description) {
  if (!fs.existsSync(CHANGELOG_PATH)) return;

  const today   = new Date().toISOString().slice(0, 10);
  const entry   = `\n## v${version} — ${today}\n\n${description}\n`;
  const content = fs.readFileSync(CHANGELOG_PATH, 'utf8');

  if (!content.includes(`## v${version}`)) {
    fs.writeFileSync(CHANGELOG_PATH, entry + content);
    console.log(`[DocSync] Changelog entry added for v${version}`);
  }
}

// --- Obsidian: Frontmatter Injection ---

function injectFrontmatter(content, filename, version) {
  const timestamp = new Date().toISOString();
  const frontmatter = [
    '---',
    `sync_source: "${filename}"`,
    `sync_version: "${version}"`,
    `sync_timestamp: "${timestamp}"`,
    '---',
    '',
  ].join('\n');

  const withoutFm = content.startsWith('---')
    ? content.replace(/^---[\s\S]*?---\n/, '')
    : content;

  return frontmatter + withoutFm;
}

// --- Core: Sync All Docs ---

async function syncAllDocs(targetVersion) {
  const { DOC_FILES } = config;
  if (!DOC_FILES) {
    console.error('[DocSync] DOC_FILES not found in config.js');
    return 0;
  }

  let synced = 0;
  let obsidianSynced = 0;

  for (const [name, def] of Object.entries(DOC_FILES)) {
    const filePath = path.join(PROJECT_PATH, def.path);
    if (!fs.existsSync(filePath)) {
      console.warn(`[DocSync] File not found, skipping: ${filePath}`);
      continue;
    }

    const original = fs.readFileSync(filePath, 'utf8');

    const updated = original.replace(def.versionPattern, (match, oldVersion) => {
      return match.replace(oldVersion, targetVersion);
    });

    if (updated !== original) {
      fs.writeFileSync(filePath, updated, 'utf8');
      synced++;
      console.log(`[DocSync] Updated ${name}: v${_extractVersion(original, def)} → v${targetVersion}`);
    } else {
      console.log(`[DocSync] ${name}: already at v${targetVersion} ✓`);
    }

    // Mirror to TheBrain/Obsidian if mapping exists
    if (OBSIDIAN_MAPPING[name]) {
      try {
        const vaultPath = OBSIDIAN_MAPPING[name];
        const vaultContent = injectFrontmatter(updated, name, targetVersion);
        fs.mkdirSync(path.dirname(vaultPath), { recursive: true });
        fs.writeFileSync(vaultPath, vaultContent, 'utf8');
        obsidianSynced++;
      } catch (err) {
        console.warn(`[DocSync] Vault sync failed for ${name}: ${err.message}`);
      }
    }
  }

  const total = Object.keys(DOC_FILES).length;
  console.log(`[DocSync] Done: ${synced}/${total} files updated to v${targetVersion}` +
    (obsidianSynced > 0 ? ` | ${obsidianSynced} mirrored to TheBrain` : ''));

  if (synced > 0) {
    appendChangelog(targetVersion, `- Documentation synced to v${targetVersion} (auto-sync by self-healing)`);
  }

  return synced;
}

function _extractVersion(content, def) {
  const match = content.match(def.versionPattern);
  return match ? match[1] : '?';
}

// --- Export + CLI ---

module.exports = { syncAllDocs };

// CLI: node lib/doc-sync.js [targetVersion]
if (require.main === module) {
  const targetVersion = process.argv[2] || config.VERSION;
  if (!targetVersion) {
    console.error('Usage: node lib/doc-sync.js [version]');
    process.exit(1);
  }
  syncAllDocs(targetVersion)
    .then(count => {
      console.log(`[DocSync] CLI complete — ${count} files updated`);
      process.exit(0);
    })
    .catch(err => {
      console.error('[DocSync] Error:', err);
      process.exit(1);
    });
}
