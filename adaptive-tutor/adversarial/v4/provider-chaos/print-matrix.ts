import { runProviderChaosCertification } from "./matrix.js";

process.stdout.write(`${JSON.stringify(runProviderChaosCertification(), null, 2)}\n`);
