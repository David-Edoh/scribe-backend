import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UpstashService } from '../../../common/services/upstash.service';
import { ManuscriptService } from '../../manuscripts/services/manuscript.service';

export type ChapterGenerationStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

export interface ChapterGenerationJob {
  id: string;
  userId: string;
  manuscriptId: string;
  voiceProfileId: string;
  chapterId: string;
  chapterTitle: string;
  outlineSection: string;
  voiceStyleKey?: string;
  additionalContext?: string;
  expectedWordCount?: number;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
}

export interface ChapterGenerationStatusRecord {
  jobId: string;
  userId: string;
  manuscriptId: string;
  chapterId: string;
  chapterTitle: string;
  status: ChapterGenerationStatus;
  error?: string;
  progress?: number;
  retryCount?: number;
  maxRetries?: number;
  updatedAt: string;
}

@Injectable()
export class ChapterGenerationQueueService {
  private readonly logger = new Logger(ChapterGenerationQueueService.name);
  private readonly queueKey = 'scribe:chapter-generation:queue';
  private readonly activeJobsKey = 'scribe:chapter-generation:active-jobs';

  constructor(
    private readonly upstashService: UpstashService,
    private readonly manuscriptService: ManuscriptService,
  ) {}

  async enqueue(
    job: Omit<
      ChapterGenerationJob,
      'id' | 'createdAt' | 'retryCount' | 'maxRetries'
    >,
  ) {
    if (!this.upstashService.isConfigured()) {
      throw new Error('Redis is not configured for chapter generation.');
    }

    const manuscript = await this.manuscriptService.getManuscript(
      job.manuscriptId,
      job.userId,
    );
    if (!manuscript) throw new NotFoundException('Manuscript not found');
    if (manuscript.voiceProfileId !== job.voiceProfileId) {
      throw new ForbiddenException('Voice profile does not match manuscript');
    }

    const queuedJob: ChapterGenerationJob = {
      ...job,
      id: `${job.chapterId}:${Date.now()}`,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
    };

    const status: ChapterGenerationStatusRecord = {
      jobId: queuedJob.id,
      userId: job.userId,
      manuscriptId: job.manuscriptId,
      chapterId: job.chapterId,
      chapterTitle: job.chapterTitle,
      status: 'queued',
      retryCount: queuedJob.retryCount,
      maxRetries: queuedJob.maxRetries,
      updatedAt: new Date().toISOString(),
    };

    const redis = this.upstashService.getClient();
    await redis.set(this.jobKey(queuedJob.id), queuedJob);
    await redis.set(this.statusKey(job.chapterId), status);
    await redis.sadd(this.activeJobsKey, queuedJob.id);
    await redis.lpush(this.queueKey, queuedJob.id);

    this.logger.log(`Queued chapter generation job ${queuedJob.id}`);
    return status;
  }

  async claimNextJob(): Promise<ChapterGenerationJob | null> {
    if (!this.upstashService.isConfigured()) return null;

    const redis = this.upstashService.getClient();
    const jobId = await redis.rpop<string>(this.queueKey);
    if (!jobId) return null;

    const lockAcquired = await redis.set(this.lockKey(jobId), '1', {
      nx: true,
      ex: 60 * 30,
    });
    if (lockAcquired !== 'OK') return null;

    const job = await redis.get<ChapterGenerationJob>(this.jobKey(jobId));
    if (!job) {
      await redis.del(this.lockKey(jobId));
      return null;
    }

    await this.setStatus({
      jobId: job.id,
      userId: job.userId,
      manuscriptId: job.manuscriptId,
      chapterId: job.chapterId,
      chapterTitle: job.chapterTitle,
      status: 'processing',
      retryCount: job.retryCount,
      maxRetries: job.maxRetries,
      updatedAt: new Date().toISOString(),
    });

    return job;
  }

  async recoverInterruptedJobs() {
    if (!this.upstashService.isConfigured()) return;

    const redis = this.upstashService.getClient();
    const jobIds = await redis.smembers<string[]>(this.activeJobsKey);
    if (!jobIds?.length) return;

    for (const jobId of jobIds) {
      const job = await redis.get<ChapterGenerationJob>(this.jobKey(jobId));
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

  async markCompleted(job: ChapterGenerationJob) {
    const redis = this.upstashService.getClient();
    await this.setStatus({
      jobId: job.id,
      userId: job.userId,
      manuscriptId: job.manuscriptId,
      chapterId: job.chapterId,
      chapterTitle: job.chapterTitle,
      status: 'completed',
      retryCount: job.retryCount,
      maxRetries: job.maxRetries,
      updatedAt: new Date().toISOString(),
    });
    await redis.del(this.lockKey(job.id));
    await redis.del(this.jobKey(job.id));
    await redis.srem(this.activeJobsKey, job.id);
  }

  async updateProgress(job: ChapterGenerationJob, progress?: number) {
    await this.setStatus({
      jobId: job.id,
      userId: job.userId,
      manuscriptId: job.manuscriptId,
      chapterId: job.chapterId,
      chapterTitle: job.chapterTitle,
      status: 'processing',
      progress,
      retryCount: job.retryCount,
      maxRetries: job.maxRetries,
      updatedAt: new Date().toISOString(),
    });
  }

  async markFailed(job: ChapterGenerationJob, error: unknown) {
    const redis = this.upstashService.getClient();
    const retryCount = job.retryCount + 1;
    const errorMessage =
      error instanceof Error ? error.message : 'Chapter generation failed';

    if (retryCount <= job.maxRetries) {
      const retryJob: ChapterGenerationJob = {
        ...job,
        retryCount,
      };

      await redis.set(this.jobKey(job.id), retryJob);
      await this.setStatus({
        jobId: job.id,
        userId: job.userId,
        manuscriptId: job.manuscriptId,
        chapterId: job.chapterId,
        chapterTitle: job.chapterTitle,
        status: 'queued',
        error: errorMessage,
        retryCount,
        maxRetries: job.maxRetries,
        updatedAt: new Date().toISOString(),
      });
      await redis.del(this.lockKey(job.id));
      // rpush places the retry at the tail (same side rpop reads from), so it
      // is processed next rather than behind all newly-enqueued chapters.
      await redis.rpush(this.queueKey, job.id);
      this.logger.warn(
        `Retrying chapter generation job ${job.id} (${retryCount}/${job.maxRetries})`,
      );
      return { retrying: true, retryCount, maxRetries: job.maxRetries };
    }

    await this.setStatus({
      jobId: job.id,
      userId: job.userId,
      manuscriptId: job.manuscriptId,
      chapterId: job.chapterId,
      chapterTitle: job.chapterTitle,
      status: 'failed',
      error: errorMessage,
      retryCount,
      maxRetries: job.maxRetries,
      updatedAt: new Date().toISOString(),
    });
    await redis.del(this.lockKey(job.id));
    await redis.del(this.jobKey(job.id));
    await redis.srem(this.activeJobsKey, job.id);
    return { retrying: false, retryCount, maxRetries: job.maxRetries };
  }

  async getStatusesForManuscript(manuscriptId: string, userId: string) {
    const manuscript = await this.manuscriptService.getManuscript(
      manuscriptId,
      userId,
    );
    if (!manuscript) throw new NotFoundException('Manuscript not found');

    if (!this.upstashService.isConfigured()) return [];

    const statuses = await Promise.all(
      (manuscript.chapters || []).map((chapter: any) =>
        this.upstashService
          .getClient()
          .get<ChapterGenerationStatusRecord>(this.statusKey(chapter.id)),
      ),
    );

    return statuses.filter(Boolean);
  }

  private async setStatus(status: ChapterGenerationStatusRecord) {
    const client = this.upstashService.getClient();
    const key = this.statusKey(status.chapterId);
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

  private jobKey(jobId: string) {
    return `scribe:chapter-generation:job:${jobId}`;
  }

  private statusKey(chapterId: string) {
    return `scribe:chapter:${chapterId}:generation-status`;
  }

  private lockKey(jobId: string) {
    return `scribe:chapter-generation:lock:${jobId}`;
  }
}
