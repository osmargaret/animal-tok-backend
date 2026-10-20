import { Pool } from "pg";
import dotenv from "dotenv";
import dns from "dns";

dotenv.config();

// Ensure reliable DNS resolution for Neon cloud endpoints across local ISPs / Windows
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Ignore in environments where custom DNS servers cannot be set
}

// Monkey-patch dns.lookup for neon.tech so pg / net.connect uses public DNS instead of failing local router DNS
const originalLookup = dns.lookup.bind(dns);
// @ts-ignore
dns.lookup = (hostname: string, options: any, callback: any) => {
  const cb = typeof options === "function" ? options : callback;
  const opts = typeof options === "object" ? options : {};

  if (hostname && typeof hostname === "string" && hostname.includes("neon.tech")) {
    dns.resolve4(hostname, (err, addresses) => {
      if (!err && addresses && addresses.length > 0) {
        if (opts.all) {
          return cb(null, addresses.map((addr) => ({ address: addr, family: 4 })));
        }
        return cb(null, addresses[0], 4);
      }
      return originalLookup(hostname, opts, cb);
    });
  } else {
    return originalLookup(hostname, opts, cb);
  }
};

/**
 * Shared connection pool for Neon Postgres.
 * Uses the DATABASE_URL from .env — pooler URL recommended for serverless/express.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Required for Neon TLS
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle pg client", err);
});

/**
 * Run a query against the Neon database.
 */
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== "production") {
    console.log(`[pg] query: ${text.substring(0, 60)}... | duration: ${duration}ms | rows: ${res.rowCount}`);
  }
  return res;
}
