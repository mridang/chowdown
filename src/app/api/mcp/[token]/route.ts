/**
 * Per-user MCP endpoint — the "unique link you add to Claude/ChatGPT". The
 * `token` in the path is the user's `mcp_token`; possession of the link
 * authorizes access to that user's recipes (no separate login). Speaks JSON-RPC
 * 2.0 over HTTP: POST one message (or a batch) and get one response back.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getUserByMcpToken } from '@/lib/db/users';
import { handleMcpMessage, type JsonRpcMessage } from '@/lib/mcp/server';
import { getDatabase } from '@/lib/util';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const user = await getUserByMcpToken(getDatabase(), token);
  if (!user) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Invalid MCP token' } },
      { status: 401 },
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | JsonRpcMessage
    | JsonRpcMessage[]
    | null;
  if (!payload) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
      { status: 400 },
    );
  }

  // JSON-RPC batch (array) or a single message.
  if (Array.isArray(payload)) {
    const responses = (
      await Promise.all(payload.map((m) => handleMcpMessage(user, m)))
    ).filter((r): r is object => r !== null);
    return responses.length > 0
      ? NextResponse.json(responses)
      : new NextResponse(null, { status: 202 });
  }

  const response = await handleMcpMessage(user, payload);
  return response === null
    ? new NextResponse(null, { status: 202 })
    : NextResponse.json(response);
}

/** A friendly GET so opening the link in a browser explains what it is. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const user = await getUserByMcpToken(getDatabase(), token);
  if (!user) {
    return NextResponse.json({ error: 'Invalid MCP token' }, { status: 401 });
  }
  return NextResponse.json({
    name: 'chowdown',
    description: "This is a chowdown recipe MCP endpoint. POST JSON-RPC 2.0 messages here.",
    protocolVersion: '2024-11-05',
  });
}
