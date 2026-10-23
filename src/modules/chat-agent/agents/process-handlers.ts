import { AgentResponse, AgentStreamEvent } from '../types/agent.types';

type ExecToolFn = (toolName: string, rawArgs: Record<string, any>, userId: string) => Promise<string>;

export async function processMessageHandler(opts: {
  genAI: any;
  userId: string;
  userMessage: string;
  conversationHistory: Array<{ role: string; content: string }>;
  context?: Record<string, any>;
  executeTool: ExecToolFn;
  logger: any;
  helpers: any;
}): Promise<AgentResponse> {
  const { genAI, userId, userMessage, conversationHistory, context, executeTool, logger, helpers } = opts;
  if (!genAI) return { content: 'I apologize, but I am not currently available. Please try again later.', metadata: { error: 'model_not_initialized' } };

  try {
    const voiceProfileId = context?.voiceProfileId;
    let ctx = context ? { ...context } : {};
    if (voiceProfileId && !ctx.voiceProfile) {
      try {
        const vp = await helpers.voiceProfileService.findById(voiceProfileId);
        if (vp) ctx = { ...ctx, voiceProfile: vp };
      } catch (e) {
        logger.warn('Failed to fetch voice profile for message', e);
      }
    }

    const systemPrompt = helpers.buildSystemPrompt(ctx);
    const contents = helpers.buildContents(conversationHistory, userMessage);
    const requestConfig = helpers.buildRequestConfig(systemPrompt, helpers.getToolDeclarations());
    const metadata: any = { model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash', timestamp: new Date() };

    let responseContent = '';
    let agentLoop = true;
    let loopCount = 0;
    const MAX_LOOPS = 5;

    while (agentLoop && loopCount < MAX_LOOPS) {
      loopCount++;
      const response = await genAI.models.generateContent({ ...requestConfig, contents });
      const turnText = helpers.extractText(response);
      if (turnText) responseContent = turnText;

      const functionCalls = helpers.extractFunctionCalls(response);
      if (functionCalls.length === 0) {
        agentLoop = false;
      } else {
        const functionResponseParts: any[] = [];
        for (const call of functionCalls) {
          try {
            const result = await executeTool(call.name, call.args, userId);
            helpers.collectToolMetadata(call.name, result, metadata);
            functionResponseParts.push({ functionResponse: { name: call.name, response: { result } } });
          } catch (error) {
            logger.error(`Error executing tool ${call.name}`, error);
            functionResponseParts.push({ functionResponse: { name: call.name, response: { error: `Tool execution failed: ${error}` } } });
          }
        }

        const modelTurnParts = functionCalls.map((fc: any) => ({ functionCall: { name: fc.name, args: fc.args } }));
        if (turnText) modelTurnParts.unshift({ text: turnText });
        contents.push({ role: 'model', parts: modelTurnParts });
        contents.push({ role: 'user', parts: functionResponseParts });
      }
    }

    responseContent = helpers.enhanceResponseWithNavigation(responseContent, metadata, ctx);

    return { content: responseContent || 'I need more information to assist you. Could you provide more details?', metadata };
  } catch (error) {
    logger.error('Error processing message', error);
    return { content: 'I encountered an error processing your message. Please try again.', metadata: { error: error instanceof Error ? error.message : 'unknown_error' } };
  }
}

export async function* processMessageStreamHandler(opts: {
  genAI: any;
  userId: string;
  userMessage: string;
  conversationHistory: Array<{ role: string; content: string }>;
  context?: Record<string, any>;
  executeTool: ExecToolFn;
  logger: any;
  helpers: any;
}): AsyncGenerator<AgentStreamEvent> {
  const { genAI, userId, userMessage, conversationHistory, context, executeTool, logger, helpers } = opts;
  if (!genAI) {
    const response = { content: 'I apologize, but I am not currently available. Please try again later.', metadata: { error: 'model_not_initialized' } };
    yield { type: 'delta', content: response.content };
    yield { type: 'complete', response };
    return;
  }

  try {
    const voiceProfileId = context?.voiceProfileId;
    let ctx = context ? { ...context } : {};
    if (voiceProfileId && !ctx.voiceProfile) {
      try {
        const vp = await helpers.voiceProfileService.findById(voiceProfileId);
        if (vp) ctx = { ...ctx, voiceProfile: vp };
      } catch (e) {
        logger.warn('Failed to fetch voice profile for stream', e);
      }
    }

    const systemPrompt = helpers.buildSystemPrompt(ctx);
    const contents = helpers.buildContents(conversationHistory, userMessage);
    const requestConfig = helpers.buildRequestConfig(systemPrompt, helpers.getToolDeclarations());
    const metadata: any = { model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash', timestamp: new Date() };

    let agentLoop = true;
    let loopCount = 0;
    let responseContent = '';
    const MAX_LOOPS = 5;

    while (agentLoop && loopCount < MAX_LOOPS) {
      loopCount++;
      const stream = await genAI.models.generateContentStream({ ...requestConfig, contents });
      let turnText = '';
      let aggregatedResponse: any = null;
      let streamMode: 'undecided' | 'answer' | 'tool' = 'undecided';

      for await (const chunk of stream) {
        aggregatedResponse = chunk;
        const hasFunctionCall = chunk.candidates?.[0]?.content?.parts?.some((p: any) => p.functionCall) ?? false;
        if (hasFunctionCall && streamMode === 'undecided') streamMode = 'tool';
        const chunkText: string = helpers.extractText(chunk);
        if (!chunkText) continue;
        turnText += chunkText;
        if (streamMode === 'undecided') streamMode = 'answer';
        if (streamMode === 'answer') {
          responseContent += chunkText;
          yield { type: 'delta', content: chunkText } as any;
        }
      }

      const functionCalls = aggregatedResponse ? helpers.extractFunctionCalls(aggregatedResponse) : [];
      if (functionCalls.length === 0) {
        agentLoop = false;
        if (!responseContent && turnText) responseContent = turnText;
        break;
      }

      const functionResponseParts: any[] = [];
      for (const call of functionCalls) {
        try {
          yield { type: 'status', message: `Using ${helpers.getToolDisplayName(call.name)}...`, toolName: call.name } as any;
          const result = await executeTool(call.name, call.args, userId);
          helpers.collectToolMetadata(call.name, result, metadata);
          functionResponseParts.push({ functionResponse: { name: call.name, response: { result } } });
        } catch (error) {
          logger.error(`Error executing tool ${call.name}`, error);
          functionResponseParts.push({ functionResponse: { name: call.name, response: { error: `Tool execution failed: ${error}` } } });
        }
      }

      const modelTurnParts = functionCalls.map((fc: any) => ({ functionCall: { name: fc.name, args: fc.args } }));
      if (turnText) modelTurnParts.unshift({ text: turnText });
      contents.push({ role: 'model', parts: modelTurnParts });
      contents.push({ role: 'user', parts: functionResponseParts });
    }

    if (!responseContent) {
      responseContent = 'The Scribe needs more information to assist you. Could you provide more details?';
      yield { type: 'delta', content: responseContent } as any;
    }

    const enhancedContent = helpers.enhanceResponseWithNavigation(responseContent, metadata, ctx);
    const navigationDelta = enhancedContent.slice(responseContent.length);
    if (navigationDelta) yield { type: 'delta', content: navigationDelta } as any;

    yield { type: 'complete', response: { content: enhancedContent || 'Scribe needs more information to assist you. Could you provide more details?', metadata } } as any;
  } catch (error) {
    logger.error('Error streaming message', error);
    const response = { content: 'I encountered an error processing your message. Please try again.', metadata: { error: error instanceof Error ? error.message : 'unknown_error' } };
    yield { type: 'delta', content: response.content } as any;
    yield { type: 'complete', response } as any;
  }
}
