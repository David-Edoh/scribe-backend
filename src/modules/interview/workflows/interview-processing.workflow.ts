import { Injectable, Logger } from '@nestjs/common';
import { VoiceProfileExtractionAgent } from '../agents/voice-profile-extraction.agent';
import { VoiceProfileService } from '../../voice-profile/services/voice-profile.service';
import { EmbeddingsService } from '../../rag/embeddings/embeddings.service';
import { BooksService } from '../../books/services/books.service';
import { ProcessInterviewDto } from '../dto/process-interview.dto';
import { executeExtractionStage } from './stages/extraction.stage';
import { executeValidationStage } from './stages/validation.stage';
import { executeUpdateStage } from './stages/update.stage';
import { executeEmbeddingStage } from './stages/embedding.stage';

// Interview processing workflow: extraction, validation, update, embeddings
@Injectable()
export class InterviewProcessingWorkflow {
  private readonly logger = new Logger(InterviewProcessingWorkflow.name);

  constructor(
    private readonly extractionAgent: VoiceProfileExtractionAgent,
    private readonly voiceProfileService: VoiceProfileService,
    private readonly embeddingsService: EmbeddingsService,
    private readonly booksService: BooksService,
  ) {}

  /**
   * Execute the interview processing workflow
   * Implements agentic pipeline stages with conditional routing
   */
  async executeWorkflow(
    interviewAnswers: ProcessInterviewDto,
    userId: string,
  ): Promise<{
    success: boolean;
    voiceProfile: any;
    extractedData: any;
    error?: string;
  }> {
    this.logger.log(
      `Starting agentic interview workflow for profile: ${interviewAnswers.voiceProfileId}`,
    );

    // Stage 1: Extract voice profile using LLM agent
    const extractionResult = await executeExtractionStage(
      this.extractionAgent,
      this.logger,
      interviewAnswers,
    );
    if (!extractionResult.success) {
      return {
        success: false,
        voiceProfile: {},
        extractedData: {},
        error: extractionResult.error,
      };
    }

    // Stage 2: Validate extraction quality
    const validationResult = executeValidationStage(
      extractionResult.extractedData,
      this.logger,
    );
    if (!validationResult.success) {
      return {
        success: false,
        voiceProfile: {},
        extractedData: extractionResult.extractedData,
        error: validationResult.error,
      };
    }

    // Stage 3: Update voice profile
    const updateResult = await executeUpdateStage(
      this.voiceProfileService,
      this.logger,
      interviewAnswers,
      extractionResult.extractedData,
    );
    if (!updateResult.success) {
      return {
        success: false,
        voiceProfile: {},
        extractedData: extractionResult.extractedData,
        error: updateResult.error,
      };
    }

    // Stage 4: Store embeddings for RAG retrieval
    const embeddingResult = await executeEmbeddingStage(
      this.embeddingsService,
      this.booksService,
      this.logger,
      interviewAnswers.voiceProfileId,
      extractionResult.extractedData,
      userId,
    );
    if (!embeddingResult.success) {
      this.logger.warn(
        `Stage 4 warning: Embedding storage failed, but profile was updated successfully. Error: ${embeddingResult.error}`,
      );
      // Don't fail the entire workflow - embeddings are nice-to-have
    }

    // Stage 5: Finalize
    this.logger.log(
      `Workflow completed successfully for profile: ${updateResult.voiceProfile.id}`,
    );

    return {
      success: true,
      voiceProfile: updateResult.voiceProfile,
      extractedData: extractionResult.extractedData,
    };
  }
}
