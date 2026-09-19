import { Queue } from "bullmq";
import { redis } from "./redis";

/**
 * Defined but unconsumed this phase — see lib/import/pipeline.ts, which is
 * called synchronously from the import Server Action instead. A future
 * phase adds a worker (`new Worker("import", handler, { connection })`)
 * that calls the exact same `runImportPipeline(importJobId)` function.
 */
export const importQueue = new Queue("import", { connection: redis });
