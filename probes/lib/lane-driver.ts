// probes/lib/lane-driver.ts — stdio JSON-RPC driver for lane MCP servers.
//
// Shared by the lane behavior probes and `lab dry-run`: spawns a lane server
// under the repo's bun, writes newline-delimited JSON-RPC requests, and
// collects id-keyed replies — exactly the wire a harness would speak.

import { REPO_ROOT } from "./corpus";

export type RpcLine = { id?: number | string; result?: unknown; error?: { code: number; message: string } };
export type CallResult = { content: { text: string }[] };

export async function callLane(serverRel: string, requests: unknown[]): Promise<Map<number, RpcLine>> {
  const proc = Bun.spawn([process.execPath, serverRel], {
    cwd: REPO_ROOT,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "ignore",
  });
  for (const req of requests) proc.stdin.write(JSON.stringify(req) + "\n");
  await proc.stdin.end();
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  const replies = new Map<number, RpcLine>();
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const parsed = JSON.parse(line) as RpcLine;
    if (typeof parsed.id === "number") replies.set(parsed.id, parsed);
  }
  return replies;
}

/** Unwraps a successful tools/call reply to its text, throwing on RPC errors. */
export function resultText(reply: RpcLine): string {
  if (reply.error) throw new Error(`lane RPC error: ${reply.error.message}`);
  return (reply.result as CallResult).content[0].text;
}
