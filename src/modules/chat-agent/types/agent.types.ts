export interface ToolCall {
  name: string;
  args: Record<string, any>;
}

export interface AgentState {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  metadata?: Record<string, any>;
}

export interface AgentResponse {
  content: string;
  toolCalls?: ToolCall[];
  metadata?: Record<string, any>;
}

export type AgentStreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'status'; message: string; toolName?: string }
  | { type: 'complete'; response: AgentResponse };
