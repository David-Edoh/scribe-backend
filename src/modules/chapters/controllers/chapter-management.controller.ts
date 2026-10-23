import {
  Controller,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ManuscriptService } from '../../manuscripts/services/manuscript.service';
import { UpdateChapterDto } from '../dto/update-chapter.dto';
import { ChapterService } from '../services/chapter.service';

@ApiBearerAuth()
@ApiTags('Manuscripts')
@Controller('manuscripts')
@UseGuards(JwtAuthGuard)
export class ChapterManagementController {
  constructor(
    private readonly manuscriptService: ManuscriptService,
    private readonly chapterService: ChapterService,
  ) {}

  @ApiOperation({ summary: 'Reorder chapters in manuscript' })
  @ApiResponse({ status: 200, description: 'Chapters reordered' })
  @ApiResponse({ status: 400, description: 'Invalid chapter data' })
  @ApiResponse({ status: 404, description: 'Manuscript not found' })
  @Put(':manuscriptId/chapters/reorder')
  async reorderChapters(
    @Request() req: any,
    @Param('manuscriptId') manuscriptId: string,
    @Body() body: { chapters: Array<{ id: string; order: number }> },
  ) {
    const userId = req.user.id;
    const manuscript = await this.manuscriptService.getManuscript(
      manuscriptId,
      userId,
    );

    if (!manuscript) {
      throw new NotFoundException('Manuscript not found');
    }

    if (!Array.isArray(body.chapters) || body.chapters.length === 0) {
      throw new BadRequestException('chapters are required');
    }

    const manuscriptChapterIds = new Set(
      (manuscript.chapters || []).map((chapter: any) => chapter.id),
    );
    const hasInvalidChapter = body.chapters.some(
      (chapter) => !manuscriptChapterIds.has(chapter.id),
    );

    if (hasInvalidChapter) {
      throw new BadRequestException(
        'All reordered chapters must belong to the manuscript',
      );
    }

    return this.chapterService.reorderChapters(
      manuscriptId,
      body.chapters,
    );
  }

  @ApiOperation({ summary: 'Update chapter' })
  @ApiResponse({ status: 200, description: 'Chapter updated' })
  @ApiResponse({ status: 404, description: 'Chapter or manuscript not found' })
  @Put(':manuscriptId/chapters/:chapterId')
  async updateChapter(
    @Request() req: any,
    @Param('manuscriptId') manuscriptId: string,
    @Param('chapterId') chapterId: string,
    @Body() dto: UpdateChapterDto,
  ) {
    const userId = req.user.id;
    const manuscript = await this.manuscriptService.getManuscript(
      manuscriptId,
      userId,
    );

    if (!manuscript) {
      throw new NotFoundException('Manuscript not found');
    }

    const chapter = await this.chapterService.getChapter(chapterId);
    if (!chapter || chapter.manuscriptId !== manuscriptId) {
      throw new NotFoundException('Chapter not found');
    }

    return this.chapterService.updateChapter(chapterId, dto);
  }

  @ApiOperation({ summary: 'Delete chapter' })
  @ApiResponse({ status: 200, description: 'Chapter deleted' })
  @ApiResponse({ status: 404, description: 'Chapter or manuscript not found' })
  @Delete(':manuscriptId/chapters/:chapterId')
  async deleteChapter(
    @Request() req: any,
    @Param('manuscriptId') manuscriptId: string,
    @Param('chapterId') chapterId: string,
  ) {
    const userId = req.user.id;
    const manuscript = await this.manuscriptService.getManuscript(
      manuscriptId,
      userId,
    );

    if (!manuscript) {
      throw new NotFoundException('Manuscript not found');
    }

    const chapter = await this.chapterService.getChapter(chapterId);
    if (!chapter || chapter.manuscriptId !== manuscriptId) {
      throw new NotFoundException('Chapter not found');
    }

    return this.chapterService.deleteChapter(chapterId);
  }
}
