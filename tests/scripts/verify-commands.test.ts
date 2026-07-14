/* eslint-disable @typescript-eslint/no-var-requires */

import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

interface DuplicateCommand {
  command: string;
  scripts: string[];
}

interface ScriptReference {
  owner: string;
  target: string;
}

interface DuplicateLeafExecution {
  owner: string;
  leaf: string;
  count: number;
}

interface ScriptGraphAnalysis {
  cycles: string[][];
  duplicateLeafExecutions: DuplicateLeafExecution[];
  missingReferences: ScriptReference[];
}

interface MarkdownReference {
  file: string;
  line: number;
  script: string;
}

interface CommandVerifier {
  analyzeCommandReference(
    content: string,
    scripts: Record<string, string>,
  ): {
    duplicateScripts: string[];
    headingCount: number;
    mismatchedDefinitions: Array<{
      actual: string;
      expected: string;
      script: string;
    }>;
    missingScripts: string[];
    unknownScripts: string[];
  };
  analyzeScriptGraph(scripts: Record<string, string>): ScriptGraphAnalysis;
  findExactDuplicateScripts(
    scripts: Record<string, string>,
  ): DuplicateCommand[];
  findMarkdownCommandReferences(
    content: string,
    file: string,
  ): MarkdownReference[];
  findMissingMarkdownReferences(
    references: MarkdownReference[],
    scripts: Record<string, string>,
  ): MarkdownReference[];
  verifyRepository(repoRoot: string): string[];
}

const verifier = require('../../scripts/verify-commands.js') as CommandVerifier;

describe('command inventory verifier', () => {
  test('finds exact duplicate runnable commands while ignoring section headings', () => {
    expect(
      verifier.findExactDuplicateScripts({
        '// Build': '-------------- Build Commands --------------',
        canonical: 'node task.js',
        alias: 'node task.js',
        distinct: 'node other.js',
      }),
    ).toEqual([
      {
        command: 'node task.js',
        scripts: ['alias', 'canonical'],
      },
    ]);
  });

  test('recursively finds duplicate leaf execution, missing targets, and cycles', () => {
    const result = verifier.analyzeScriptGraph({
      leaf: 'node leaf.js',
      first: 'npm run leaf',
      second: 'npm run leaf',
      duplicate: 'npm run first && npm run second',
      missing: 'npm run absent',
      'cycle:a': 'npm run cycle:b',
      'cycle:b': 'npm run cycle:a',
      test: 'jest',
      'test:all': 'npm test',
      'test:twice': 'npm run test:all && npm test',
    });

    expect(result.duplicateLeafExecutions).toContainEqual({
      owner: 'duplicate',
      leaf: 'leaf',
      count: 2,
    });
    expect(result.missingReferences).toEqual([
      { owner: 'missing', target: 'absent' },
    ]);
    expect(result.cycles).toContainEqual(['cycle:a', 'cycle:b', 'cycle:a']);
    expect(result.duplicateLeafExecutions).toContainEqual({
      owner: 'test:twice',
      leaf: 'test',
      count: 2,
    });
  });

  test('does not treat commands delegated to a nested package as root references', () => {
    expect(
      verifier.analyzeScriptGraph({
        nested: 'cd examples/browser && npm run package-local-build',
      }),
    ).toEqual({
      cycles: [],
      duplicateLeafExecutions: [],
      missingReferences: [],
    });
  });

  test('models npm restart with and without an explicit restart script', () => {
    const fallback = verifier.analyzeScriptGraph({
      start: 'node start.js',
      stop: 'node stop.js',
      restartFallback: 'npm restart',
      duplicateFallback:
        'npm run restartFallback && npm run stop && npm run start',
    });

    expect(fallback.missingReferences).toEqual([]);
    expect(fallback.duplicateLeafExecutions).toEqual([
      { owner: 'duplicateFallback', leaf: 'start', count: 2 },
      { owner: 'duplicateFallback', leaf: 'stop', count: 2 },
    ]);

    const explicit = verifier.analyzeScriptGraph({
      restart: 'node restart.js',
      restartExplicit: 'npm restart',
      duplicateExplicit: 'npm run restartExplicit && npm run restart',
    });

    expect(explicit.missingReferences).toEqual([]);
    expect(explicit.duplicateLeafExecutions).toEqual([
      { owner: 'duplicateExplicit', leaf: 'restart', count: 2 },
    ]);
  });

  test('requires start when npm restart uses its fallback lifecycle', () => {
    expect(
      verifier.analyzeScriptGraph({
        stop: 'node stop.js',
        restartFallback: 'npm restart',
      }).missingReferences,
    ).toEqual([{ owner: 'restartFallback', target: 'start' }]);
  });

  test('validates literal Markdown references with only explicit NIP templates ignored', () => {
    const references = verifier.findMarkdownCommandReferences(
      [
        'Run `npm run real`.',
        'Broken: npm run missing',
        'Template: npm run example:nipXX',
        'Template: npm run test:nipXX',
        'Not a template: npm run example:nipXX:extra',
      ].join('\n'),
      'guide.md',
    );

    expect(verifier.findMissingMarkdownReferences(references, { real: 'node real.js' }))
      .toEqual([
        { file: 'guide.md', line: 2, script: 'missing' },
        { file: 'guide.md', line: 5, script: 'example:nipXX:extra' },
      ]);
  });

  test('requires one complete canonical README command table', () => {
    expect(
      verifier.analyzeCommandReference(
        [
          '## Command Reference',
          '',
          '| Command | Definition |',
          '| --- | --- |',
          '| `npm run listed` | `node listed.js` |',
          '| `npm run listed` | `node listed.js` |',
          '| `npm run wrong-definition` | `node stale.js` |',
          '| `npm run stale` | `node stale.js` |',
          '',
          '## Development',
        ].join('\n'),
        {
          '// Build': 'heading',
          listed: 'node listed.js',
          missing: 'node missing.js',
          'wrong-definition': 'node current.js',
        },
      ),
    ).toEqual({
      duplicateScripts: ['listed'],
      headingCount: 1,
      mismatchedDefinitions: [
        {
          actual: 'node stale.js',
          expected: 'node current.js',
          script: 'wrong-definition',
        },
      ],
      missingScripts: ['missing'],
      unknownScripts: ['stale'],
    });
  });

  test('the public CLI reports success for the current repository', () => {
    const result = spawnSync(
      'npm',
      ['run', 'commands:verify', '--', process.cwd()],
      { cwd: process.cwd(), encoding: 'utf8' },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      '[commands:verify] Package scripts, grouped execution, and Markdown references are consistent.',
    );
  });

  test('the public CLI exits nonzero and diagnoses an invalid repository', () => {
    const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'snstr-commands-'));
    try {
      writeFileSync(
        path.join(fixtureRoot, 'package.json'),
        JSON.stringify({
          scripts: {
            duplicateA: 'node same.js',
            duplicateB: 'node same.js',
          },
        }),
      );
      writeFileSync(
        path.join(fixtureRoot, 'README.md'),
        [
          '## Command Reference',
          '',
          '| Command | Definition |',
          '| --- | --- |',
          '| `npm run duplicateA` | `node same.js` |',
          '| `npm run duplicateB` | `node same.js` |',
        ].join('\n'),
      );

      const result = spawnSync(
        'npm',
        ['run', 'commands:verify', '--', fixtureRoot],
        { cwd: process.cwd(), encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        '[commands:verify] Command inventory verification failed:',
      );
      expect(result.stderr).toContain('exact duplicate command');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('the repository command and Markdown inventory is internally consistent', () => {
    expect(verifier.verifyRepository(process.cwd())).toEqual([]);
  });
});
