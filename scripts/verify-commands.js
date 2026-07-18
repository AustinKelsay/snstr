#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

const MARKDOWN_IGNORED_DIRECTORIES = new Set([
  ".git",
  "coverage",
  "dist",
  "dist-examples",
  "node_modules",
]);
const MARKDOWN_TEMPLATE_SCRIPTS = new Set([
  "example:nipXX",
  "test:nipXX",
]);
const NPM_RUN_PATTERN = /\bnpm\s+(?:run|run-script)\s+([A-Za-z0-9:_-]+)/g;
const NPM_LIFECYCLE_PATTERN = /\bnpm\s+(test|start|stop|restart)(?=\s|$)/g;

function isRunnableScript(name) {
  return !name.startsWith("//");
}

function runnableScripts(scripts) {
  return Object.fromEntries(
    Object.entries(scripts).filter(([name]) => isRunnableScript(name)),
  );
}

function findExactDuplicateScripts(scripts) {
  const scriptsByCommand = new Map();

  for (const [name, command] of Object.entries(runnableScripts(scripts))) {
    const names = scriptsByCommand.get(command) ?? [];
    names.push(name);
    scriptsByCommand.set(command, names);
  }

  return [...scriptsByCommand.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([command, names]) => ({ command, scripts: names.sort() }))
    .sort((left, right) => left.command.localeCompare(right.command));
}

function findRootNpmScriptTargets(command, scripts) {
  // A leading `cd` delegates the remaining npm commands to another package;
  // those names do not belong to the root script graph.
  if (/^\s*cd(?:\s|$)/.test(command)) return [];

  return [
    ...[...command.matchAll(NPM_RUN_PATTERN)].map((match) => ({
      index: match.index,
      targets: [match[1]],
    })),
    ...[...command.matchAll(NPM_LIFECYCLE_PATTERN)].map((match) => ({
      index: match.index,
      targets:
        match[1] === "restart" && !(match[1] in scripts)
          ? [...("stop" in scripts ? ["stop"] : []), "start"]
          : [match[1]],
    })),
  ]
    .sort((left, right) => left.index - right.index)
    .flatMap(({ targets }) => targets);
}

function canonicalizeCycle(cycle) {
  const nodes = cycle.slice(0, -1);
  const rotations = nodes.map((_, index) => [
    ...nodes.slice(index),
    ...nodes.slice(0, index),
  ]);
  rotations.sort((left, right) => left.join("\0").localeCompare(right.join("\0")));
  return [...rotations[0], rotations[0][0]];
}

function analyzeScriptGraph(scripts) {
  const runnable = runnableScripts(scripts);
  const references = new Map(
    Object.entries(runnable).map(([name, command]) => [
      name,
      findRootNpmScriptTargets(command, runnable),
    ]),
  );
  const canonicalLeafByCommand = new Map();

  for (const [name, command] of Object.entries(runnable).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (!canonicalLeafByCommand.has(command)) {
      canonicalLeafByCommand.set(command, name);
    }
  }

  const missingReferences = [];
  for (const [owner, targets] of references) {
    for (const target of targets) {
      if (!(target in runnable)) {
        missingReferences.push({ owner, target });
      }
    }
  }

  const cyclesByKey = new Map();
  const memoizedLeaves = new Map();

  function expand(name, stack) {
    const cycleStart = stack.indexOf(name);
    if (cycleStart >= 0) {
      const cycle = canonicalizeCycle([...stack.slice(cycleStart), name]);
      cyclesByKey.set(cycle.join("\0"), cycle);
      return [];
    }
    if (memoizedLeaves.has(name)) return memoizedLeaves.get(name);

    const targets = references.get(name) ?? [];
    if (targets.length === 0) {
      const leaf = canonicalLeafByCommand.get(runnable[name]) ?? name;
      const leaves = [leaf];
      memoizedLeaves.set(name, leaves);
      return leaves;
    }

    const leaves = [];
    for (const target of targets) {
      if (target in runnable) {
        leaves.push(...expand(target, [...stack, name]));
      }
    }
    memoizedLeaves.set(name, leaves);
    return leaves;
  }

  const duplicateLeafExecutions = [];
  for (const owner of Object.keys(runnable).sort()) {
    const counts = new Map();
    for (const leaf of expand(owner, [])) {
      counts.set(leaf, (counts.get(leaf) ?? 0) + 1);
    }
    for (const [leaf, count] of counts) {
      if (count > 1) duplicateLeafExecutions.push({ owner, leaf, count });
    }
  }

  return {
    cycles: [...cyclesByKey.values()].sort((left, right) =>
      left.join("\0").localeCompare(right.join("\0")),
    ),
    duplicateLeafExecutions: duplicateLeafExecutions.sort((left, right) =>
      `${left.owner}\0${left.leaf}`.localeCompare(`${right.owner}\0${right.leaf}`),
    ),
    missingReferences: missingReferences.sort((left, right) =>
      `${left.owner}\0${left.target}`.localeCompare(`${right.owner}\0${right.target}`),
    ),
  };
}

function findMarkdownCommandReferences(content, file) {
  return [...content.matchAll(NPM_RUN_PATTERN)].map((match) => ({
    file,
    line: content.slice(0, match.index).split("\n").length,
    script: match[1],
  }));
}

function findMissingMarkdownReferences(references, scripts) {
  return references.filter(
    ({ script }) =>
      !MARKDOWN_TEMPLATE_SCRIPTS.has(script) && !(script in scripts),
  );
}

function analyzeCommandReference(content, scripts) {
  const headings = [...content.matchAll(/^## Command Reference\s*$/gm)];
  const listedRows = [];

  if (headings.length === 1) {
    const sectionStart = headings[0].index + headings[0][0].length;
    const remainder = content.slice(sectionStart);
    const nextSection = remainder.search(/^##\s+/m);
    const section = nextSection >= 0 ? remainder.slice(0, nextSection) : remainder;
    for (const match of section.matchAll(
      /^\|\s*`npm run ([A-Za-z0-9:_-]+)`\s*\|\s*`(.*)`\s*\|\s*$/gm,
    )) {
      listedRows.push({
        command: match[2].replaceAll("\\|", "|"),
        script: match[1],
      });
    }
  }

  const runnableNames = Object.keys(runnableScripts(scripts)).sort();
  const counts = new Map();
  for (const { script } of listedRows) {
    counts.set(script, (counts.get(script) ?? 0) + 1);
  }

  return {
    duplicateScripts: [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([name]) => name)
      .sort(),
    headingCount: headings.length,
    mismatchedDefinitions: listedRows
      .filter(
        ({ command, script }) =>
          script in scripts && command !== scripts[script],
      )
      .map(({ command, script }) => ({
        actual: command,
        expected: scripts[script],
        script,
      }))
      .sort((left, right) => left.script.localeCompare(right.script)),
    missingScripts: runnableNames.filter((name) => !counts.has(name)),
    unknownScripts: [...counts.keys()]
      .filter((name) => !runnableNames.includes(name))
      .sort(),
  };
}

function collectMarkdownFiles(directory, repoRoot = directory) {
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (MARKDOWN_IGNORED_DIRECTORIES.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(absolutePath, repoRoot));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path.relative(repoRoot, absolutePath).replaceAll(path.sep, "/"));
    }
  }

  return files.sort();
}

function verifyRepository(repoRoot) {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
  );
  const scripts = packageJson.scripts ?? {};
  const errors = [];

  for (const duplicate of findExactDuplicateScripts(scripts)) {
    errors.push(
      `exact duplicate command ${JSON.stringify(duplicate.command)}: ${duplicate.scripts.join(", ")}`,
    );
  }

  const graph = analyzeScriptGraph(scripts);
  for (const { owner, target } of graph.missingReferences) {
    errors.push(`${owner} references missing script ${target}`);
  }
  for (const cycle of graph.cycles) {
    errors.push(`script cycle: ${cycle.join(" -> ")}`);
  }
  for (const { owner, leaf, count } of graph.duplicateLeafExecutions) {
    errors.push(`${owner} executes leaf script ${leaf} ${count} times`);
  }

  const markdownReferences = collectMarkdownFiles(repoRoot).flatMap((file) =>
    findMarkdownCommandReferences(
      fs.readFileSync(path.join(repoRoot, file), "utf8"),
      file,
    ),
  );
  for (const { file, line, script } of findMissingMarkdownReferences(
    markdownReferences,
    scripts,
  )) {
    errors.push(`${file}:${line} references missing script ${script}`);
  }

  const commandReference = analyzeCommandReference(
    fs.readFileSync(path.join(repoRoot, "README.md"), "utf8"),
    scripts,
  );
  if (commandReference.headingCount !== 1) {
    errors.push(
      `README.md must contain exactly one Command Reference; found ${commandReference.headingCount}`,
    );
  }
  for (const script of commandReference.missingScripts) {
    errors.push(`README.md Command Reference is missing script ${script}`);
  }
  for (const script of commandReference.duplicateScripts) {
    errors.push(`README.md Command Reference lists script ${script} more than once`);
  }
  for (const { actual, expected, script } of commandReference.mismatchedDefinitions) {
    errors.push(
      `README.md Command Reference defines ${script} as ${JSON.stringify(actual)}; expected ${JSON.stringify(expected)}`,
    );
  }
  for (const script of commandReference.unknownScripts) {
    errors.push(`README.md Command Reference lists unknown script ${script}`);
  }

  return errors.sort();
}

function runCli(repoRoot = path.resolve(__dirname, "..")) {
  const errors = verifyRepository(repoRoot);
  if (errors.length > 0) {
    console.error("[commands:verify] Command inventory verification failed:");
    for (const error of errors) console.error(`- ${error}`);
    return 1;
  }

  console.log(
    "[commands:verify] Package scripts, grouped execution, and Markdown references are consistent.",
  );
  return 0;
}

module.exports = {
  analyzeCommandReference,
  analyzeScriptGraph,
  findExactDuplicateScripts,
  findMarkdownCommandReferences,
  findMissingMarkdownReferences,
  runCli,
  verifyRepository,
};

if (require.main === module) {
  const requestedRoot = process.argv[2]
    ? path.resolve(process.argv[2])
    : undefined;
  process.exitCode = runCli(requestedRoot);
}
