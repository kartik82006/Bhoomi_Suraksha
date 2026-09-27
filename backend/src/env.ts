import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Must be imported first (before any module that reads process.env at load
// time, e.g. the JWT secret defaults in auth.ts) since ES module imports are
// evaluated in declaration order.
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env") });
