import {
  Controller,
  UseGuards,
  Request,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { VoiceProfileService } from '../services/voice-profile.service';
import { CreateVoiceProfileDto } from '../dto/create-voice-profile.dto';
import { UpdateVoiceProfileDto } from '../dto/update-voice-profile.dto';

@ApiBearerAuth()
@ApiTags('Voice Profiles')
@UseGuards(JwtAuthGuard)
@Controller('voice-profiles')
export class VoiceProfileController {
  private readonly logger = new Logger(VoiceProfileController.name);

  constructor(private readonly service: VoiceProfileService) {}

  @ApiOperation({ summary: 'Get all voice profiles for user' })
  @ApiResponse({ status: 200, description: 'Voice profiles retrieved' })
  @Get()
  async findAll(@Request() req) {
    return this.service.findAllByUser(req.user.id);
  }

  @ApiOperation({ summary: 'Create new voice profile' })
  @ApiResponse({ status: 201, description: 'Voice profile created' })
  @ApiResponse({ status: 400, description: 'Invalid profile data' })
  @Post()
  async create(@Body() dto: CreateVoiceProfileDto, @Request() req) {
    const userId = req.user.id;
    const requestId = Math.random().toString(36).substr(2, 9);

    this.logger.debug(
      `[CREATE-${requestId}] Creating voice profile - name: ${dto.name}`,
    );

    dto.userId = userId;
    const result = await this.service.create(dto);

    this.logger.debug(
      `[CREATE-${requestId}] Profile created - id: ${result.id}`,
    );

    return result;
  }

  @ApiOperation({ summary: 'Get specific voice profile' })
  @ApiResponse({ status: 200, description: 'Voice profile retrieved' })
  @ApiResponse({ status: 404, description: 'Voice profile not found' })
  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    const vp = await this.service.findById(id);
    if (!vp) throw new NotFoundException();
    if (vp.userId !== req.user.id) throw new ForbiddenException();
    return vp;
  }

  @ApiOperation({ summary: 'Update voice profile' })
  @ApiResponse({ status: 200, description: 'Voice profile updated' })
  @ApiResponse({ status: 404, description: 'Voice profile not found' })
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVoiceProfileDto,
    @Request() req,
  ) {
    const vp = await this.service.findById(id);
    if (!vp) throw new NotFoundException();
    if (vp.userId !== req.user.id) throw new ForbiddenException();
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete voice profile' })
  @ApiResponse({ status: 200, description: 'Voice profile deleted' })
  @ApiResponse({ status: 404, description: 'Voice profile not found' })
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    const vp = await this.service.findById(id);
    if (!vp) throw new NotFoundException();
    if (vp.userId !== req.user.id) throw new ForbiddenException();
    return this.service.remove(id);
  }
}
