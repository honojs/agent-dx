import { execFile } from 'node:child_process'

export interface ExecResult {
  ok: boolean
  stdout: string
  stderr: string
}

/** Run a command without a shell, capturing output. Never throws. */
export function exec(
  command: string,
  args: string[],
  options: { cwd: string; timeoutMs?: number }
): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        cwd: options.cwd,
        timeout: options.timeoutMs ?? 120_000,
        maxBuffer: 10 * 1024 * 1024,
        env: process.env,
      },
      (error, stdout, stderr) => {
        resolve({ ok: error === null, stdout, stderr })
      }
    )
  })
}
