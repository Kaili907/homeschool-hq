#!/usr/bin/env node
import { FOUNDATION_SCENARIOS } from "../../corpus/foundation/index.js";
import { renderHumanReport, renderMachineReport, runFoundationEvaluation } from "./index.js";

const formatArgument = process.argv.find((argument) => argument.startsWith("--format="));
const format = formatArgument?.slice("--format=".length) ?? "human";
if (format !== "human" && format !== "json") {
  process.stderr.write("Usage: cli.js [--format=human|json]\n");
  process.exitCode = 2;
} else {
  const report = runFoundationEvaluation(FOUNDATION_SCENARIOS);
  process.stdout.write(format === "json" ? renderMachineReport(report) : renderHumanReport(report));
  if (report.classification === "FOUNDATION_GATE_FAIL") process.exitCode = 1;
}
