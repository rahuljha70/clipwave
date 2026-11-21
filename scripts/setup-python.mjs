import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const venvDir = path.join(root, "python", ".venv");
const venvPython = process.platform === "win32"
  ? path.join(venvDir, "Scripts", "python.exe")
  : path.join(venvDir, "bin", "python");

function invoke(binary, args, options = {}) {
  return spawnSync(binary, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    ...options,
  });
}

function findPython() {
  const candidates = [
    ...(process.env.PYTHON_INSTALLER_BIN ? [[process.env.PYTHON_INSTALLER_BIN, []]] : []),
    ...(process.env.PYTHON_BIN ? [[process.env.PYTHON_BIN, []]] : []),
    ["python", []],
    ["python3", []],
    ...(process.platform === "win32" ? [["py", ["-3"]]] : []),
  ];
  const seen = new Set();

  for (const [binary, prefix] of candidates) {
    const key = `${binary} ${prefix.join(" ")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const result = invoke(binary, [...prefix, "--version"]);
    const version = `${result.stdout ?? ""}${result.stderr ?? ""}`.match(/Python\s+(\d+)\.(\d+)/i);
    if (result.status === 0 && version && Number(version[1]) === 3 && Number(version[2]) >= 10 && Number(version[2]) <= 13) {
      return { binary, prefix };
    }
  }

  throw new Error("Python 3.10–3.13 was not found. Install Python, then run npm run setup:python again.");
}

function runOrThrow(binary, args, label) {
  const result = invoke(binary, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}.`);
}

try {
  const python = findPython();
  if (!fs.existsSync(venvPython)) {
    runOrThrow(python.binary, [...python.prefix, "-m", "venv", venvDir], "Creating the project Python environment");
  }

  runOrThrow(
    venvPython,
    ["-m", "pip", "install", "-r", path.join(root, "python", "requirements.txt")],
    "Installing Clipwave Python requirements",
  );

  const envFile = path.join(root, ".env.local");
  if (fs.existsSync(envFile)) {
    let content = fs.readFileSync(envFile, "utf8");
    const setting = `PYTHON_BIN="${venvPython}"`;
    if (/^PYTHON_BIN=.*$/m.test(content)) {
      content = content.replace(/^PYTHON_BIN=.*$/m, setting);
    } else {
      content += `${content.endsWith("\n") ? "" : "\n"}${setting}\n`;
    }
    fs.writeFileSync(envFile, content);
  }

  console.log(`Clipwave Python environment is ready: ${venvPython}`);
  console.log("Restart the worker to use local Whisper and audio analysis.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
