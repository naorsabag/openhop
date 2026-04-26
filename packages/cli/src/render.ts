/**
 * `openhop render` — produce a static (PNG) or animated (MP4) snapshot of a
 * flow.
 *
 * v0.1 scope: png + mp4 only. svg/url are deferred.
 *
 * Approach: use Playwright Chromium against the running OpenHop web app.
 *  - PNG: navigate to /flow/{id}, wait for the React Flow viewport to settle,
 *    take a full-page screenshot.
 *  - MP4: record the page via Playwright's built-in video recording (webm),
 *    then transcode to mp4 with system ffmpeg.
 *
 * The server must already be running (start with `openhop serve`). We do not
 * auto-spawn the server in v0.1 — that's a much bigger lifecycle change.
 */
import type { Command } from 'commander'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join, isAbsolute } from 'node:path'
import { parseFlowYaml } from '@openhop/shared'
import { readInput, errorMessage, green, red, dim, cyan } from './utils.js'

// Local exit-code constants. The foundation module exit-codes.ts may not exist
// yet; once it lands the main thread will swap these for shared imports.
export const EXIT = {
  OK: 0,
  GENERIC: 1,
  USAGE: 2,
  VALIDATION: 3,
  NETWORK: 6,
} as const

const DEFAULT_SERVER = 'http://localhost:8787'
const SUPPORTED_FORMATS = ['png', 'mp4'] as const
type RenderFormat = (typeof SUPPORTED_FORMATS)[number]

interface RenderOptions {
  format: string
  output: string
  json?: boolean
  server: string
  duration?: string
}

interface RenderSuccess {
  format: RenderFormat
  output: string
  id: string
  url: string
}

function isTty(): boolean {
  return Boolean(process.stdout.isTTY)
}

function humanError(msg: string): string {
  return isTty() ? red(`✗ ${msg}`) : `✗ ${msg}`
}

function humanOk(msg: string): string {
  return isTty() ? green(`✓ ${msg}`) : `✓ ${msg}`
}

function humanDim(msg: string): string {
  return isTty() ? dim(msg) : msg
}

function humanCyan(msg: string): string {
  return isTty() ? cyan(msg) : msg
}

function emitJsonError(code: number, error: string, extra?: Record<string, unknown>): never {
  const payload = { error, exitCode: code, ...extra }
  process.stderr.write(JSON.stringify(payload) + '\n')
  process.exit(code)
}

function fail(json: boolean | undefined, code: number, msg: string, extra?: Record<string, unknown>): never {
  if (json) {
    emitJsonError(code, msg, extra)
  }
  process.stderr.write(humanError(msg) + '\n')
  process.exit(code)
}

function deriveWebUrl(serverUrl: string): string {
  // The server runs on :8787 and the web app on :8788. Mirror push's logic.
  return serverUrl.replace(/:\d+(\/?$)/, ':8788$1').replace(/\/$/, '')
}

async function ping(server: string): Promise<boolean> {
  try {
    const res = await fetch(`${server}/health`, { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}

function which(cmd: string): boolean {
  // Tiny synchronous PATH check. We only call this once for `ffmpeg`.
  const PATH = process.env.PATH ?? ''
  const sep = process.platform === 'win32' ? ';' : ':'
  for (const dir of PATH.split(sep)) {
    if (!dir) continue
    const p = join(dir, cmd)
    if (existsSync(p)) return true
    if (process.platform === 'win32' && existsSync(p + '.exe')) return true
  }
  return false
}

function runFfmpeg(input: string, output: string): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const args = ['-y', '-i', input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output]
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderrBuf = ''
    child.stderr?.on('data', (d) => {
      stderrBuf += d.toString()
    })
    child.on('error', rejectPromise)
    child.on('exit', (code) => {
      if (code === 0) resolvePromise()
      else rejectPromise(new Error(`ffmpeg exited with code ${code}: ${stderrBuf.slice(-400)}`))
    })
  })
}

/**
 * Validate flags. Throws the usage error to stderr and returns the exit code
 * the caller should use; returns null on success.
 *
 * Exported so tests can exercise it without invoking commander.
 */
export function validateRenderOptions(
  file: string | undefined,
  opts: Partial<RenderOptions>,
): { ok: true; format: RenderFormat } | { ok: false; code: number; message: string } {
  if (!file) {
    return { ok: false, code: EXIT.USAGE, message: 'missing required argument: <file>' }
  }
  if (!opts.format) {
    return { ok: false, code: EXIT.USAGE, message: 'missing required flag: --format <png|mp4>' }
  }
  if (!opts.output) {
    return { ok: false, code: EXIT.USAGE, message: 'missing required flag: --output <path>' }
  }
  if (!(SUPPORTED_FORMATS as readonly string[]).includes(opts.format)) {
    return {
      ok: false,
      code: EXIT.USAGE,
      message: `unsupported format "${opts.format}". v0.1 supports: ${SUPPORTED_FORMATS.join(', ')}`,
    }
  }
  return { ok: true, format: opts.format as RenderFormat }
}

/**
 * Validate YAML using the shared zod schema. Returns null on success or a
 * formatted multi-line error message.
 */
export function validateYaml(yamlContent: string): null | string {
  const result = parseFlowYaml(yamlContent)
  if (result.success) return null
  const lines = result.errors.map((e) => `  ${e.path}: ${e.message}${e.suggestion ? ' ' + e.suggestion : ''}`)
  return ['invalid flow YAML:', ...lines].join('\n')
}

async function pushFlow(
  server: string,
  yamlContent: string,
): Promise<{ id: string; title: string; version: number }> {
  const res = await fetch(`${server}/api/flows`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/yaml' },
    body: yamlContent,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`server responded ${res.status}: ${body}`)
  }
  return (await res.json()) as { id: string; title: string; version: number }
}

async function renderPng(webUrl: string, id: string, outputPath: string): Promise<void> {
  // Lazy import — playwright is heavy. Only load when actually rendering.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let playwright: any
  try {
    playwright = await import('playwright')
  } catch (err) {
    throw new Error(
      `playwright is not installed. Run \`npm install playwright && npx playwright install chromium\`. (${errorMessage(err)})`,
    )
  }
  const browser = await playwright.chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()
    await page.goto(`${webUrl}/flow/${id}`, { waitUntil: 'networkidle' })
    // Wait for React Flow to mount + ELK to lay things out.
    await page.waitForSelector('.react-flow__viewport', { timeout: 15000 })
    // Brief settle delay for ELK animation/PIXI canvas mount.
    await page.waitForTimeout(800)
    await page.screenshot({ path: outputPath, fullPage: false })
  } finally {
    await browser.close()
  }
}

async function renderMp4(
  webUrl: string,
  id: string,
  outputPath: string,
  durationSec: number,
): Promise<void> {
  if (!which('ffmpeg')) {
    throw new Error('mp4 rendering requires `ffmpeg` on PATH. Install ffmpeg and retry.')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let playwright: any
  try {
    playwright = await import('playwright')
  } catch (err) {
    throw new Error(
      `playwright is not installed. Run \`npm install playwright && npx playwright install chromium\`. (${errorMessage(err)})`,
    )
  }
  const tmpDir = mkdtempSync(join(tmpdir(), 'openhop-render-'))
  const browser = await playwright.chromium.launch({ headless: true })
  let webmPath: string | null = null
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: { dir: tmpDir, size: { width: 1280, height: 800 } },
    })
    const page = await context.newPage()
    await page.goto(`${webUrl}/flow/${id}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.react-flow__viewport', { timeout: 15000 })
    await page.waitForTimeout(durationSec * 1000)
    const video = page.video()
    await context.close()
    if (video) {
      webmPath = await video.path()
    }
    if (!webmPath) {
      // Fallback: scan tmp dir for the produced webm.
      const found = readdirSync(tmpDir).find((f) => f.endsWith('.webm'))
      if (found) webmPath = join(tmpDir, found)
    }
    if (!webmPath || !existsSync(webmPath)) {
      throw new Error('playwright did not produce a video file')
    }
    await runFfmpeg(webmPath, outputPath)
  } finally {
    await browser.close()
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // best-effort cleanup
    }
  }
}

export function registerRender(program: Command): void {
  program
    .command('render <file>')
    .description('Render a flow to an image or video (use - for stdin)')
    .requiredOption('--format <format>', 'output format: png or mp4')
    .requiredOption('--output <path>', 'output file path')
    .option('--json', 'emit machine-readable JSON to stdout')
    .option('-s, --server <url>', 'server URL', DEFAULT_SERVER)
    .option('--duration <seconds>', 'mp4 capture duration in seconds', '6')
    .action(async (file: string, opts: RenderOptions) => {
      // 1. Flag validation (exit 2).
      const v = validateRenderOptions(file, opts)
      if (!v.ok) {
        fail(opts.json, v.code, v.message)
      }
      const format = v.format

      const outputAbs = isAbsolute(opts.output) ? opts.output : resolve(process.cwd(), opts.output)
      const durationSec = Math.max(1, Math.min(60, Number(opts.duration ?? '6') || 6))

      // 2. Read + validate YAML (exit 3).
      let yamlContent: string
      try {
        yamlContent = readInput(file)
      } catch (err) {
        fail(opts.json, EXIT.GENERIC, `cannot read input: ${errorMessage(err)}`)
      }
      const yamlErr = validateYaml(yamlContent!)
      if (yamlErr) {
        fail(opts.json, EXIT.VALIDATION, yamlErr)
      }

      // 3. Server reachability check (exit 6).
      const server = opts.server || DEFAULT_SERVER
      const reachable = await ping(server)
      if (!reachable) {
        fail(
          opts.json,
          EXIT.NETWORK,
          `openhop render requires the server to be running at ${server}; start with \`openhop serve\``,
        )
      }

      // 4. Push the flow to obtain an id + url.
      let pushed: { id: string; title: string; version: number }
      try {
        pushed = await pushFlow(server, yamlContent!)
      } catch (err) {
        fail(opts.json, EXIT.NETWORK, `push failed: ${errorMessage(err)}`)
      }

      const webUrl = deriveWebUrl(server)
      const flowUrl = `${webUrl}/flow/${pushed!.id}`

      // 5. Render.
      try {
        if (format === 'png') {
          await renderPng(webUrl, pushed!.id, outputAbs)
        } else {
          await renderMp4(webUrl, pushed!.id, outputAbs, durationSec)
        }
      } catch (err) {
        fail(opts.json, EXIT.GENERIC, `render failed: ${errorMessage(err)}`)
      }

      // Sanity check: ensure the output exists at the requested path.
      if (!existsSync(outputAbs)) {
        fail(opts.json, EXIT.GENERIC, `renderer did not produce ${outputAbs}`)
      }

      // 6. Success output.
      const result: RenderSuccess = { format, output: outputAbs, id: pushed!.id, url: flowUrl }
      if (opts.json) {
        process.stdout.write(JSON.stringify(result) + '\n')
      } else {
        process.stdout.write(humanOk(`rendered ${format} → ${outputAbs}`) + '\n')
        process.stdout.write(`  ${humanDim('flow:')} ${humanCyan(flowUrl)}\n`)
      }
      process.exit(EXIT.OK)
    })
}
