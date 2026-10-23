import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ManuscriptService } from '../../manuscripts/services/manuscript.service';
import { CreateChapterDto } from '../dto/create-chapter.dto';
import { ChapterService } from '../services/chapter.service';

@ApiBearerAuth()
@ApiTags('Manuscripts')
@Controller('manuscripts')
@UseGuards(JwtAuthGuard)
export class ChapterController {
  constructor(
    private readonly manuscriptService: ManuscriptService,
    private readonly chapterService: ChapterService,
  ) {}

  @ApiOperation({ summary: 'Create a new chapter' })
  @ApiResponse({ status: 201, description: 'Chapter created' })
  @ApiResponse({ status: 404, description: 'Manuscript not found' })
  @Post(':manuscriptId/chapters')
  async createChapter(
    @Request() req: any,
    @Param('manuscriptId') manuscriptId: string,
    @Body() dto: CreateChapterDto,
  ) {
    const userId = req.user.id;
    const manuscript = await this.manuscriptService.getManuscript(
      manuscriptId,
      userId,
    );

    if (!manuscript) {
      throw new NotFoundException('Manuscript not found');
    }

    return this.chapterService.createChapter(manuscriptId, dto);
  }

  @ApiOperation({ summary: 'Get specific chapter' })
  @ApiResponse({ status: 200, description: 'Chapter retrieved' })
  @ApiResponse({ status: 404, description: 'Chapter or manuscript not found' })
  @Get(':manuscriptId/chapters/:chapterId')
  async getChapter(
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

    return chapter;
  }
}
