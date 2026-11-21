/** DANGER: drops all Clipwave data (local SQLite mode only). */
import fs from "node:fs";
import path from "node:path";
import { env } from "../src/lib/env";

if (env.databaseUrl) {
  console.error(
    "Refusing to reset a remote PostgreSQL database. Run your own SQL / restore from a backup.",
  );
  process.exit(1);
}

const file = path.resolve(env.sqlitePath);
for (const suffix of ["", "-wal", "-shm"]) {
  const target = `${file}${suffix}`;
  if (fs.existsSync(target)) {
    fs.rmSync(target);
    console.log(`removed ${target}`);
  }
}
console.log("Database reset. Run `npm run db:init && npm run seed` next.");
