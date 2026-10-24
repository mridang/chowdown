<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## MCP registry listing

`server.json` is the listing of the MCP server in the official MCP Registry (`io.github.mridang/chowdown`). It is published once, by hand, with `mcp-publisher` (the official binary from the `modelcontextprotocol/registry` GitHub releases; the `mcp-publisher` package on npm is an unrelated tool). It is not published on deploy: the registry only stores where the server is, clients read the tools from `/mcp` itself, and a published version can never be changed.

Keep it in step with the server. Its `version` must equal `version` in `package.json` and `SERVER_VERSION` in `src/lib/mcp/server-info.ts`, and its title, website, icons and endpoint must match `src/lib/site.ts` and `server-info.ts`. Its description may not be longer than 100 characters. `test/lib/mcp/server-info.test.ts` fails when any of these drift.

Run `mcp-publisher validate` after editing it. Publish again only when the listing itself changes (the description, title, icons or endpoint), and give that publication a new version, for example the prerelease `0.1.0-1` when the app's version has not moved. A prerelease would fail the version check above, so change the check in the same commit.
