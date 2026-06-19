import { execSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as dotenv from 'dotenv'

const backendDir = path.resolve(__dirname, '../backend')
const testEnv = dotenv.parse(fs.readFileSync(path.join(backendDir, '.env.test'), 'utf-8'))
const env = { ...process.env, ...testEnv }

// bun is not on PATH in all shell contexts — resolve it from the known install location
const bun = process.platform === 'win32'
  ? path.join(os.homedir(), '.bun', 'bin', 'bun.exe')
  : path.join(os.homedir(), '.bun', 'bin', 'bun')

export default async function globalSetup() {
  // Push schema to test database (no migration history needed)
  // Must use bun — Node.js 20 has ESM/CJS interop issues with this Prisma version
  execSync(`"${bun}" node_modules/prisma/build/index.js db push --accept-data-loss`, {
    cwd: backendDir,
    env,
    stdio: 'inherit',
  })

  // Seed test users (admin@test.com, agent@test.com)
  execSync(`"${bun}" run prisma/seed-test.ts`, {
    cwd: backendDir,
    env,
    stdio: 'inherit',
  })
}
