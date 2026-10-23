import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RAGService } from '../services/rag.service';

@ApiBearerAuth()
@ApiTags('RAG')
@Controller('rag')
@UseGuards(JwtAuthGuard)
export class RAGController {
  private readonly logger = new Logger(RAGController.name);

  constructor(private readonly ragService: RAGService) {}

  /**
   * Retrieve context for outline generation
   * POST /rag/context-for-outline
   * Body: { query: string, limit?: number }
   */
  @ApiOperation({ summary: 'Retrieve context for outline generation' })
  @ApiResponse({ status: 200, description: 'Context retrieved successfully' })
  @Post('context-for-outline')
  async getContextForOutlineGeneration(
   @Request() req: any,
   @Body() body: { query: string; limit?: number },
  ) {
   try {
     const context = await this.ragService.retrieveContextForGeneration(
       req.user.id,
       body.query,
       body.limit || 5,
     );
     return {
       success: true,
       data: context,
     };
   } catch (error) {
     this.logger.error(`Failed to retrieve context: ${error}`);
     return {
       success: false,
       error:
         error instanceof Error ? error.message : 'Failed to retrieve context',
     };
   }
  }

  /**
   * Get outline generation prompt with RAG context
   * POST /rag/outline-prompt
   * Body: { query: string, voiceProfileId: string }
   */
  @Post('outline-prompt')
  async getOutlinePrompt(
    @Request() req: any,
    @Body() body: { query: string; voiceProfileId: string },
  ) {
    try {
      const prompt = await this.ragService.buildOutlinePrompt(
        req.user.id,
        body.query,
        body.voiceProfileId,
      );
      return {
        success: true,
        prompt,
      };
    } catch (error) {
      this.logger.error(`Failed to build outline prompt: ${error}`);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to build prompt',
      };
    }
  }

  /**
   * Get manuscript generation prompt with RAG context
   * POST /rag/manuscript-prompt
   * Body: { chapterTitle: string, outline: string, voiceProfileId: string }
   */
  @Post('manuscript-prompt')
  async getManuscriptPrompt(
    @Request() req: any,
    @Body()
    body: { chapterTitle: string; outline: string; voiceProfileId: string },
  ) {
    try {
      const prompt = await this.ragService.buildManuscriptPrompt(
        req.user.id,
        body.chapterTitle,
        body.outline,
        body.voiceProfileId,
      );
      return {
        success: true,
        prompt,
      };
    } catch (error) {
      this.logger.error(`Failed to build manuscript prompt: ${error}`);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to build prompt',
      };
    }
  }

  /**
   * Get detailed context report for debugging
   * GET /rag/context-report?query=...
   */
  @Get('context-report')
  async getContextReport(@Request() req: any, @Body() body: { query: string }) {
    try {
      const report = await this.ragService.getContextReport(
        req.user.id,
        body.query,
      );
      return {
        success: true,
        data: report,
      };
    } catch (error) {
      this.logger.error(`Failed to generate context report: ${error}`);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to generate report',
      };
    }
  }
}
