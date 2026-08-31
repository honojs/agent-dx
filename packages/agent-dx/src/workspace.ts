import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'

/** Create an empty temporary workspace directory for one agent run. */
export async function createWorkspace(prefix: string): Promise<string> {
  return await mkdtemp(join(tmpdir(), `agent-dx-${prefix}-`))
}

/** Copy a fixture directory into a fresh temporary workspace. */
export async function createWorkspaceFrom(
  prefix: string,
  fixtureDir: string,
): Promise<string> {
  const workspace = await createWorkspace(prefix)
  await cp(fixtureDir, workspace, { recursive: true })
  return workspace
}

export async function removeWorkspace(workspace: string): Promise<void> {
  await rm(workspace, { recursive: true, force: true })
}

const PERSIST_SKIP = new Set(['node_modules', '.agent-dx', '.git'])

/**
 * Copy a finished workspace to a durable location for inspection,
 * leaving out installed dependencies and grader files.
 */
export async function persistWorkspace(
  workspace: string,
  dest: string,
): Promise<void> {
  await mkdir(dirname(dest), { recursive: true })
  await cp(workspace, dest, {
    recursive: true,
    filter: (source) => !PERSIST_SKIP.has(basename(source)),
  })
}
