import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = join(root, 'supabase', 'migrations')
const baselinePath = join(root, 'supabase', 'migrations.baseline.json')
const filenamePattern = /^(\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
const files = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort()
const errors = []
const versions = new Set()
const baselineByFile = new Map(
  baseline.migrations.map((entry) => [entry.file, entry.sha256]),
)

for (const file of files) {
  const match = filenamePattern.exec(file)
  if (!match) {
    errors.push(`${file}: expected YYYYMMDDHHMMSS_snake_case.sql`)
    continue
  }

  const version = match[1]
  if (versions.has(version)) errors.push(`${file}: duplicate version ${version}`)
  versions.add(version)

  const sql = readFileSync(join(migrationsDir, file))
  if (sql.length === 0) errors.push(`${file}: migration is empty`)

  if (version <= baseline.frozenThrough) {
    const expected = baselineByFile.get(file)
    if (!expected) {
      errors.push(`${file}: historical version is absent from migrations.baseline.json`)
      continue
    }
    const normalizedSql = sql.toString('utf8').replace(/\r\n?/g, '\n')
    const actual = createHash('sha256').update(normalizedSql).digest('hex')
    if (actual !== expected) {
      errors.push(`${file}: historical migration changed; add a forward-only migration`)
    }
  }
}

for (const entry of baseline.migrations) {
  if (!files.includes(entry.file)) {
    errors.push(`${entry.file}: frozen historical migration is missing`)
  }
  const match = filenamePattern.exec(entry.file)
  if (!match || match[1] > baseline.frozenThrough) {
    errors.push(`${entry.file}: invalid frozen-baseline entry`)
  }
}

for (let index = 1; index < files.length; index += 1) {
  if (files[index - 1].localeCompare(files[index]) >= 0) {
    errors.push('migration filenames are not strictly ordered')
    break
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'))
  process.exit(1)
}

const forwardCount = files.filter(
  (file) => filenamePattern.exec(file)?.[1] > baseline.frozenThrough,
).length
console.log(
  `Verified ${files.length} ordered migrations (${baseline.migrations.length} frozen, ${forwardCount} forward).`,
)
