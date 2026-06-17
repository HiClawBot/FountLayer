import { setupTestDatabase } from "./test-database.js";
import { isDirectRun } from "./runtime.js";

if (isDirectRun(import.meta.url)) {
  await setupTestDatabase();
}
