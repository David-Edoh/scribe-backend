const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = process.argv[2] || process.cwd();

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".idea",
  ".vscode",
]);

const tsFiles: string[] = [];

/**
 * Recursively walks a directory.
 */
function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        walk(fullPath);
      }
      continue;
    }

    if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.endsWith(".d.ts")
    ) {
      tsFiles.push(fullPath);
    }
  }
}

/**
 * Counts lines in a file.
 */
function countLines(file) {
  const content = fs.readFileSync(file, "utf8");

  if (content.length === 0) return 0;

  return content.split(/\r?\n/).length;
}

console.log(`Scanning ${PROJECT_ROOT}...`);

walk(PROJECT_ROOT);

const results = tsFiles.map(file => ({
  file,
  lines: countLines(file),
}));

results.sort((a, b) => b.lines - a.lines);

console.log("\nTop 10 longest TypeScript files:\n");

results.slice(0, 10).forEach((result, index) => {
  console.log(
    `${String(index + 1).padStart(2)}. ${result.lines
      .toString()
      .padStart(5)} lines  ${path.relative(PROJECT_ROOT, result.file)}`
  );
});

console.log(`\nScanned ${results.length} TypeScript files.`);