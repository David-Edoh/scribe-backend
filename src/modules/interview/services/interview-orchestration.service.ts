import { Injectable, Logger } from '@nestjs/common';
import { ProcessInterviewDto } from '../dto/process-interview.dto';
import { InterviewProcessingQueueService } from './interview-processing-queue.service';

/**
 * Orchestration service that delegates to the agentic workflow
 * Provides the primary entry point for interview processing
 */
@Injectable()
export class InterviewOrchestrationService {
  private readonly logger = new Logger(InterviewOrchestrationService.name);

  constructor(
    private readonly queueService: InterviewProcessingQueueService,
  ) {}

  /**
   * Process interview using the agentic LangGraph workflow
   * The workflow handles all extraction, validation, and profile updates
   */
  async processInterview(
    interviewAnswers: ProcessInterviewDto,
    userId: string,
  ) {
    this.logger.log(
      `Queueing interview processing for voice profile: ${interviewAnswers.voiceProfileId}`,
    );

    const status = await this.queueService.enqueue(
      interviewAnswers,
      userId,
    );

    this.logger.log(
      `Interview processing queued for voice profile: ${interviewAnswers.voiceProfileId}`,
    );

    return {
      success: true,
      status,
    };
  }
}
