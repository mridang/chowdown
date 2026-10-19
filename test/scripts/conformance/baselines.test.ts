import { existsSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';

import {
  REVISIONS,
  baselineEntries,
  baselineFile,
  checkBaseline,
  requirementScenarios,
  requirementsFile,
  unknownEntries,
} from '../../../scripts/conformance/baselines.mjs';

const BASELINE = `# a comment
server:
  # why
  - tools-call-error
  - input-required-result-ignore-extra-params:sep-2322-ignore-unexpected-params  # inline
  -   completion-complete
client:
  - not-a-server-entry
`;

const REQUIREMENTS = `# header
server:
  - ping
  - tools-list
client:
  - initialize
not_scored:
  - scenario: json-schema-2020-12
    leg: server
    reason: pending
    note: >-
      text
  - scenario: auth/dpop
    leg: client
    reason: extension
  - scenario: tasks-lifecycle
    leg: server
    reason: extension
`;

describe('baselineEntries', () => {
  it('lists the server entries, whole scenarios and single checks, without comments', () => {
    expect(baselineEntries(BASELINE)).toEqual([
      'tools-call-error',
      'input-required-result-ignore-extra-params:sep-2322-ignore-unexpected-params',
      'completion-complete',
    ]);
  });

  it('is empty for a file with no server list', () => {
    expect(baselineEntries('client:\n  - x\n')).toEqual([]);
    expect(baselineEntries('')).toEqual([]);
  });
});

describe('requirementScenarios', () => {
  it('knows the required server scenarios and the ones run without scoring, and not the client ones', () => {
    expect(requirementScenarios(REQUIREMENTS)).toEqual(
      new Set(['ping', 'tools-list', 'json-schema-2020-12', 'tasks-lifecycle']),
    );
  });
});

describe('unknownEntries', () => {
  it('flags an entry whose scenario the suite does not have, including a single check of one', () => {
    expect(
      unknownEntries(
        'server:\n  - ping\n  - ping:some-check\n  - renamed-scenario\n  - gone:check\n',
        REQUIREMENTS,
      ),
    ).toEqual(['renamed-scenario', 'gone:check']);
  });

  it('flags nothing when every entry names a real scenario', () => {
    expect(
      unknownEntries('server:\n  - json-schema-2020-12\n', REQUIREMENTS),
    ).toEqual([]);
  });
});

describe('the revisions the server is checked against', () => {
  it('are the newest and the handshake era that today’s assistants open with', () => {
    expect(REVISIONS).toEqual(['2026-07-28', '2025-11-25']);
  });

  it.each(REVISIONS)(
    '%s has a baseline file and an installed requirements file',
    (revision) => {
      expect(existsSync(baselineFile(revision))).toBe(true);
      expect(existsSync(requirementsFile(revision))).toBe(true);
    },
  );

  // A suite upgrade that renames a scenario would otherwise make its entry
  // baseline nothing, and surface the renamed scenario as an unexplained failure.
  it.each(REVISIONS)(
    'every entry of the %s baseline names a scenario that revision has',
    (revision) => {
      expect(checkBaseline(revision)).toEqual([]);
    },
  );
});
