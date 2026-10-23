import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InterviewProcessingWorkflow } from '../workflows/interview-processing.workflow';
import { PreviousWorksService } from './previous-works.service';
import {
  InterviewProcessingJob,
  InterviewProcessingQueueService,
} from './interview-processing-queue.service';

@Injectable()
export class InterviewProcessingWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InterviewProcessingWorker.name);
  private timer?: NodeJS.Timeout;
  private isWorking = false;

  constructor(
    private readonly queueService: InterviewProcessingQueueService,
    private readonly interviewWorkflow: InterviewProcessingWorkflow,
    private readonly previousWorksService: PreviousWorksService,
  ) {}

  onModuleInit() {
    void this.start();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async processNext() {
    if (this.isWorking) return;
    this.isWorking = true;

    try {
      const job = await this.queueService.claimNextJob();
      if (!job) return;

      await this.processJob(job);
    } catch (error) {
      this.logger.error('Interview worker tick failed', error);
    } finally {
      this.isWorking = false;
    }
  }

  private async start() {
    await this.queueService.recoverInterruptedJobs();
    this.timer = setInterval(() => void this.processNext(), 1500);
    void this.processNext();
  }

  private async processJob(job: InterviewProcessingJob) {
    this.logger.log(
      `Processing interview job ${job.id} for profile ${job.voiceProfileId}`,
    );

    try {
      const workflowResult = await this.interviewWorkflow.executeWorkflow(
        job.interviewAnswers,
        job.userId,
      );

      if (!workflowResult.success) {
        throw new Error(workflowResult.error || 'Interview processing failed');
      }

      if (job.previousWorks.length > 0) {
        const previousWorksResult =
          await this.previousWorksService.processPreviousWorks({
            voiceProfileId: job.voiceProfileId,
            chunks: job.previousWorks,
            userId: job.userId,
          });

        if (!previousWorksResult.success) {
          this.logger.warn(
            `Previous works processing failed for job ${job.id}: ${previousWorksResult.error}`,
          );
        }
      }

      await this.queueService.markCompleted(job);
      this.logger.log(`Interview job completed: ${job.id}`);
    } catch (error) {
      await this.queueService.markFailed(job, error);
      this.logger.error(`Interview job failed: ${job.id}`, error);
    }
  }
}
