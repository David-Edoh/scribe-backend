import {
  Controller,
  Post,
  Body,
  Request,
  Res,
  BadRequestException,
  InternalServerErrorException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OutlineGenerationService } from '../services/outline-generation.service';
import { ManuscriptService } from '../../manuscripts/services/manuscript.service';
import { prepareSseResponse, writeSseEvent } from '../../../common/utils/sse.util';
import type {
  GenerateOutlineRequest,
  GenerateOutlineResponse,
  GenerateOutlineStreamRequest,
  OutlineStreamResult,
} from '../../generation/controllers/generation.controller.types';
import { getOutlineStreamRequestKey } from '../../generation/controllers/generation.controller.types';

@ApiBearerAuth()
@ApiTags('Generation')
@Controller('generation')
@UseGuards(JwtAuthGuard)
export class OutlineGenerationController {
  private static readonly outlineStreamRequests = new Map<string, Promise<OutlineStreamResult>>();

  constructor(
    private readonly outlineGeneration: OutlineGenerationService,
    private readonly manuscriptService: ManuscriptService,
  ) {}

  @ApiOperation({ summary: 'Generate manuscript outline' })
  @ApiResponse({ status: 200, description: 'Outline generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid generation parameters' })
  @Post('generate-manuscript-outline')
  async generateManuscriptOutline(
    @Request() req: any,
    @Body() dto: GenerateOutlineRequest,
  ): Promise<GenerateOutlineResponse> {
    const userId = req.user.id;

    try {
      if (!dto.voiceProfileId || !dto.title || !dto.more_info) {
        throw new BadRequestException('voiceProfileId, title, and more_info are required');
      }

      const outline = await this.outlineGeneration.generateOutline({
        userId,
        voiceProfileId: dto.voiceProfileId,
        title: dto.title,
        moreInfo: dto.more_info,
        voiceStyleKey: dto.voiceStyleKey,
      });

      return { success: true, outline };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(`Outline generation failed: ${message}`);
    }
  }

  @Post('generate-manuscript-outline/stream')
  async streamGenerateManuscriptOutline(
    @Request() req: any,
    @Body() dto: GenerateOutlineStreamRequest,
    @Res() res: Response,
  ): Promise<void> {
    const userId = req.user.id;
    prepareSseResponse(res);

    try {
      if (!dto.voiceProfileId || !dto.title || !dto.more_info) {
        throw new BadRequestException('voiceProfileId, title, and more_info are required');
      }

      writeSseEvent(res, { event: 'outline-status', data: { message: 'Creating outline...' } });

      const requestKey = getOutlineStreamRequestKey(userId, dto);
      let outlineRequest = OutlineGenerationController.outlineStreamRequests.get(requestKey);

      if (!outlineRequest) {
        outlineRequest = (async () => {
          const outline = await this.outlineGeneration.generateOutline({
            userId,
            voiceProfileId: dto.voiceProfileId,
            title: dto.title,
            moreInfo: dto.more_info,
            voiceStyleKey: dto.voiceStyleKey,
          });

          const manuscript = await this.manuscriptService.createManuscript(userId, {
            voiceProfileId: dto.voiceProfileId,
            title: outline.title || dto.title,
            description: outline.description || dto.more_info,
            outline,
          });

          return { outline, manuscriptId: manuscript.id!, voiceProfileId: dto.voiceProfileId };
        })().finally(() => OutlineGenerationController.outlineStreamRequests.delete(requestKey));

        OutlineGenerationController.outlineStreamRequests.set(requestKey, outlineRequest);
      } else {
        writeSseEvent(res, { event: 'outline-status', data: { message: 'Finishing outline...' } });
      }

      const result = await outlineRequest;
      writeSseEvent(res, { event: 'outline-completed', data: result });
      writeSseEvent(res, { event: 'done', data: { ok: true } });
    } catch (error) {
      writeSseEvent(res, { event: 'error', data: { message: error instanceof Error ? error.message : 'Failed to generate outline' } });
    } finally {
      res.end();
    }
  }
}
