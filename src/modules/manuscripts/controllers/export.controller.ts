import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  NotFoundException,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ManuscriptService } from '../services/manuscript.service';
import { DocxExportService } from '../services/docx-export.service';
import { PrismaService } from '../../../prisma.service';

@ApiBearerAuth()
@ApiTags('Manuscripts')
@Controller('manuscripts')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(
    private readonly manuscriptService: ManuscriptService,
    private readonly exportService: DocxExportService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiOperation({ summary: 'Export manuscript to DOCX format' })
  @ApiResponse({ status: 200, description: 'Manuscript exported successfully' })
  @ApiResponse({ status: 404, description: 'Manuscript not found' })
  @Post(':id/export')
  async exportManuscript(
    @Request() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const userId = req.user.id;
    const manuscript = await this.prisma.manuscript.findFirst({
      where: { id, userId },
      include: {
        chapters: { orderBy: { order: 'asc' } },
        voiceProfile: true,
      },
    });

    if (!manuscript) {
      throw new NotFoundException('Manuscript not found');
    }

    const exportData = {
      title: manuscript.title,
      description: manuscript.description || undefined,
      voiceProfileName: manuscript.voiceProfile?.name,
      generatedDate: new Date().toLocaleDateString(),
      chapters: manuscript.chapters.map((chapter) => ({
        title: chapter.title,
        content: chapter.content || '[No content yet]',
        voiceStyle: chapter.voiceStyle,
      })),
    };

    const buffer = await this.exportService.exportToDocx(exportData);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${manuscript.title.replace(/\s+/g, '_')}.docx"`,
    );
    res.send(buffer);
  }
}
