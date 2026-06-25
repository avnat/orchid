#!/usr/bin/env node
// Build GitHub Release notes for a tag: canonical install block (from
// RELEASE_NOTES_TEMPLATE.md) + the matching CHANGELOG.md section.
// Usage: node scripts/release-notes.mjs v1.2.0   (or v1.2.0-rc.1)
import { readFileSync } from 'node:fs'

const tag = (process.argv[2] || '').trim()
const version = tag.replace(/^v/, '') // 1.2.0  or 1.2.0-rc.1
const base = version.replace(/-.*$/, '') // 1.2.0 (strip prerelease suffix)
const isPre = version.includes('-')

// Install block — single source of truth is the template.
const tpl = readFileSync('RELEASE_NOTES_TEMPLATE.md', 'utf8')
const installMatch = tpl.match(/## Download & install[\s\S]*?(?=\n## )/)
const install = (installMatch ? installMatch[0] : '## Download & install\n')
  .replace(/\{\{VERSION\}\}/g, version)
  .trim()

// Changelog section for the base version.
const log = readFileSync('CHANGELOG.md', 'utf8')
const reBase = base.replace(/\./g, '\\.')
const secMatch = log.match(new RegExp(`## ${reBase}[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`))
const notes = secMatch ? secMatch[1].trim() : `_No CHANGELOG entry found for ${base}._`

const summary = isPre
  ? `**Release candidate ${version}** — for testing. This is a prerelease and won't be offered to users as the latest version.`
  : `Orchid ${version}.`

process.stdout.write(
  `${summary}

${install}

## What's new in ${base}

${notes}

---
Full history: [CHANGELOG.md](https://github.com/avnat/orchid/blob/main/CHANGELOG.md)
`
)
