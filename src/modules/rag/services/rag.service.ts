import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { VoiceProfileRepository } from '../../voice-profile/voice-profile.repository';
import { PrismaService } from '../../../prisma.service';
import { GoogleAuthService } from '../../../common/services/google-auth.service';
import { extractTextFromResponse, formatRagFallbackResponse } from './rag.helpers';
import { retrieveContextForGeneration, getContextReport } from './rag.context';
import { buildOutlinePrompt, buildManuscriptPrompt } from './rag.prompts';
import { synthesizeUserOpinion } from './rag.synthesis';

/**
 * RAGService: Retrieval-Augmented Generation
 *
 * Orchestrates the complete RAG pipeline:
 * 1. Vector Search: Find relevant voice profile chunks and scriptures
 * 2. Context Building: Prepare retrieved text for LLM context
 * 3. Prompt Engineering: Build prompts with author voice + context
 *
 * Auth: uses @google/genai + google-auth-library with explicit service account
 * credentials — no ADC, no temp credential files — works correctly on GAE.
 */
@Injectable()
export class RAGService {
  private readonly logger = new Logger(RAGService.name);
  private genAI: GoogleGenAI | null = null;

  constructor(
    private readonly embeddings: EmbeddingsService,
    private readonly repo: VoiceProfileRepository,
    private readonly prisma: PrismaService,
    private readonly googleAuthService: GoogleAuthService,
  ) {
    const credentials = this.googleAuthService.getCredentials();

    if (!credentials) {
      this.logger.warn(
        'Service account credentials not found. RAGService will not initialize Gemini.',
      );
      return;
    }

    try {
      const projectId = this.googleAuthService.getProjectId();

      // Use googleAuthOptions to pass credentials directly to the SDK's internal
      // NodeAuth — no ADC, no temp files, works correctly on GAE.
      this.genAI = new GoogleGenAI({
        vertexai: true,
        project: projectId,
        location: 'us-central1',
        googleAuthOptions: {
          credentials,
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        },
      });

      this.logger.debug(
        'RAGService initialized with Vertex AI (explicit service account)',
      );
    } catch (error) {
      this.logger.error(
        'Failed to initialize Google Gen AI in RAGService',
        error,
      );
      this.genAI = null;
    }
  }

  // helpers delegated to small modules

  // ─── RAG pipeline ───────────────────────────────────────────────────────────

  /**
   * Retrieve relevant context for outline/manuscript generation.
   * Returns structured context with source text (not embeddings).
   */
  async retrieveContextForGeneration(userId: string, query: string, limit = 5) {
    return retrieveContextForGeneration(this.embeddings, this.repo, userId, query, limit);
  }

  /**
   * Build a RAG-enhanced prompt for outline generation.
   * Includes author voice context from vector search.
   */
  async buildOutlinePrompt(userId: string, query: string, voiceProfileId: string): Promise<string> {
    return buildOutlinePrompt(this.prisma, this.embeddings, this.repo, userId, query, voiceProfileId);
  }

  /**
   * Build a RAG-enhanced prompt for manuscript chapter generation.
   * Includes author voice context + outline structure.
   */
  async buildManuscriptPrompt(userId: string, chapterTitle: string, outline: string, voiceProfileId: string): Promise<string> {
    return buildManuscriptPrompt(this.prisma, this.embeddings, this.repo, userId, chapterTitle, outline, voiceProfileId);
  }

  /**
   * Get detailed context report for debugging RAG pipeline.
   */
  async getContextReport(userId: string, query: string) {
    return getContextReport(this.embeddings, this.repo, userId, query);
  }

  /**
   * Get user's opinion/perspective on a specific topic.
   * Uses RAG + voice profile to build context, then synthesizes with Gemini.
   * Returns a natural response that sounds like the user.
   */
  async getUserOpinionOnTopic(userId: string, topic: string): Promise<string> {
    return synthesizeUserOpinion(this.genAI, this.prisma, this.embeddings, this.repo, this.logger, userId, topic);
  }

  /**
   * Fallback response formatting if Gemini is unavailable.
   */
  // fallback formatter delegated to helper module
}
