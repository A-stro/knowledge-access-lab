// lanes/mcp-kit.ts
// Minimal stdio JSON-RPC surface for the lane MCP servers (newline-delimited
// JSON messages, per the MCP stdio transport).
//
// Every lane is a deliberately tiny MCP tool surface (2-4 tools, per ISC-2)
// over the shared corpus tree. This kit carries the wire protocol plus tool
// dispatch: a server passes ToolSpecs and, once implemented, a handler per
// tool; tools without handlers keep their scaffold stub reply. Lanes are
// retrieval-only: no shell, filesystem writes, or network.

export type ToolSpec = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type ToolHandler = (args: Record<string, unknown>) => string;

const STUB_REPLY = (tool: ToolSpec): string =>
  `[stub] ${tool.description} — corpus retrieval behavior lands in phase F2; no records are returned yet.`;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
};

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_VERSION = "0.1.0";

export function serve(
  serverName: string,
  tools: ToolSpec[],
  handlers?: Record<string, ToolHandler>,
): void {
  const log = (line: string) => process.stderr.write(`[${serverName}] ${line}\n`);
  let buffer = "";

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    buffer += chunk;
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line.length > 0) {
        try {
          handle(JSON.parse(line) as JsonRpcRequest);
        } catch (err) {
          log(`failed to handle message: ${String(err)}`);
        }
      }
      newline = buffer.indexOf("\n");
    }
  });
  process.stdin.on("end", () => process.exit(0));

  function handle(req: JsonRpcRequest): void {
    // Notifications (no id) receive no response per JSON-RPC.
    if (req.id === undefined || req.id === null) return;
    const reply = (result: unknown) =>
      write({ jsonrpc: "2.0", id: req.id, result });

    switch (req.method) {
      case "initialize":
        reply({
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: serverName, version: SERVER_VERSION },
        });
        break;
      case "ping":
        reply({});
        break;
      case "tools/list":
        reply({ tools });
        break;
      case "tools/call": {
        const name = String(req.params?.name ?? "");
        const tool = tools.find((t) => t.name === name);
        if (!tool) {
          write({
            jsonrpc: "2.0",
            id: req.id,
            error: { code: -32602, message: `Unknown tool: ${name}` },
          });
          break;
        }
        const handler = handlers?.[name];
        if (!handler) {
          reply({
            content: [{ type: "text", text: STUB_REPLY(tool) }],
          });
          break;
        }
        try {
          const text = handler((req.params?.arguments as Record<string, unknown>) ?? {});
          reply({ content: [{ type: "text", text }] });
        } catch (err) {
          write({
            jsonrpc: "2.0",
            id: req.id,
            error: { code: -32000, message: `Tool error (${name}): ${String(err)}` },
          });
        }
        break;
      }
      default:
        write({
          jsonrpc: "2.0",
          id: req.id,
          error: { code: -32601, message: `Method not found: ${req.method}` },
        });
    }
  }

  function write(msg: unknown): void {
    process.stdout.write(JSON.stringify(msg) + "\n");
  }
}
