import { Controller, Post, Get, Request, Body, BadRequestException, InternalServerErrorException, Param, Res, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GenerationOrchestrationService } from '../prompts/generation-orchestration.service';
import { GeminiLLMService } from '../services/gemini-llm.service';
import { ContentConverterService } from '../services/content-converter.service';
import { ManuscriptService } from '../../manuscripts/services/manuscript.service';
import { ChapterService } from '../../chapters/services/chapter.service';
import { ChapterGenerationQueueService } from '../services/chapter-generation-queue.service';
import { ChapterGenerationStreamService } from '../services/chapter-generation-stream.service';
import { prepareSseResponse, writeSseEvent } from '../../../common/utils/sse.util';
import type { GenerateChapterRequest, GenerateChapterResponse, ContinueChapterRequest } from './generation.controller.types';
import { SelfCritiqueService, SelfCritiqueResult } from '../evaluators/self-critique.service';

@ApiBearerAuth()
@ApiTags('Generation')
@Controller('generation')
@UseGuards(JwtAuthGuard)
export class GenerationChapterController {
  constructor(
    private readonly orchestration: GenerationOrchestrationService,
    private readonly gemini: GeminiLLMService,
    private readonly contentConverter: ContentConverterService,
    private readonly critique: SelfCritiqueService,
    private readonly manuscriptService: ManuscriptService,
    private readonly chapterService: ChapterService,
    private readonly chapterGenerationQueue: ChapterGenerationQueueService,
    private readonly chapterGenerationStream: ChapterGenerationStreamService,
  ) {}

  @Post('generate-chapter')
  async generateChapter(@Request() req: any, @Body() dto: GenerateChapterRequest): Promise<GenerateChapterResponse> {
    const userId = req.user.id;
    try {
      if (!dto.voiceProfileId || !dto.chapterTitle || !dto.outlineSection) {
        throw new BadRequestException('voiceProfileId, chapterTitle, and outlineSection are required');
      }

      const assembledPrompt = await this.orchestration.assembleChapterPrompt({ userId, voiceProfileId: dto.voiceProfileId, chapterTitle: dto.chapterTitle, outlineSection: dto.outlineSection, voiceStyleKey: dto.voiceStyleKey, additionalContext: dto.additionalContext, retrievalQuery: dto.retrievalQuery, customGuardrails: dto.customGuardrails });

      const llmResponse = await this.gemini.generateChapter({ systemPrompt: assembledPrompt.systemPrompt, userMessage: assembledPrompt.userMessage, temperature: 0.7, maxTokens: 4000 });

      const shouldCritique = dto.performSelfCritique !== false;
      let critiqueResult: SelfCritiqueResult | null = null;
      if (shouldCritique) {
        critiqueResult = await this.critique.critiquGeneration(assembledPrompt.metadata.voiceProfileId, dto.chapterTitle, assembledPrompt.metadata.voiceStyle, llmResponse.content);
      }

      const htmlContent = this.contentConverter.markdownToHtml(llmResponse.content);
      const baseResponse: GenerateChapterResponse = { success: true, draft: { content: htmlContent, chapterTitle: dto.chapterTitle, voiceProfileId: dto.voiceProfileId, generatedAt: new Date().toISOString() }, metadata: { model: llmResponse.model, tokensUsed: llmResponse.tokensUsed, voiceStyle: assembledPrompt.metadata.voiceStyle, scripturesUsed: assembledPrompt.metadata.scripturesUsed } };

      if (critiqueResult) {
        baseResponse.critique = { overallApproved: critiqueResult.overallApproved, overallScore: critiqueResult.overallScore, voiceConsistency: critiqueResult.voiceMatch.voiceConsistency, doctrinalScore: critiqueResult.doctrinalAlignment.doctrinalScore, flagsForReview: critiqueResult.flagsForReview, recommendations: critiqueResult.recommendations };
      }

      return baseResponse;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(`Chapter generation failed: ${message}`);
    }
  }

  @Get('manuscripts/:manuscriptId/chapters/events')
  async streamManuscriptChapterGenerationEvents(@Request() req: any, @Param('manuscriptId') manuscriptId: string, @Res() res: Response) {
    await this.chapterGenerationStream.subscribe(manuscriptId, req.user.id, res);
  }

  @Post('manuscripts/:manuscriptId/chapters/:chapterId/continue')
  async continueManuscriptChapter(@Request() req: any, @Param('manuscriptId') manuscriptId: string, @Param('chapterId') chapterId: string, @Body() dto: ContinueChapterRequest): Promise<any> {
    const userId = req.user.id;
    if (!dto.voiceProfileId) throw new BadRequestException('voiceProfileId is required');

    const manuscript = await this.manuscriptService.getManuscript(manuscriptId, userId);
    if (!manuscript) throw new NotFoundException('Manuscript not found');
    if (manuscript.voiceProfileId !== dto.voiceProfileId) throw new BadRequestException('voiceProfileId does not match manuscript');

    const chapter = (manuscript.chapters || []).find((item: any) => item.id === chapterId);
    if (!chapter) throw new NotFoundException('Chapter not found');

    const baseContent = dto.currentContent ?? chapter.content ?? '';
    const excerpt = String(baseContent).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(-2500);

    const assembledPrompt = await this.orchestration.assembleChapterPrompt({ userId, voiceProfileId: dto.voiceProfileId, chapterTitle: chapter.title, outlineSection: chapter.outlineSection || manuscript.description || chapter.title, voiceStyleKey: chapter.voiceStyle || undefined, additionalContext: [manuscript.title ? `Book Title: ${manuscript.title}` : '', manuscript.description ? `Book Description: ${manuscript.description}` : '', excerpt ? `Existing chapter ending to continue from:\n${excerpt}` : '', dto.additionalContext || ''].filter(Boolean).join('\n\n'), retrievalQuery: chapter.title });

    const llmResponse = await this.gemini.generateChapter({ systemPrompt: assembledPrompt.systemPrompt, userMessage: `${assembledPrompt.userMessage}\n\nContinue writing this chapter from the existing ending above. Do not restart the chapter, repeat the title, summarize previous content, or wrap up unless the chapter is naturally concluding. Write the next polished section only.`, temperature: 0.7, maxTokens: 1800 });

    const appendedContent = this.contentConverter.markdownToHtml(llmResponse.content);
    const separator = baseContent.trim() ? '\n\n' : '';
    const updatedChapter = await this.chapterService.updateChapter(chapterId, { content: `${baseContent}${separator}${appendedContent}`, status: 'generated' });

    return { success: true, chapter: updatedChapter, appendedContent, metadata: { model: llmResponse.model, tokensUsed: llmResponse.tokensUsed } };
  }

  @Post('manuscripts/:manuscriptId/chapters/:chapterId/continue/stream')
  async streamContinueManuscriptChapter(@Request() req: any, @Param('manuscriptId') manuscriptId: string, @Param('chapterId') chapterId: string, @Body() dto: ContinueChapterRequest, @Res() res: Response): Promise<void> {
    const userId = req.user.id;
    prepareSseResponse(res);

    try {
      if (!dto.voiceProfileId) throw new BadRequestException('voiceProfileId is required');

      const manuscript = await this.manuscriptService.getManuscript(manuscriptId, userId);
      if (!manuscript) throw new NotFoundException('Manuscript not found');
      if (manuscript.voiceProfileId !== dto.voiceProfileId) throw new BadRequestException('voiceProfileId does not match manuscript');

      const chapter = (manuscript.chapters || []).find((item: any) => item.id === chapterId);
      if (!chapter) throw new NotFoundException('Chapter not found');

      const baseContent = dto.currentContent ?? chapter.content ?? '';
      const excerpt = String(baseContent).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(-2500);

      const assembledPrompt = await this.orchestration.assembleChapterPrompt({ userId, voiceProfileId: dto.voiceProfileId, chapterTitle: chapter.title, outlineSection: chapter.outlineSection || manuscript.description || chapter.title, voiceStyleKey: chapter.voiceStyle || undefined, additionalContext: [manuscript.title ? `Book Title: ${manuscript.title}` : '', manuscript.description ? `Book Description: ${manuscript.description}` : '', excerpt ? `Existing chapter ending to continue from:\n${excerpt}` : '', dto.additionalContext || ''].filter(Boolean).join('\n\n'), retrievalQuery: chapter.title });

      let markdownContent = '';
      let lastHtmlContent = baseContent;

      for await (const chunk of this.gemini.generateChapterStream({ systemPrompt: assembledPrompt.systemPrompt, userMessage: `${assembledPrompt.userMessage}\n\nContinue writing this chapter from the existing ending above. Do not restart the chapter, repeat the title, summarize previous content, or wrap up unless the chapter is naturally concluding. Write the next polished section only.`, temperature: 0.7, maxTokens: 1800 })) {
        markdownContent = chunk.fullContent;
        const appendedHtml = this.contentConverter.markdownToHtml(markdownContent);
        const separator = baseContent.trim() ? '\n\n' : '';
        lastHtmlContent = `${baseContent}${separator}${appendedHtml}`;

        writeSseEvent(res, { event: 'chapter-continue-delta', data: { manuscriptId, chapterId, content: chunk.content, fullContent: lastHtmlContent } });
      }

      const updatedChapter = await this.chapterService.updateChapter(chapterId, { content: lastHtmlContent, status: 'generated' });

      writeSseEvent(res, { event: 'chapter-continue-completed', data: { manuscriptId, chapterId, chapter: updatedChapter } });
      writeSseEvent(res, { event: 'done', data: { ok: true } });
    } catch (error) {
      writeSseEvent(res, { event: 'error', data: { message: error instanceof Error ? error.message : 'Failed to continue chapter' } });
    } finally {
      res.end();
    }
  }

  @Get('manuscripts/:manuscriptId/chapters/generation-status')
  async getManuscriptChapterGenerationStatuses(@Request() req: any, @Param('manuscriptId') manuscriptId: string) {
    return this.chapterGenerationQueue.getStatusesForManuscript(manuscriptId, req.user.id);
  }
}
