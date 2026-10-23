import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Logger,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { InterviewOrchestrationService } from '../services/interview-orchestration.service';
import { PreviousWorksService } from '../services/previous-works.service';
import { InterviewFeedbackService } from '../services/interview-feedback.service';
import { ProcessInterviewDto } from '../dto/process-interview.dto';
import { UploadPreviousWorksDto } from '../dto/upload-previous-works.dto';
import { FeedbackInterviewDto } from '../dto/feedback-interview.dto';
import { InterviewProcessingQueueService } from '../services/interview-processing-queue.service';

@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('Interview')
@Controller('interview')
export class InterviewController {
  private readonly logger = new Logger(InterviewController.name);

  constructor(
    private readonly orchestrationService: InterviewOrchestrationService,
    private readonly previousWorksService: PreviousWorksService,
    private readonly queueService: InterviewProcessingQueueService,
    private readonly feedbackService: InterviewFeedbackService,
  ) {}

  @ApiOperation({ summary: 'Process user interview responses' })
  @ApiResponse({ status: 200, description: 'Interview processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid interview data' })
  @Post('process')
  async processInterview(
    @Body() interviewAnswers: ProcessInterviewDto,
    @Request() req,
  ) {
    this.logger.log(`Processing interview for user: ${req.user.id}`);

    try {
      const result = await this.orchestrationService.processInterview(
        interviewAnswers,
        req.user.id,
      );
      return result;
    } catch (error) {
      this.logger.error('Interview processing failed', error);
      throw error;
    }
  }

  @ApiOperation({ summary: 'Get real-time AI feedback on answer completeness' })
  @ApiResponse({ status: 200, description: 'Feedback score and lines returned' })
  @Post('feedback')
  async getAnswerFeedback(
    @Body() dto: FeedbackInterviewDto,
    @Request() req,
  ) {
    this.logger.log(`Feedback request for question: ${dto.questionId} by user: ${req.user.id}`);
    return this.feedbackService.evaluateAnswer(dto);
  }

  @ApiOperation({ summary: 'Get all voice profile statuses for user' })
  @ApiResponse({ status: 200, description: 'Voice profile statuses retrieved' })
  @Get('voice-profile-status')
  async getVoiceProfileStatuses(@Request() req) {
    return this.queueService.getStatusesForUser(req.user.id);
  }

  @ApiOperation({ summary: 'Get specific voice profile status' })
  @ApiResponse({ status: 200, description: 'Voice profile status retrieved' })
  @ApiResponse({ status: 404, description: 'Voice profile not found' })
  @Get('voice-profile-status/:voiceProfileId')
  async getVoiceProfileStatus(
    @Param('voiceProfileId') voiceProfileId: string,
    @Request() req,
  ) {
    return this.queueService.getStatus(voiceProfileId, req.user.id);
  }

  @ApiOperation({ summary: 'Upload previous author works' })
  @ApiResponse({ status: 200, description: 'Previous works uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid previous works data' })
  @Post('upload-previous-works')
  async uploadPreviousWorks(
    @Body() dto: UploadPreviousWorksDto,
    @Request() req,
  ) {
    this.logger.log(
      `Uploading previous works for user: ${req.user.id}, voice profile: ${dto.voiceProfileId}`,
    );

    try {
      const result = await this.previousWorksService.processPreviousWorks({
        ...dto,
        userId: req.user.id,
      });
      return result;
    } catch (error) {
      this.logger.error('Previous works upload failed', error);
      throw error;
    }
  }
}
