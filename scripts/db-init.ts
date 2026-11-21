/** Applies db/migrations/*.sql to the configured database (SQLite or Postgres). */
import { db } from "../src/lib/db";
import { env } from "../src/lib/env";

async function main() {
  const driver = await db();
  console.log(
    `✓ migrations applied · driver=${driver.name} · ${
      driver.name === "postgres" ? "DATABASE_URL" : env.sqlitePath
    }`,
  );
  await driver.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
