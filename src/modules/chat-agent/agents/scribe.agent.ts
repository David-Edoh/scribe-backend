import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { GoogleAuthService } from '../../../common/services/google-auth.service';
import { ManuscriptService } from '../../manuscripts/services/manuscript.service';
import { VoiceProfileService } from '../../voice-profile/services/voice-profile.service';
import { RAGService } from '../../rag/services/rag.service';
import { OutlineGenerationService } from '../../outlines/services/outline-generation.service';
import { AgentResponse, AgentStreamEvent } from '../types/agent.types';
import { AgentTool } from './agent-types';
import { createAgentTools } from './tools';
import { processMessageHandler, processMessageStreamHandler } from './process-handlers';
import { buildSystemPrompt } from './system-prompt';
import {
  buildRequestConfig,
  buildContents,
  extractText,
  extractFunctionCalls,
  collectToolMetadata,
  enhanceResponseWithNavigation,
  getToolDisplayName,
} from './helpers';

@Injectable()
export class ScribeAgentService {
  private readonly logger = new Logger(ScribeAgentService.name);
  private genAI: GoogleGenAI | null = null;
  private agentTools: AgentTool[] = [];

  constructor(
    private readonly googleAuthService: GoogleAuthService,
    private readonly manuscriptService: ManuscriptService,
    private readonly voiceProfileService: VoiceProfileService,
    private readonly outlineGenerationService: OutlineGenerationService,
    private readonly ragService: RAGService,
  ) {
    const credentials = this.googleAuthService.getCredentials();
    if (!credentials) return;
    try {
      this.genAI = new GoogleGenAI({
        vertexai: true,
        project: this.googleAuthService.getProjectId(),
        location: 'us-central1',
        googleAuthOptions: { credentials, scopes: ['https://www.googleapis.com/auth/cloud-platform'] },
      });
      this.agentTools = createAgentTools({ manuscriptService: this.manuscriptService, voiceProfileService: this.voiceProfileService, outlineGenerationService: this.outlineGenerationService, ragService: this.ragService, logger: this.logger });
    } catch (e) {
      this.logger.error('Failed to init GenAI', e);
      this.genAI = null;
    }
  }

  private get toolDeclarations() {
    return this.agentTools.map((t) => t.declaration);
  }

  private async executeTool(toolName: string, rawArgs: Record<string, any>, userId: string) {
    const tool = this.agentTools.find((t) => t.declaration.name === toolName);
    if (!tool) return JSON.stringify({ error: `Tool ${toolName} not found` });
    return tool.handler({ ...rawArgs, userId });
  }

  async processMessage(userId: string, userMessage: string, conversationHistory: Array<{ role: string; content: string }>, context?: Record<string, any>): Promise<AgentResponse> {
    return processMessageHandler({
      genAI: this.genAI,
      userId,
      userMessage,
      conversationHistory,
      context,
      executeTool: this.executeTool.bind(this),
      logger: this.logger,
      helpers: {
        buildSystemPrompt,
        buildRequestConfig,
        buildContents,
        extractText,
        extractFunctionCalls,
        collectToolMetadata,
        enhanceResponseWithNavigation,
        getToolDisplayName,
        voiceProfileService: this.voiceProfileService,
        getToolDeclarations: () => this.toolDeclarations,
      } as any,
    });
  }

  async *processMessageStream(userId: string, userMessage: string, conversationHistory: Array<{ role: string; content: string }>, context?: Record<string, any>): AsyncGenerator<AgentStreamEvent> {
    const gen = processMessageStreamHandler({
      genAI: this.genAI,
      userId,
      userMessage,
      conversationHistory,
      context,
      executeTool: this.executeTool.bind(this),
      logger: this.logger,
      helpers: {
        buildSystemPrompt,
        buildRequestConfig,
        buildContents,
        extractText,
        extractFunctionCalls,
        collectToolMetadata,
        enhanceResponseWithNavigation,
        getToolDisplayName,
        voiceProfileService: this.voiceProfileService,
        getToolDeclarations: () => this.toolDeclarations,
      } as any,
    });
    for await (const e of gen) yield e;
  }

  isAvailable(): boolean {
    return this.genAI !== null;
  }
}
