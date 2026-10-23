import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { GenerationManuscriptController } from './controllers/generation-manuscript.controller';
import { GenerationChapterController } from './controllers/generation-chapter.controller';

// Prompt services
import { PromptBuilderService } from './prompts/prompt-builder.service';
import { VoiceProfileFormatter } from './prompts/voice-profile-formatter.service';
import { ScriptureContextRetriever } from './prompts/scripture-context-retriever.service';
import { ToneAndGuardrailsBuilder } from './prompts/tone-and-guardrails-builder.service';
import { GenerationOrchestrationService } from './prompts/generation-orchestration.service';

// Generation services
import { GeminiLLMService } from './services/gemini-llm.service';
import { ContentConverterService } from './services/content-converter.service';
import { ManuscriptGenerationService } from './services/manuscript-generation.service';
import { ImageGenerationService } from './services/image-generation.service';
import { ChapterGenerationQueueService } from './services/chapter-generation-queue.service';
import { ChapterGenerationWorker } from './services/chapter-generation.worker';
import { ChapterGenerationStreamService } from './services/chapter-generation-stream.service';
import { SseEventBridgeService } from './services/sse-event-bridge.service';

// Evaluators
import { SelfCritiqueService } from './evaluators/self-critique.service';

// Import dependent modules
import { VoiceProfileModule } from '../voice-profile/voice-profile.module';
import { RagModule } from '../rag/rag.module';
import { ManuscriptModule } from '../manuscripts/manuscript.module';
import { ChapterModule } from '../chapters/chapter.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    VoiceProfileModule,
    RagModule,
    ManuscriptModule,
    ChapterModule,
  ],
  controllers: [GenerationManuscriptController, GenerationChapterController],
  providers: [
    // Prompt builders
    PromptBuilderService,
    VoiceProfileFormatter,
    ScriptureContextRetriever,
    ToneAndGuardrailsBuilder,
    GenerationOrchestrationService,

    // LLM services
    GeminiLLMService,
    ContentConverterService,
    ManuscriptGenerationService,
    ImageGenerationService,
    ChapterGenerationQueueService,
    ChapterGenerationStreamService,
    ChapterGenerationWorker,
    SseEventBridgeService,

    // Evaluators
    SelfCritiqueService,
  ],
  exports: [
    GenerationOrchestrationService,
    VoiceProfileFormatter,
    ScriptureContextRetriever,
    ToneAndGuardrailsBuilder,
    PromptBuilderService,
    GeminiLLMService,
    ContentConverterService,
    ManuscriptGenerationService,
    ImageGenerationService,
    ChapterGenerationQueueService,
    ChapterGenerationStreamService,
    SelfCritiqueService,
  ],
})
export class GenerationModule {}
