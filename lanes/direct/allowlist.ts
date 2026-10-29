// lanes/direct/allowlist.ts — the direct lane (F2, ISC-13).
//
// The control group needs no MCP server: it is the harness's native-tool
// allowlist — read, grep, find, ls — and nothing else. The runner (F3)
// consumes this committed constant when it drives the direct lane, so the
// tool surface is pinned here rather than in prose.

export const DIRECT_LANE_TOOLS = ["read", "grep", "find", "ls"] as const;
export type DirectLaneTool = (typeof DIRECT_LANE_TOOLS)[number];
