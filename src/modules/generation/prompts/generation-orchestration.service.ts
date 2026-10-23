import { Injectable, BadRequestException } from '@nestjs/common';
import { PromptBuilderService } from './prompt-builder.service';
import { ChapterPromptInput } from './prompt-builder.types';
import { VoiceProfileFormatter } from './voice-profile-formatter.service';
import { ScriptureContextRetriever } from './scripture-context-retriever.service';
import { ToneAndGuardrailsBuilder } from './tone-and-guardrails-builder.service';

export interface GenerationPromptRequest {
  userId: string;
  voiceProfileId: string;
  chapterTitle: string;
  outlineSection: string;
  voiceStyleKey?: string; // e.g., 'PROPHETIC', 'APOSTOLIC'
  additionalContext?: string;
  retrievalQuery?: string; // Query for scripture retrieval; defaults to chapter title
  customGuardrails?: {
    doctrinalPrinciples?: string[];
    prohibitions?: string[];
  };
}

export interface AssembledPrompt {
  systemPrompt: string;
  userMessage: string;
  metadata: {
    voiceProfileId: string;
    chapterTitle: string;
    voiceStyle: string;
    scripturesUsed: number;
  };
}

/**
 * Orchestrates the full prompt assembly pipeline for chapter generation
 * This is the core Ticket 4.1 implementation
 */
@Injectable()
export class GenerationOrchestrationService {
  constructor(
    private readonly promptBuilder: PromptBuilderService,
    private readonly voiceProfileFormatter: VoiceProfileFormatter,
    private readonly scriptureRetriever: ScriptureContextRetriever,
    private readonly toneBuilder: ToneAndGuardrailsBuilder,
  ) {}

  /**
   * Main entry point: Assemble a complete chapter generation prompt
   * This performs RAG retrieval + voice profile fetch + prompt building
   */
  async assembleChapterPrompt(
    request: GenerationPromptRequest,
  ): Promise<AssembledPrompt> {
    if (!request.userId || !request.voiceProfileId) {
      throw new BadRequestException('userId and voiceProfileId are required');
    }

    if (!request.chapterTitle || !request.outlineSection) {
      throw new BadRequestException(
        'chapterTitle and outlineSection are required',
      );
    }

    // Step 1: Fetch and format voice profile data
    const voiceProfile = await this.voiceProfileFormatter.formatVoiceProfile(
      request.userId,
      request.voiceProfileId,
    );

    // Step 2: Retrieve relevant scriptures via RAG
    const retrievalQuery = request.retrievalQuery || request.chapterTitle;
    const scriptures = await this.scriptureRetriever.retrieveScriptures(
      request.userId,
      retrievalQuery,
      5,
    );

    // Step 3: Build tone and guardrails configuration
    const voiceStyle = request.voiceStyleKey || 'PROPHETIC';
    const toneGuardrails = this.toneBuilder.buildForVoiceStyle(
      voiceStyle,
      request.customGuardrails?.doctrinalPrinciples,
      request.customGuardrails?.prohibitions,
    );

    // Step 4: Assemble the complete prompt
    const promptInput: ChapterPromptInput = {
      voiceProfile,
      scriptures,
      toneGuardrails,
      chapterTitle: request.chapterTitle,
      outlineSection: request.outlineSection,
      additionalContext: request.additionalContext,
    };

    const systemPrompt = this.promptBuilder.buildSystemPrompt(promptInput);
    const userMessage = this.promptBuilder.buildUserMessage(promptInput);

    return {
      systemPrompt,
      userMessage,
      metadata: {
        voiceProfileId: request.voiceProfileId,
        chapterTitle: request.chapterTitle,
        voiceStyle,
        scripturesUsed: scriptures.length,
      },
    };
  }

  /**
   * Assemble a prompt without RAG retrieval (for scenarios where scriptures are provided)
   */
  async assembleChapterPromptManual(
    userId: string,
    voiceProfileId: string,
    request: {
      chapterTitle: string;
      outlineSection: string;
      voiceStyleKey?: string;
      additionalContext?: string;
      scriptureReferences?: string[];
      customGuardrails?: {
        doctrinalPrinciples?: string[];
        prohibitions?: string[];
      };
    },
  ): Promise<AssembledPrompt> {
    // Fetch voice profile
    const voiceProfile = await this.voiceProfileFormatter.formatVoiceProfile(
      userId,
      voiceProfileId,
    );

    // Build tone and guardrails
    const voiceStyle = request.voiceStyleKey || 'PROPHETIC';
    const toneGuardrails = this.toneBuilder.buildForVoiceStyle(
      voiceStyle,
      request.customGuardrails?.doctrinalPrinciples,
      request.customGuardrails?.prohibitions,
    );

    // Build prompt without scripture retrieval
    const promptInput: ChapterPromptInput = {
      voiceProfile,
      scriptures: [],
      toneGuardrails,
      chapterTitle: request.chapterTitle,
      outlineSection: request.outlineSection,
      additionalContext: request.additionalContext,
    };

    const systemPrompt = this.promptBuilder.buildSystemPrompt(promptInput);
    const userMessage = this.promptBuilder.buildUserMessage(promptInput);

    return {
      systemPrompt,
      userMessage,
      metadata: {
        voiceProfileId,
        chapterTitle: request.chapterTitle,
        voiceStyle,
        scripturesUsed: 0,
      },
    };
  }
}
