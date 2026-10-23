import { Controller, Post, Body, Request, BadRequestException, NotFoundException, UseGuards, Param, InternalServerErrorException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ManuscriptService } from '../../manuscripts/services/manuscript.service';
import { ChapterService } from '../../chapters/services/chapter.service';
import { ChapterGenerationQueueService } from '../services/chapter-generation-queue.service';
import type { GenerateManuscriptChapterRequest } from './generation.controller.types';

@ApiBearerAuth()
@ApiTags('Generation')
@Controller('generation')
@UseGuards(JwtAuthGuard)
export class GenerationManuscriptController {
  constructor(
    private readonly manuscriptService: ManuscriptService,
    private readonly chapterService: ChapterService,
    private readonly chapterGenerationQueue: ChapterGenerationQueueService,
  ) {}

  @Post('generate-manuscript')
  async generateManuscript(@Request() req: any, @Body() dto: any): Promise<any> {
    const userId = req.user.id;

    try {
      if (!dto.voiceProfileId || !dto.outline) {
        throw new BadRequestException('voiceProfileId and outline are required');
      }

      const existingManuscript = dto.manuscriptId
        ? await this.manuscriptService.getManuscript(dto.manuscriptId, userId)
        : null;

      if (dto.manuscriptId && !existingManuscript) throw new NotFoundException('Manuscript not found');
      if (existingManuscript && existingManuscript.voiceProfileId !== dto.voiceProfileId) {
        throw new BadRequestException('voiceProfileId does not match manuscript');
      }

      const manuscript = existingManuscript || (await this.manuscriptService.createManuscript(userId, {
        voiceProfileId: dto.voiceProfileId,
        title: dto.manuscriptTitle || dto.outline.title,
        description: dto.manuscriptDescription || dto.outline.description,
        outline: dto.outline,
      }));

      const queuedStatuses: any[] = [];
      for (const outlineChapter of dto.outline.chapters || []) {
        const outlineSection = [
          outlineChapter.objectives?.length ? `Objectives: ${outlineChapter.objectives.join(', ')}` : '',
          outlineChapter.keyPoints?.length ? `Key Points: ${outlineChapter.keyPoints.join(', ')}` : '',
        ].filter(Boolean).join('\n');

        const chapter = await this.chapterService.createChapter(manuscript.id!, {
          title: outlineChapter.title,
          outlineSection,
          order: outlineChapter.number,
          voiceStyle: dto.voiceStyleKey || 'APOSTOLIC',
        });

        await this.chapterService.updateChapter(chapter.id!, { status: 'generating' });

        queuedStatuses.push(await this.chapterGenerationQueue.enqueue({
          userId,
          manuscriptId: manuscript.id!,
          voiceProfileId: dto.voiceProfileId,
          chapterId: chapter.id!,
          chapterTitle: outlineChapter.title,
          outlineSection,
          voiceStyleKey: dto.voiceStyleKey || 'APOSTOLIC',
          expectedWordCount: outlineChapter.estimatedWordCount,
          additionalContext: [
            dto.outline.overview ? `Manuscript Overview: ${dto.outline.overview}` : '',
            dto.outline.themes?.length ? `Themes: ${dto.outline.themes.join(', ')}` : '',
          ].filter(Boolean).join('\n'),
        }));
      }

      return { success: true, manuscriptId: manuscript.id!, title: manuscript.title, chaptersQueued: queuedStatuses.length, totalChapters: dto.outline.chapters?.length || 0, statuses: queuedStatuses };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(`Manuscript generation failed: ${message}`);
    }
  }

  @Post('manuscripts/:manuscriptId/chapters/generate')
  async createAndGenerateManuscriptChapter(
    @Request() req: any,
    @Param('manuscriptId') manuscriptId: string,
    @Body() dto: GenerateManuscriptChapterRequest,
  ): Promise<any> {
    const userId = req.user.id;

    if (!dto.voiceProfileId || !dto.chapterTitle || !dto.chapterDescription) {
      throw new BadRequestException('voiceProfileId, chapterTitle, and chapterDescription are required');
    }

    const manuscript = await this.manuscriptService.getManuscript(manuscriptId, userId);
    if (!manuscript) throw new NotFoundException('Manuscript not found');
    if (manuscript.voiceProfileId !== dto.voiceProfileId) throw new BadRequestException('voiceProfileId does not match manuscript');

    const nextOrder = (manuscript.chapters || []).reduce((max: number, chapter: any) => Math.max(max, chapter.order || 0), 0) + 1;

    const chapter = await this.chapterService.createChapter(manuscriptId, { title: dto.chapterTitle, outlineSection: dto.chapterDescription, order: nextOrder, voiceStyle: dto.voiceStyleKey });

    await this.chapterService.updateChapter(chapter.id!, { status: 'generating' });

    const status = await this.chapterGenerationQueue.enqueue({ userId, manuscriptId, voiceProfileId: dto.voiceProfileId, chapterId: chapter.id!, chapterTitle: dto.chapterTitle, outlineSection: dto.chapterDescription, voiceStyleKey: dto.voiceStyleKey, additionalContext: dto.additionalContext });

    return { success: true, chapter: { ...chapter, status: 'generating' }, status };
  }
}
