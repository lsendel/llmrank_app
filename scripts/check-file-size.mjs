import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const includeRoots = [
  "apps/api/src/routes",
  "apps/web/src/app",
  "apps/web/src/components",
];
const exts = [".ts", ".tsx"];
const warnAt = 800;
const failAt = 1200;

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, acc);
      continue;
    }
    if (!exts.some((ext) => entry.name.endsWith(ext))) continue;
    acc.push(fullPath);
  }
  return acc;
}

const findings = [];

for (const folder of includeRoots) {
  const dir = join(root, folder);
  for (const file of walk(dir)) {
    const source = readFileSync(file, "utf8");
    const lines = source.split(/\r\n|\n|\r/).length;
    if (lines <= warnAt) continue;
    findings.push({
      file: relative(root, file),
      lines,
      severity: lines > failAt ? "fail" : "warn",
      bytes: statSync(file).size,
    });
  }
}

if (findings.length === 0) {
  console.log("File size guardrail passed.");
  process.exit(0);
}

for (const finding of findings) {
  const prefix = finding.severity === "fail" ? "FAIL" : "WARN";
  console.log(
    `${prefix}: ${finding.file} has ${finding.lines} lines (${finding.bytes} bytes)`,
  );
}

if (findings.some((finding) => finding.severity === "fail")) {
  console.error(`One or more files exceeded the hard limit of ${failAt} lines.`);
  process.exit(1);
}


