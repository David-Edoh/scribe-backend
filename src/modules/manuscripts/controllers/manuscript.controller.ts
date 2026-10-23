import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ManuscriptService } from '../services/manuscript.service';
import { CreateManuscriptDto } from '../dto/create-manuscript.dto';
import { UpdateManuscriptDto } from '../dto/update-manuscript.dto';

@ApiBearerAuth()
@ApiTags('Manuscripts')
@Controller('manuscripts')
@UseGuards(JwtAuthGuard)
export class ManuscriptController {
  constructor(private readonly manuscriptService: ManuscriptService) {}

  @ApiOperation({ summary: 'Create a new manuscript' })
  @ApiResponse({ status: 201, description: 'Manuscript created successfully' })
  @Post()
  async createManuscript(
    @Request() req: any,
    @Body() dto: CreateManuscriptDto,
  ) {
    const userId = req.user.id;
    return this.manuscriptService.createManuscript(userId, dto);
  }

  @ApiOperation({ summary: 'List all manuscripts for user' })
  @ApiResponse({ status: 200, description: 'Manuscripts retrieved' })
  @Get()
  async listManuscripts(@Request() req: any) {
    const userId = req.user.id;
    return this.manuscriptService.listManuscripts(userId);
  }

  @ApiOperation({ summary: 'List manuscripts for specific voice profile' })
  @ApiResponse({ status: 200, description: 'Manuscripts retrieved' })
  @Get('profile/:voiceProfileId')
  async listManuscriptsByProfile(
    @Request() req: any,
    @Param('voiceProfileId') voiceProfileId: string,
  ) {
    const userId = req.user.id;
    return this.manuscriptService.listManuscriptsByVoiceProfile(
      userId,
      voiceProfileId,
    );
  }

  @ApiOperation({ summary: 'Get specific manuscript' })
  @ApiResponse({ status: 200, description: 'Manuscript retrieved' })
  @ApiResponse({ status: 404, description: 'Manuscript not found' })
  @Get(':id')
  async getManuscript(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    const manuscript = await this.manuscriptService.getManuscript(id, userId);

    if (!manuscript) {
      throw new NotFoundException('Manuscript not found');
    }

    return manuscript;
  }

  @ApiOperation({ summary: 'Update manuscript' })
  @ApiResponse({ status: 200, description: 'Manuscript updated' })
  @ApiResponse({ status: 404, description: 'Manuscript not found' })
  @Put(':id')
  async updateManuscript(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateManuscriptDto,
  ) {
    const userId = req.user.id;
    const manuscript = await this.manuscriptService.getManuscript(id, userId);

    if (!manuscript) {
      throw new NotFoundException('Manuscript not found');
    }

    return this.manuscriptService.updateManuscript(id, userId, dto);
  }

  @ApiOperation({ summary: 'Delete manuscript' })
  @ApiResponse({ status: 200, description: 'Manuscript deleted' })
  @ApiResponse({ status: 404, description: 'Manuscript not found' })
  @Delete(':id')
  async deleteManuscript(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    const manuscript = await this.manuscriptService.getManuscript(id, userId);

    if (!manuscript) {
      throw new NotFoundException('Manuscript not found');
    }

    return this.manuscriptService.deleteManuscript(id, userId);
  }
}

