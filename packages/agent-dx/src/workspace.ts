import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
