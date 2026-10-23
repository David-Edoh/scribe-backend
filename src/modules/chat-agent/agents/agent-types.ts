export interface AgentTool {
  declaration: {
    name: string;
    description: string;
    parameters?: Record<string, any>;
  };
  handler: (args: Record<string, any>) => Promise<string>;
}

export type GeminiRole = 'user' | 'model';

export interface ContentPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, any> };
  functionResponse?: { name: string; response: Record<string, any> };
}

export interface Content {
  role: GeminiRole;
  parts: ContentPart[];
}
