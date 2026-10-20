import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import type { User } from '../../src/lib/db/users';
import { respondToMcp } from '../../src/lib/mcp/http';
import { SCOPE_READ, SCOPE_WRITE } from '../../src/lib/oauth/scopes';

const run = promisify(execFile);
const require = createRequire(join(process.cwd(), 'package.json'));

/** The conformance suite's command-line program, which ships inside its package. */
const SUITE = join(
  require.resolve('@modelcontextprotocol/conformance/package.json'),
  '../dist/index.js',
);

/** Long enough for the whole suite to run against one revision. */
const SUITE_TIMEOUT = 300_000;

/**
 * Scenarios the suite runs against both spec revisions that this server is
 * known not to meet, and why. A scenario is listed whole when the suite cannot
 * exercise it here, and by single check (`scenario:check`) when it also holds
 * checks that must keep passing. The suite counts a warning as not passing, so
 * a scenario whose only problem is a warning stays listed until that is fixed.
 */
const SHARED_GAPS = [
  // The suite calls tools that only its own reference server defines
  // (test_simple_text, test_error_handling, ...); chowdown has recipe tools.
  'tools-call-audio',
  'tools-call-embedded-resource',
  'tools-call-error',
  'tools-call-image',
  'tools-call-mixed-content',
  'tools-call-simple-text',
  'tools-call-with-progress',
  // The suite reads prompts that only its reference server defines
  // (test_simple_prompt, ...); chowdown has its own prompts.
  'prompts-get-embedded-resource',
  'prompts-get-simple',
  'prompts-get-with-args',
  'prompts-get-with-image',
  // The suite reads test:// resources that only its reference server serves;
  // chowdown serves views and recipe://{id}.
  'resources-read-binary',
  'resources-read-text',
  'resources-templates-read',
  // The suite calls the reference server's own tool (json_schema_2020_12_tool).
  'json-schema-2020-12',
  // Completion is not offered: no prompt or resource template argument
  // benefits from it.
  'completion-complete',
];

/**
 * The gaps of each revision beyond the shared ones. Every scenario not listed
 * is expected to pass: initialize, ping, tools/list, resources/list,
 * prompts/list and DNS-rebinding protection must keep passing.
 */
const REVISIONS: Readonly<Record<string, readonly string[]>> = {
  // The newest revision: no handshake and no sessions.
  '2026-07-28': [
    ...SHARED_GAPS,
    // No tool carries an x-mcp-header annotation, so there is nothing to test.
    'http-custom-header-server-validation',
    // Multi round-trip requests (input required results) are not implemented;
    // the tools never ask the client for anything.
    'input-required-result-basic-elicitation',
    'input-required-result-basic-list-roots',
    'input-required-result-basic-sampling',
    'input-required-result-capability-check',
    'input-required-result-multi-round',
    'input-required-result-multiple-input-requests',
    'input-required-result-non-tool-request',
    'input-required-result-request-state',
    'input-required-result-result-type',
    'input-required-result-tampered-state',
    // These two call a tool only the reference server has
    // (test_input_required_result_elicitation) and get "unknown tool", which
    // the suite reports as a warning. Listed by check so the wire-schema check
    // beside each still counts.
    'input-required-result-ignore-extra-params:sep-2322-ignore-unexpected-params',
    'input-required-result-missing-input-response:sep-2322-missing-response-rerequests',
    // The tasks extension is not implemented: every tool finishes in one request.
    'tasks-capability-negotiation',
    'tasks-dispatch-and-envelope',
    'tasks-lifecycle',
    'tasks-mrtr-composition',
    'tasks-mrtr-input',
    'tasks-request-headers',
    'tasks-request-state-removal',
    'tasks-required-task-error',
    'tasks-wire-fields',
    // The suite probes with diagnostic tools only its reference server has
    // (test_missing_capability, test_streaming_elicitation, test_logging_tool).
    'server-stateless:sep-2575-server-rejects-undeclared-capability',
    'server-stateless:sep-2575-missing-capability-http-400',
    'server-stateless:sep-2575-http-server-no-independent-requests-on-stream',
    'server-stateless:sep-2575-server-no-log-without-loglevel',
  ],
  // The `initialize` handshake that Claude, ChatGPT, VS Code and Cursor still
  // open with, so most real traffic is here.
  '2025-11-25': [
    ...SHARED_GAPS,
    // These need the client to take part (log, sample, elicit), and no tool
    // here asks the client for anything.
    'tools-call-with-logging',
    'tools-call-sampling',
    'tools-call-elicitation',
    'elicitation-sep1034-defaults',
    'elicitation-sep1330-enums',
    // The suite wants a session id for its multiple-streams test; the server
    // keeps no sessions and no event streams, by design (it only warns).
    'server-sse-multiple-streams:server-sse-multiple-streams-session',
    // Capabilities this server does not declare (no logging, no subscriptions),
    // so "method not found" is the right answer.
    'logging-set-level',
    'resources-subscribe',
    'resources-unsubscribe',
  ],
};

/** Whoever the suite is: signed in, with every scope and no Google Drive. */
const SUITE_USER = { id: 1, refresh_token_enc: null } as Readonly<User>;

/** The MCP endpoint on a loopback port, answering as `/api/mcp` does. */
async function listen(): Promise<{ server: Server; url: string }> {
  const server = createServer((incoming, outgoing) => {
    // The server's own address, not the request's `Host` header, so a request
    // that names another host (DNS rebinding) is refused rather than echoed.
    const address = server.address();
    const origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
    const hasBody = incoming.method !== 'GET' && incoming.method !== 'HEAD';
    const request = new Request(new URL(incoming.url ?? '/', origin), {
      method: incoming.method,
      headers: Object.fromEntries(
        Object.entries(incoming.headers).flatMap(([name, value]) =>
          typeof value === 'string' ? [[name, value]] : [],
        ),
      ),
      ...(hasBody
        ? { body: Readable.toWeb(incoming) as ReadableStream, duplex: 'half' }
        : {}),
    });
    respondToMcp(
      request,
      origin,
      async () => ({
        kind: 'ok',
        user: SUITE_USER,
        scope: [SCOPE_READ, SCOPE_WRITE],
      }),
      {
        // Counters in memory, with the same fixed windows as the database ones.
        store: () => {
          const windows = new Map<
            string,
            { count: number; windowStart: number }
          >();
          return {
            hit: async (key, now, windowSeconds) => {
              const current = windows.get(key);
              const next =
                current && current.windowStart > now - windowSeconds
                  ? {
                      count: current.count + 1,
                      windowStart: current.windowStart,
                    }
                  : { count: 1, windowStart: now };
              windows.set(key, next);
              return next;
            },
            purge: async () => {},
          };
        },
        now: () => Math.floor(Date.now() / 1000),
        random: () => 1,
      },
    )
      .then(async (response) => {
        outgoing.writeHead(
          response.status,
          Object.fromEntries(response.headers),
        );
        outgoing.end(Buffer.from(await response.arrayBuffer()));
      })
      .catch((error: unknown) => {
        console.error(error);
        outgoing.writeHead(500).end();
      });
  });
  const port = await new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });
  return { server, url: `http://127.0.0.1:${port}/api/mcp` };
}

describe('the MCP server against the official conformance suite', () => {
  let listening: Awaited<ReturnType<typeof listen>>;
  let work: string;

  beforeAll(async () => {
    listening = await listen();
    work = await mkdtemp(join(tmpdir(), 'chowdown-conformance-'));
  });

  afterAll(async () => {
    listening.server.close();
    await rm(work, { recursive: true, force: true });
  });

  // A failure that is not a listed gap fails the run. A listed gap that now
  // passes does not, so prune the lists above when a gap is closed.
  it.each(Object.entries(REVISIONS))(
    'meets spec revision %s, but for its known gaps',
    async (revision, gaps) => {
      const baseline = join(work, `expected-failures-${revision}.yml`);
      await writeFile(
        baseline,
        `server:\n${gaps.map((gap) => `  - ${gap}\n`).join('')}`,
      );
      await expect(
        run(
          process.execPath,
          [
            SUITE,
            'server',
            '--url',
            listening.url,
            '--requirements',
            revision,
            '--expected-failures',
            baseline,
          ],
          { maxBuffer: 64 * 1024 * 1024 },
        ).catch((error: Error & { stdout?: string }) => {
          throw new Error(error.stdout ?? error.message);
        }),
      ).resolves.toBeDefined();
    },
    SUITE_TIMEOUT,
  );
});
