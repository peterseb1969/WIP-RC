import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import path from 'path'

// E2E settings. Defaults target the local wip-local install through its
// router; every value can be overridden from the environment. Secrets are
// read from the deployer's secret files, never stored in the repo.
const secrets = path.join(homedir(), '.wip-deploy', process.env.E2E_DEPLOYMENT ?? 'wip-local', 'secrets')

export const E2E = {
  /** RC behind the WIP router (trailing slash: page paths resolve under it). */
  baseURL: process.env.E2E_BASE_URL ?? 'https://localhost:8443/apps/rc/',
  /** The WIP gateway, for fixture setup through the API. */
  wipURL: process.env.E2E_WIP_URL ?? 'https://localhost:8443',
  user: process.env.E2E_USER ?? 'e2e@wip.local',
  passwordFile: process.env.E2E_PASSWORD_FILE ?? path.join(secrets, 'dex-password-e2e'),
  apiKeyFile: process.env.E2E_API_KEY_FILE ?? path.join(secrets, 'api-key'),
  /** A user outside ALLOWED_GROUPS (the deployer's default viewer), for the access checks. */
  viewerUser: process.env.E2E_VIEWER_USER ?? 'viewer@wip.local',
  viewerPasswordFile: process.env.E2E_VIEWER_PASSWORD_FILE ?? path.join(secrets, 'dex-password-viewer'),
  /** Saved browser session (login once in global setup). */
  stateFile: path.resolve('test-results/e2e/.auth.json'),
  /** This run's disposable namespace, written by global setup. */
  runFile: path.resolve('test-results/e2e/.run.json'),
}

/** Prefix of every namespace the suite creates; stale ones are removed on the next run. */
export const NAMESPACE_PREFIX = 'rc-e2e-'

export function readSecret(file: string): string {
  return readFileSync(file, 'utf-8').trim()
}

export interface RunInfo {
  namespace: string
  /** A second namespace, for checks that a same-named entity elsewhere is not picked up. */
  twin: string
}

export function writeRun(info: RunInfo): void {
  mkdirSync(path.dirname(E2E.runFile), { recursive: true })
  writeFileSync(E2E.runFile, JSON.stringify(info))
}

/** The current run's info (namespace), as written by global setup. */
export function run(): RunInfo {
  return JSON.parse(readFileSync(E2E.runFile, 'utf-8')) as RunInfo
}
