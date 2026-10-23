import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { UpstashService } from '../../../common/services/upstash.service';
import { VoiceProfileService } from '../../voice-profile/services/voice-profile.service';
import { ProcessInterviewDto } from '../dto/process-interview.dto';

export type InterviewJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

export interface InterviewProcessingJob {
  id: string;
  userId: string;
  voiceProfileId: string;
  interviewAnswers: ProcessInterviewDto;
  previousWorks: { fileName: string; content: string }[];
  createdAt: string;
}

export interface InterviewStatusRecord {
  voiceProfileId: string;
  userId: string;
  status: InterviewJobStatus;
  label: 'Creating' | 'Ready' | 'Failed';
  jobId?: string;
  error?: string;
  updatedAt: string;
}

@Injectable()
export class InterviewProcessingQueueService {
  private readonly logger = new Logger(InterviewProcessingQueueService.name);
  private readonly queueKey = 'scribe:interview-processing:queue';
  private readonly activeJobsKey = 'scribe:interview-processing:active-jobs';

  constructor(
    private readonly upstashService: UpstashService,
    private readonly voiceProfileService: VoiceProfileService,
  ) {}

  async enqueue(
    interviewAnswers: ProcessInterviewDto,
    userId: string,
  ): Promise<InterviewStatusRecord> {
    if (!this.upstashService.isConfigured()) {
      throw new Error('Redis is not configured for interview processing.');
    }

    const voiceProfile = await this.voiceProfileService.findById(
      interviewAnswers.voiceProfileId,
    );
    if (!voiceProfile) throw new NotFoundException('Voice profile not found');
    if (voiceProfile.userId !== userId) {
      throw new ForbiddenException('Voice profile does not belong to user');
    }

    const previousWorks = interviewAnswers.previousWorks || [];
    const job: InterviewProcessingJob = {
      id: `${interviewAnswers.voiceProfileId}:${Date.now()}`,
      userId,
      voiceProfileId: interviewAnswers.voiceProfileId,
      interviewAnswers: {
        ...interviewAnswers,
        previousWorks: undefined,
      },
      previousWorks,
      createdAt: new Date().toISOString(),
    };

    const status: InterviewStatusRecord = {
      voiceProfileId: job.voiceProfileId,
      userId,
      status: 'queued',
      label: 'Creating',
      jobId: job.id,
      updatedAt: new Date().toISOString(),
    };

    const redis = this.upstashService.getClient();
    await redis.set(this.jobKey(job.id), job);
    await redis.set(this.statusKey(job.voiceProfileId), status);
    await redis.sadd(this.activeJobsKey, job.id);
    await redis.lpush(this.queueKey, job.id);

    this.logger.log(
      `Queued interview processing job ${job.id} for profile ${job.voiceProfileId}`,
    );

    return status;
  }

  async claimNextJob(): Promise<InterviewProcessingJob | null> {
    if (!this.upstashService.isConfigured()) return null;

    const redis = this.upstashService.getClient();
    const jobId = await redis.rpop<string>(this.queueKey);
    if (!jobId) return null;

    const lockAcquired = await redis.set(this.lockKey(jobId), '1', {
      nx: true,
      ex: 60 * 30,
    });
    if (lockAcquired !== 'OK') return null;

    const job = await redis.get<InterviewProcessingJob>(this.jobKey(jobId));
    if (!job) {
      await redis.del(this.lockKey(jobId));
      return null;
    }

    await this.markProcessing(job);
    return job;
  }

  async recoverInterruptedJobs() {
    if (!this.upstashService.isConfigured()) return;

    const redis = this.upstashService.getClient();
    const jobIds = await redis.smembers<string[]>(this.activeJobsKey);
    if (!jobIds || jobIds.length === 0) return;

    for (const jobId of jobIds) {
      const job = await redis.get<InterviewProcessingJob>(this.jobKey(jobId));
      if (!job) {
        await redis.srem(this.activeJobsKey, jobId);
        continue;
      }

      const lockExists = await redis.exists(this.lockKey(jobId));
      if (!lockExists) {
        await redis.lpush(this.queueKey, jobId);
      }
    }
  }

  async markProcessing(job: InterviewProcessingJob) {
    await this.setStatus({
      voiceProfileId: job.voiceProfileId,
      userId: job.userId,
      status: 'processing',
      label: 'Creating',
      jobId: job.id,
      updatedAt: new Date().toISOString(),
    });
  }

  async markCompleted(job: InterviewProcessingJob) {
    const redis = this.upstashService.getClient();
    await this.setStatus({
      voiceProfileId: job.voiceProfileId,
      userId: job.userId,
      status: 'completed',
      label: 'Ready',
      jobId: job.id,
      updatedAt: new Date().toISOString(),
    });
    await redis.del(this.lockKey(job.id));
    await redis.del(this.jobKey(job.id));
    await redis.srem(this.activeJobsKey, job.id);
  }

  async markFailed(job: InterviewProcessingJob, error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Interview processing failed';
    const redis = this.upstashService.getClient();
    await this.setStatus({
      voiceProfileId: job.voiceProfileId,
      userId: job.userId,
      status: 'failed',
      label: 'Failed',
      jobId: job.id,
      error: errorMessage,
      updatedAt: new Date().toISOString(),
    });
    await redis.del(this.lockKey(job.id));
    await redis.del(this.jobKey(job.id));
    await redis.srem(this.activeJobsKey, job.id);
  }

  async getStatus(
    voiceProfileId: string,
    userId: string,
  ): Promise<InterviewStatusRecord> {
    const voiceProfile = await this.voiceProfileService.findById(voiceProfileId);
    if (!voiceProfile) throw new NotFoundException('Voice profile not found');
    if (voiceProfile.userId !== userId) {
      throw new ForbiddenException('Voice profile does not belong to user');
    }

    const redisStatus = await this.getRedisStatus(voiceProfileId);
    if (redisStatus) return redisStatus;

    return this.inferStatusFromProfile(voiceProfile);
  }

  async getStatusesForUser(userId: string): Promise<InterviewStatusRecord[]> {
    const profiles = await this.voiceProfileService.findAllByUser(userId);
    return Promise.all(
      profiles.map(async (profile) => {
        const redisStatus = await this.getRedisStatus(profile.id!);
        return redisStatus || this.inferStatusFromProfile(profile);
      }),
    );
  }

  private async getRedisStatus(
    voiceProfileId: string,
  ): Promise<InterviewStatusRecord | null> {
    if (!this.upstashService.isConfigured()) return null;
    return this.upstashService
      .getClient()
      .get<InterviewStatusRecord>(this.statusKey(voiceProfileId));
  }

  private async setStatus(status: InterviewStatusRecord) {
    const client = this.upstashService.getClient();
    const key = this.statusKey(status.voiceProfileId);
    await client.set(key, status);
    // Expire completed/failed statuses after 1 hour to keep Redis tidy.
    if (status.status === 'completed' || status.status === 'failed') {
      try {
        await client.expire(key, 60 * 60); // 1 hour
      } catch (err) {
        this.logger.warn(`Failed to set TTL on status key ${key}: ${err}`);
      }
    }
  }

  private inferStatusFromProfile(profile: any): InterviewStatusRecord {
    // ministryDNA is the canonical readiness field since the add_extracted_voice_fields
    // migration. Fall back to theologicalFramework for profiles created before the migration.
    const hasMinistryData =
      Boolean(profile.ministryDNA) || Boolean(profile.theologicalFramework);

    const isReady =
      Array.isArray(profile.signaturePhrases) &&
      profile.signaturePhrases.length > 0 &&
      Array.isArray(profile.anchorScriptures) &&
      profile.anchorScriptures.length > 0 &&
      hasMinistryData;

    return {
      voiceProfileId: profile.id,
      userId: profile.userId,
      status: isReady ? 'completed' : 'queued',
      label: isReady ? 'Ready' : 'Creating',
      updatedAt: new Date(profile.updatedAt || profile.createdAt).toISOString(),
    };
  }

  private jobKey(jobId: string) {
    return `scribe:interview-processing:job:${jobId}`;
  }

  private statusKey(voiceProfileId: string) {
    return `scribe:voice-profile:${voiceProfileId}:status`;
  }

  private lockKey(jobId: string) {
    return `scribe:interview-processing:lock:${jobId}`;
  }
}
