import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InterviewController } from './controllers/interview.controller';
import { InterviewOrchestrationService } from './services/interview-orchestration.service';
import { PreviousWorksService } from './services/previous-works.service';
import { VoiceProfileExtractionAgent } from './agents/voice-profile-extraction.agent';
import { InterviewProcessingWorkflow } from './workflows/interview-processing.workflow';
import { InterviewProcessingQueueService } from './services/interview-processing-queue.service';
import { InterviewProcessingWorker } from './services/interview-processing.worker';
import { InterviewFeedbackService } from './services/interview-feedback.service';
import { VoiceProfileModule } from '../voice-profile/voice-profile.module';
import { EmbeddingsModule } from '../rag/embeddings/embeddings.module';
import { BooksModule } from '../books/books.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    VoiceProfileModule,
    EmbeddingsModule,
    BooksModule,
  ],
  controllers: [InterviewController],
  providers: [
    VoiceProfileExtractionAgent,
    InterviewProcessingWorkflow,
    InterviewProcessingQueueService,
    InterviewProcessingWorker,
    InterviewOrchestrationService,
    PreviousWorksService,
    InterviewFeedbackService,
  ],
  exports: [
    VoiceProfileExtractionAgent,
    InterviewProcessingWorkflow,
    InterviewProcessingQueueService,
    InterviewOrchestrationService,
    PreviousWorksService,
    InterviewFeedbackService,
  ],
})
export class InterviewModule {}
