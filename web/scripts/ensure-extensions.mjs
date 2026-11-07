// Runs inside the migrator image before `drizzle-kit push`: the schema needs pg_trgm for its
// trigram index, and a volume created before init-extensions.sql exists will not have it.
import { Client } from "pg";

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query("create extension if not exists pg_trgm");
await client.end();
console.log("pg_trgm ready");
