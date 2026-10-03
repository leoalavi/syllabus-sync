import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const args = process.argv.slice(2);
const scanRoots = args.length ? args : ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'docs'];
const docExtensions = new Set(['.md', '.mdx']);
const issues = [];

function shouldScan(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return docExtensions.has(ext);
}

function walk(targetPath) {
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      walk(path.join(targetPath, entry.name));
    }
    return;
  }

  if (!shouldScan(targetPath)) return;
  checkFile(targetPath);
}

function recordIssue(filePath, lineNumber, link, message) {
  issues.push({
    file: path.relative(root, filePath),
    line: lineNumber,
    link,
    message,
  });
}

function resolveTarget(filePath, link) {
  const [rawPath, rawFragment] = link.split('#');
  if (!rawPath) {
    return {
      exists: true,
      fragment: rawFragment ?? '',
      resolvedPath: filePath,
    };
  }

  const resolvedPath = path.resolve(path.dirname(filePath), rawPath);
  return {
    exists: fs.existsSync(resolvedPath),
    fragment: rawFragment ?? '',
    resolvedPath,
  };
}

function normalizeHeading(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function collectAnchors(filePath) {
  const anchors = new Set();
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const headingMatch = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (headingMatch) anchors.add(normalizeHeading(headingMatch[2]));

    for (const explicitId of line.matchAll(/\{#([A-Za-z0-9._:-]+)\}/g)) {
      anchors.add(explicitId[1]);
    }
    for (const htmlId of line.matchAll(/\sid=["']([^"']+)["']/g)) {
      anchors.add(htmlId[1]);
    }
  }
  return anchors;
}

function checkFragment(filePath, resolvedPath, fragment, lineNumber, link) {
  if (!fragment) return;

  const ext = path.extname(resolvedPath).toLowerCase();
  if (!docExtensions.has(ext)) return;

  const anchors = collectAnchors(resolvedPath);
  if (!anchors.has(normalizeHeading(fragment)) && !anchors.has(fragment)) {
    recordIssue(
      filePath,
      lineNumber,
      link,
      `missing fragment in ${path.relative(root, resolvedPath)}`,
    );
  }
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const matches = [
      ...line.matchAll(/!?\[[^\]]*]\(([^)]+)\)/g),
      ...line.matchAll(/<img[^>]+src=["']([^"']+)["']/g),
    ];

    for (const match of matches) {
      const link = match[1].trim();
      if (!link) continue;
      if (
        link.startsWith('http://') ||
        link.startsWith('https://') ||
        link.startsWith('mailto:') ||
        link.startsWith('data:')
      ) {
        continue;
      }

      const { exists, fragment, resolvedPath } = resolveTarget(filePath, link);
      if (!exists) {
        recordIssue(filePath, index + 1, link, 'missing local target');
        continue;
      }

      const stat = fs.statSync(resolvedPath);
      if (stat.isDirectory()) continue;

      checkFragment(filePath, resolvedPath, fragment, index + 1, link);
    }
  });
}

for (const target of scanRoots) {
  const resolved = path.resolve(root, target);
  if (!fs.existsSync(resolved)) {
    console.error(`Scan root not found: ${target}`);
    process.exitCode = 1;
    continue;
  }
  walk(resolved);
}

if (issues.length) {
  for (const issue of issues) {
    console.log(`${issue.file}:${issue.line}  ${issue.message}  -> ${issue.link}`);
  }
  process.exit(1);
}

console.log(`Checked local links in ${scanRoots.join(', ')} with no broken references.`);
