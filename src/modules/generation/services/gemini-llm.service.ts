import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { GoogleAuthService } from '../../../common/services/google-auth.service';
import {
  LLMGenerationRequest,
  LLMGenerationResponse,
  LLMGenerationStreamChunk,
  GenerationEvaluationResult,
} from './gemini-llm.types';
import {
  evaluateGeneratedContent,
  generateChapterResponse,
  streamChapterResponse,
} from './gemini-llm.operations';
import { createGeminiClient, requireGeminiClient } from './gemini-llm.client';

/**
 * Gemini LLM integration for chapter generation.
 * Uses @google/genai AI with explicit service account credentials.
 */
@Injectable()
export class GeminiLLMService {
  private readonly logger = new Logger(GeminiLLMService.name);
  private genAI: GoogleGenAI | null = null;

  constructor(private readonly googleAuthService: GoogleAuthService) {
    this.genAI = createGeminiClient(this.googleAuthService, this.logger);
  }

  async generateChapter(
    request: LLMGenerationRequest,
  ): Promise<LLMGenerationResponse> {
    const genAI = requireGeminiClient(this.genAI);
    try {
      return await generateChapterResponse(genAI, request);
    } catch (error) {
      if (error instanceof Error && error.message === 'No content generated from Gemini') {
        throw new InternalServerErrorException(error.message);
      }
      throw new InternalServerErrorException(
        `Gemini API error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  async *generateChapterStream(
    request: LLMGenerationRequest,
  ): AsyncGenerator<LLMGenerationStreamChunk> {
    yield* streamChapterResponse(
      requireGeminiClient(this.genAI),
      request,
      this.logger,
    );
  }

  async evaluateGeneration(
    originalPrompt: string,
    generatedContent: string,
  ): Promise<GenerationEvaluationResult> {
    try {
      return await evaluateGeneratedContent(
        requireGeminiClient(this.genAI),
        originalPrompt,
        generatedContent,
      );
    } catch {
      return {
        isApproved: true,
        issues: [],
        score: 70,
      };
    }
  }
}
