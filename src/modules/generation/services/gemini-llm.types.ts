export interface LLMGenerationRequest {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface LLMGenerationResponse {
  content: string;
  model: string;
  tokensUsed: {
    input: number;
    output: number;
  };
  finishReason: string;
}

export interface LLMGenerationStreamChunk {
  content: string;
  fullContent: string;
  model: string;
  finishReason?: string;
}

export interface GenerationEvaluationResult {
  isApproved: boolean;
  issues: string[];
  suggestions?: string[];
  score: number;
}
