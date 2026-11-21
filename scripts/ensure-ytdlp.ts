import { env } from "../src/lib/env";
import { ensureYtDlpAvailable, getYtDlpVersion } from "../src/lib/sources/ytdlp";

async function main() {
  if (!env.allowRemoteFetch) {
    console.log("Remote fetching is disabled; skipping yt-dlp setup.");
    return;
  }

  const binary = await ensureYtDlpAvailable();
  const version = await getYtDlpVersion(binary);
  console.log(`yt-dlp ${version} is ready for URL imports.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
