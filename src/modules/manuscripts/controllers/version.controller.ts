import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ManuscriptService } from '../services/manuscript.service';

@ApiBearerAuth()
@ApiTags('Manuscripts')
@Controller('manuscripts')
@UseGuards(JwtAuthGuard)
export class VersionController {
  constructor(private readonly manuscriptService: ManuscriptService) {}

  @ApiOperation({ summary: 'Save book cover for manuscript' })
  @ApiResponse({ status: 200, description: 'Book cover updated' })
  @ApiResponse({ status: 404, description: 'Manuscript not found' })
  @Post(':id/book-cover')
  async saveBookCover(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { bookCoverUrl: string },
  ) {
    const userId = req.user.id;
    const manuscript = await this.manuscriptService.getManuscript(id, userId);

    if (!manuscript) {
      throw new NotFoundException('Manuscript not found');
    }

    if (!body.bookCoverUrl) {
      throw new BadRequestException('bookCoverUrl is required');
    }

    return this.manuscriptService.updateBookCoverUrl(id, body.bookCoverUrl);
  }

  @ApiOperation({ summary: 'Save new manuscript version' })
  @ApiResponse({ status: 201, description: 'Version saved successfully' })
  @ApiResponse({ status: 404, description: 'Manuscript not found' })
  @Post(':id/versions')
  async saveVersion(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { description?: string; manuscript: any },
  ) {
    const userId = req.user.id;
    const manuscript = await this.manuscriptService.getManuscript(id, userId);

    if (!manuscript) {
      throw new NotFoundException('Manuscript not found');
    }

    return this.manuscriptService.saveManuscriptVersion(
      id,
      userId,
      body.manuscript,
      body.description,
    );
  }

  @ApiOperation({ summary: 'Get all manuscript versions' })
  @ApiResponse({ status: 200, description: 'Versions retrieved' })
  @ApiResponse({ status: 404, description: 'Manuscript not found' })
  @Get(':id/versions')
  async getVersions(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    const manuscript = await this.manuscriptService.getManuscript(id, userId);

    if (!manuscript) {
      throw new NotFoundException('Manuscript not found');
    }

    return this.manuscriptService.getManuscriptVersions(id);
  }

  @ApiOperation({ summary: 'Restore manuscript to previous version' })
  @ApiResponse({ status: 200, description: 'Version restored' })
  @ApiResponse({ status: 404, description: 'Manuscript or version not found' })
  @Post(':id/versions/:versionId/restore')
  async restoreVersion(
    @Request() req: any,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    const userId = req.user.id;
    const manuscript = await this.manuscriptService.getManuscript(id, userId);

    if (!manuscript) {
      throw new NotFoundException('Manuscript not found');
    }

    return this.manuscriptService.restoreVersion(versionId, id);
  }
}
