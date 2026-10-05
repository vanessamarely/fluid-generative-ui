// Tipos mínimos de WebMCP (https://github.com/webmachinelearning/webmcp).
export interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

export interface ToolDefinition<A = Record<string, unknown>> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute(args: A, client?: unknown): Promise<ToolResult> | ToolResult;
}

export interface ModelContext extends EventTarget {
  registerTool(tool: ToolDefinition<never>, options?: { signal?: AbortSignal }): Promise<void> | void;
  getTools?(): Promise<{ name: string; description: string; inputSchema: Record<string, unknown> }[]>;
  executeTool?(name: string, args: Record<string, unknown>): Promise<ToolResult>;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
  interface Navigator {
    modelContext?: ModelContext;
  }
}
