// The conformance runner's bookkeeping: which spec revisions it runs, where
// each revision's list of known gaps lives, and the checks that keep those
// lists honest. Kept apart from run.mjs (which starts a server and a suite as
// soon as it is loaded) so a test can import it.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The revisions of the spec the server is checked against, newest first. The
 * newest has no handshake and no sessions; 2025-11-25 is the stateful
 * `initialize` flow that Claude, ChatGPT, VS Code and Cursor still open with, so
 * it is where most real traffic is. Each is a separate run because a scenario
 * that applies to both must be run once under each.
 */
export const REVISIONS = /** @type {const} */ (['2026-07-28', '2025-11-25']);

/**
 * The file listing the scenarios (and single checks) this server is known not
 * to meet for a revision, with the reason beside each.
 * @param {string} revision
 * @returns {string}
 */
export function baselineFile(revision) {
  return join(here, `expected-failures-${revision}.yml`);
}

/**
 * The file in the installed conformance package that says which scenarios a
 * revision of the spec requires.
 * @param {string} revision
 * @returns {string}
 */
export function requirementsFile(revision) {
  const manifest = createRequire(import.meta.url).resolve(
    '@modelcontextprotocol/conformance/package.json',
  );
  return join(dirname(manifest), 'requirements', `${revision}.yaml`);
}

/**
 * The text of the top-level list `key` (`server:`, `not_scored:`) in one of
 * these YAML files: every line after the key up to the next top-level key.
 * @param {string} text
 * @param {string} key
 * @returns {readonly string[]}
 */
function section(text, key) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line === `${key}:`);
  if (start === -1) {
    return [];
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^[A-Za-z_]/.test(line));
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * The entries of a baseline file: `scenario` for a whole scenario, or
 * `scenario:check` for a single check inside one.
 * @param {string} text
 * @returns {readonly string[]}
 */
export function baselineEntries(text) {
  return section(text, 'server').flatMap((line) => {
    const entry = /^\s+-\s+([^\s#]+)\s*(?:#.*)?$/.exec(line)?.[1];
    return entry === undefined ? [] : [entry];
  });
}

/**
 * The server scenarios a revision's requirements file knows: the ones it
 * requires and the ones it runs without scoring.
 * @param {string} text
 * @returns {ReadonlySet<string>}
 */
export function requirementScenarios(text) {
  const required = section(text, 'server').flatMap((line) => {
    const name = /^\s+-\s+([^\s#]+)\s*$/.exec(line)?.[1];
    return name === undefined ? [] : [name];
  });
  const lines = section(text, 'not_scored');
  const unscored = lines.flatMap((line, index) => {
    const name = /^\s+-\s+scenario:\s+(\S+)\s*$/.exec(line)?.[1];
    const leg = lines
      .slice(index + 1)
      .find((next) => /^\s+leg:/.test(next) || /^\s+-\s/.test(next));
    return name !== undefined && leg !== undefined && /leg:\s+server/.test(leg)
      ? [name]
      : [];
  });
  return new Set([...required, ...unscored]);
}

/**
 * The baseline entries that name a scenario the revision does not have. A suite
 * upgrade that renames a scenario would otherwise make its entry silently
 * baseline nothing, and the renamed scenario would show up as a new failure
 * with no hint why.
 * @param {string} baseline The text of a baseline file.
 * @param {string} requirements The text of the revision's requirements file.
 * @returns {readonly string[]}
 */
export function unknownEntries(baseline, requirements) {
  const known = requirementScenarios(requirements);
  return baselineEntries(baseline).filter(
    (entry) => !known.has(entry.split(':')[0] ?? entry),
  );
}

/**
 * Check a revision's baseline file against the installed suite.
 * @param {string} revision
 * @returns {readonly string[]} The entries naming scenarios that do not exist.
 */
export function checkBaseline(revision) {
  return unknownEntries(
    readFileSync(baselineFile(revision), 'utf8'),
    readFileSync(requirementsFile(revision), 'utf8'),
  );
}
