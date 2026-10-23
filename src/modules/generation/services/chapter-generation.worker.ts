import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { GenerationOrchestrationService } from '../prompts/generation-orchestration.service';
import { GeminiLLMService } from './gemini-llm.service';
import { ContentConverterService } from './content-converter.service';
import { ChapterService } from '../../chapters/services/chapter.service';
import { ChapterGenerationStreamService } from './chapter-generation-stream.service';
import {
  ChapterGenerationJob,
  ChapterGenerationQueueService,
} from './chapter-generation-queue.service';

@Injectable()
export class ChapterGenerationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChapterGenerationWorker.name);
  private timer?: NodeJS.Timeout;
  private isWorking = false;

  constructor(
    private readonly queueService: ChapterGenerationQueueService,
    private readonly orchestration: GenerationOrchestrationService,
    private readonly gemini: GeminiLLMService,
    private readonly contentConverter: ContentConverterService,
    private readonly chapterService: ChapterService,
    private readonly streamService: ChapterGenerationStreamService,
  ) {}

  onModuleInit() {
    void this.start();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async start() {
    await this.queueService.recoverInterruptedJobs();
    this.timer = setInterval(() => void this.processNext(), 1500);
    void this.processNext();
  }

  private async processNext() {
    if (this.isWorking) return;
    this.isWorking = true;

    try {
      const job = await this.queueService.claimNextJob();
      if (!job) return;
      await this.processJob(job);
    } catch (error) {
      this.logger.error('Chapter worker tick failed', error);
    } finally {
      this.isWorking = false;
    }
  }

  private async processJob(job: ChapterGenerationJob) {
    this.logger.log(`Generating chapter content for job ${job.id}`);

    try {
      await this.chapterService.updateChapter(job.chapterId, {
        status: 'generating',
      });
      this.streamService.publish({
        type: 'chapter-started',
        manuscriptId: job.manuscriptId,
        chapterId: job.chapterId,
        chapterTitle: job.chapterTitle,
      });

      const assembledPrompt = await this.orchestration.assembleChapterPrompt({
        userId: job.userId,
        voiceProfileId: job.voiceProfileId,
        chapterTitle: job.chapterTitle,
        outlineSection: job.outlineSection,
        voiceStyleKey: job.voiceStyleKey,
        additionalContext: job.additionalContext,
        retrievalQuery: job.chapterTitle,
      });

      let markdownContent = '';
      let lastPersistedAt = 0;

      for await (const chunk of this.gemini.generateChapterStream({
        systemPrompt: assembledPrompt.systemPrompt,
        userMessage: assembledPrompt.userMessage,
        temperature: 0.7,
        maxTokens: 4000,
      })) {
        markdownContent = chunk.fullContent;
        const htmlContent = this.contentConverter.markdownToHtml(
          markdownContent,
        );

        this.streamService.publish({
          type: 'chapter-delta',
          manuscriptId: job.manuscriptId,
          chapterId: job.chapterId,
          content: chunk.content,
          fullContent: htmlContent,
        });

        const now = Date.now();
        if (now - lastPersistedAt > 750) {
          lastPersistedAt = now;
          await this.chapterService.updateChapter(job.chapterId, {
            content: htmlContent,
            status: 'generating',
            voiceStyle: assembledPrompt.metadata.voiceStyle,
          });
          await this.queueService.updateProgress(job);
          this.streamService.publish({
            type: 'chapter-updated',
            manuscriptId: job.manuscriptId,
            chapterId: job.chapterId,
            content: htmlContent,
            status: 'generating',
          });
        }
      }

      const expectedWordCount = job.expectedWordCount || 0;
      let currentWordCount = this.countWords(markdownContent);
      let continuationAttempts = 0;

      while (
        expectedWordCount > 0 &&
        currentWordCount < expectedWordCount &&
        continuationAttempts < 2
      ) {
        continuationAttempts += 1;
        let continuationMarkdown = '';
        const remainingWords = expectedWordCount - currentWordCount;

        for await (const chunk of this.gemini.generateChapterStream({
          systemPrompt: assembledPrompt.systemPrompt,
          userMessage: `${assembledPrompt.userMessage}

The chapter draft below is currently ${currentWordCount} words, but the target is ${expectedWordCount} words.

CURRENT DRAFT:
${markdownContent}

Continue writing from exactly where this draft stops. Add about ${remainingWords} more words. Do not restart, recap, repeat the title, or provide notes about the continuation. Return only the additional chapter prose.`,
          temperature: 0.7,
          maxTokens: 3000,
        })) {
          continuationMarkdown = chunk.fullContent;
          const combinedMarkdown = `${markdownContent}\n\n${continuationMarkdown}`;
          const htmlContent = this.contentConverter.markdownToHtml(
            combinedMarkdown,
          );

          this.streamService.publish({
            type: 'chapter-delta',
            manuscriptId: job.manuscriptId,
            chapterId: job.chapterId,
            content: chunk.content,
            fullContent: htmlContent,
          });

          const now = Date.now();
          if (now - lastPersistedAt > 750) {
            lastPersistedAt = now;
            await this.chapterService.updateChapter(job.chapterId, {
              content: htmlContent,
              status: 'generating',
              voiceStyle: assembledPrompt.metadata.voiceStyle,
            });
            await this.queueService.updateProgress(job);
            this.streamService.publish({
              type: 'chapter-updated',
              manuscriptId: job.manuscriptId,
              chapterId: job.chapterId,
              content: htmlContent,
              status: 'generating',
            });
          }
        }

        if (!continuationMarkdown.trim()) break;
        markdownContent = `${markdownContent}\n\n${continuationMarkdown}`;
        currentWordCount = this.countWords(markdownContent);
      }

      const htmlContent = this.contentConverter.markdownToHtml(
        markdownContent,
      );

      await this.chapterService.updateChapter(job.chapterId, {
        content: htmlContent,
        status: 'generated',
        voiceStyle: assembledPrompt.metadata.voiceStyle,
      });

      await this.queueService.markCompleted(job);
      this.streamService.publish({
        type: 'chapter-completed',
        manuscriptId: job.manuscriptId,
        chapterId: job.chapterId,
        content: htmlContent,
      });
      this.logger.log(`Chapter generation completed: ${job.id}`);
    } catch (error) {
      const failure = await this.queueService.markFailed(job, error);
      if (failure.retrying) {
        await this.chapterService.updateChapter(job.chapterId, {
          status: 'generating',
        });
        this.streamService.publish({
          type: 'chapter-retry',
          manuscriptId: job.manuscriptId,
          chapterId: job.chapterId,
          retryCount: failure.retryCount,
          maxRetries: failure.maxRetries,
        });
      } else {
        await this.chapterService.updateChapter(job.chapterId, {
          status: 'draft',
        });
        this.streamService.publish({
          type: 'chapter-failed',
          manuscriptId: job.manuscriptId,
          chapterId: job.chapterId,
          error: error instanceof Error ? error.message : 'Generation failed',
        });
      }
      this.logger.error(`Chapter generation failed: ${job.id}`, error);
    }
  }

  private countWords(content: string): number {
    return content
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }
}
