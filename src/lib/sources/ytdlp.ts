import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { env } from "../env";

const execFileAsync = promisify(execFile);
const RELEASE_BASE = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";

let resolvedPath: string | null = null;
let resolving: Promise<string> | null = null;

function releaseAsset(): string {
  if (process.platform === "win32") {
    if (process.arch === "x64") return "yt-dlp.exe";
    if (process.arch === "arm64") return "yt-dlp_arm64.exe";
    if (process.arch === "ia32") return "yt-dlp_x86.exe";
  }
  if (process.platform === "darwin") return "yt-dlp_macos";
  if (process.platform === "linux") {
    if (process.arch === "x64") return "yt-dlp_linux";
    if (process.arch === "arm64") return "yt-dlp_linux_aarch64";
  }
  throw new Error(
    `Automatic yt-dlp setup does not support ${process.platform}/${process.arch}. Install yt-dlp and set YTDLP_PATH.`,
  );
}

function localBinaryPath(asset: string): string {
  return path.resolve(process.cwd(), "data", "tools", asset);
}

async function hasWorkingBinary(binary: string): Promise<boolean> {
  try {
    const { stdout, stderr } = await execFileAsync(binary, ["--version"], {
      timeout: 30_000,
      windowsHide: true,
    });
    return Boolean(`${stdout}${stderr}`.trim());
  } catch {
    return false;
  }
}

async function downloadAndInstall(asset: string, targetPath: string): Promise<void> {
  const [binaryResponse, sumsResponse] = await Promise.all([
    fetch(`${RELEASE_BASE}/${asset}`, { signal: AbortSignal.timeout(60_000) }),
    fetch(`${RELEASE_BASE}/SHA2-256SUMS`, { signal: AbortSignal.timeout(30_000) }),
  ]);
  if (!binaryResponse.ok) {
    throw new Error(`yt-dlp download failed (${binaryResponse.status} ${binaryResponse.statusText}).`);
  }
  if (!sumsResponse.ok) {
    throw new Error(`Could not download yt-dlp checksums (${sumsResponse.status}).`);
  }

  const [binary, checksums] = await Promise.all([
    binaryResponse.arrayBuffer().then((data) => Buffer.from(data)),
    sumsResponse.text(),
  ]);
  const checksumLine = checksums.split(/\r?\n/).find((line) => {
    const match = line.match(/^([a-f0-9]{64})\s+\*?(.+?)\s*$/i);
    return match?.[2] === asset;
  });
  const expectedHash = checksumLine?.match(/^([a-f0-9]{64})/i)?.[1]?.toLowerCase();
  if (!expectedHash) throw new Error(`The official checksum list has no entry for ${asset}.`);

  const actualHash = createHash("sha256").update(binary).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error("The downloaded yt-dlp binary failed its SHA-256 checksum.");
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.${process.pid}.${randomUUID()}.download`;
  try {
    await fs.writeFile(tempPath, binary, { flag: "wx" });
    if (process.platform !== "win32") await fs.chmod(tempPath, 0o755);
    try {
      await fs.rename(tempPath, targetPath);
    } catch (error) {
      // Another app/worker process may have installed it at the same time.
      if (!(await hasWorkingBinary(targetPath))) throw error;
      await fs.rm(tempPath, { force: true });
    }
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
  }
}

async function resolveYtDlpPath(): Promise<string> {
  const asset = releaseAsset();
  const bundledPath = localBinaryPath(asset);
  const configuredPath = env.ytdlpPath.trim();

  for (const candidate of [...new Set([configuredPath, bundledPath].filter(Boolean))]) {
    if (await hasWorkingBinary(candidate)) return candidate;
  }

  try {
    await downloadAndInstall(asset, bundledPath);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not set up yt-dlp automatically: ${reason} Check your internet connection or install yt-dlp and set YTDLP_PATH.`,
    );
  }

  if (!(await hasWorkingBinary(bundledPath))) {
    throw new Error("yt-dlp was downloaded but could not be started. Check the binary and YTDLP_PATH.");
  }
  return bundledPath;
}

/** Find yt-dlp or fetch and verify the official binary into the ignored data/tools folder. */
export function ensureYtDlpAvailable(): Promise<string> {
  if (resolvedPath) return Promise.resolve(resolvedPath);
  if (!resolving) {
    resolving = resolveYtDlpPath()
      .then((binary) => {
        resolvedPath = binary;
        return binary;
      })
      .finally(() => {
        resolving = null;
      });
  }
  return resolving;
}

export async function getYtDlpVersion(binary: string): Promise<string> {
  const { stdout, stderr } = await execFileAsync(binary, ["--version"], {
    timeout: 10_000,
    windowsHide: true,
  });
  return `${stdout}${stderr}`.trim();
}
