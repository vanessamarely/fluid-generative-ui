// Usa la API nativa de WebMCP si el navegador la trae (origin trial desde Chrome 149);
// si no, instala un polyfill mínimo con la misma forma para que la demo corra en cualquier lado.
import type { ModelContext, ToolDefinition, ToolResult } from './types';

class ModelContextPolyfill extends EventTarget implements ModelContext {
  private tools = new Map<string, ToolDefinition<never>>();
  registerTool(tool: ToolDefinition<never>, options?: { signal?: AbortSignal }) {
    this.tools.set(tool.name, tool);
    this.dispatchEvent(new Event('toolchange'));
    options?.signal?.addEventListener('abort', () => {
      this.tools.delete(tool.name);
      this.dispatchEvent(new Event('toolchange'));
    });
  }
  async getTools() {
    return [...this.tools.values()].map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
  }
  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { content: [{ type: 'text', text: `Tool no encontrada: ${name}` }], isError: true };
    return tool.execute(args as never);
  }
}

export interface ModelContextInfo {
  ctx: ModelContext;
  native: boolean;
}

let info: ModelContextInfo | null = null;

export function getModelContext(): ModelContextInfo {
  if (info) return info;
  const native = navigator.modelContext ?? document.modelContext;
  if (native) info = { ctx: native, native: true };
  else {
    const poly = new ModelContextPolyfill();
    document.modelContext = poly;
    info = { ctx: poly, native: false };
    console.info('[webmcp] API nativa no disponible: usando polyfill local.');
  }
  return info;
}
