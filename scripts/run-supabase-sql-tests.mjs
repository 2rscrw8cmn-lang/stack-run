import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const testsDir = join(root, 'supabase', 'tests')
const config = readFileSync(join(root, 'supabase', 'config.toml'), 'utf8')
const projectId = /^project_id\s*=\s*"([^"]+)"/m.exec(config)?.[1]

if (!projectId) throw new Error('supabase/config.toml is missing project_id')

const container =
  process.env.STACK_SUPABASE_DB_CONTAINER ?? `supabase_db_${projectId}`
const tests = readdirSync(testsDir)
  .filter((file) => /^\d{4}_.+\.sql$/.test(file))
  .sort()

for (const test of tests) {
  const sql = readFileSync(join(testsDir, test))
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
    ],
    { input: sql, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  )

  if (result.status !== 0) {
    console.error(`FAILED ${test}`)
    if (result.stdout) console.error(result.stdout)
    if (result.stderr) console.error(result.stderr)
    process.exit(result.status ?? 1)
  }
  console.log(`PASS ${test}`)
}

console.log(`Verified ${tests.length} transaction-style SQL checks.`)
