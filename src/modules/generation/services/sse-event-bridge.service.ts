import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { UpstashService } from '../../../common/services/upstash.service';
import {
  ChapterGenerationEvent,
  ChapterGenerationStreamService,
} from './chapter-generation-stream.service';

/**
 * Polls Redis every 200 ms for new chapter-generation SSE events and forwards
 * them to locally-connected SSE clients.
 *
 * On a multi-instance App Engine deployment the load balancer may route the
 * browser SSE subscription to Instance A while routing the chapter generation
 * trigger to Instance B whose worker publishes events into a shared Redis list.
 * This service runs on every instance and polls that list, forwarding new
 * entries to whichever SSE clients that instance currently holds.
 *
 * Deduplication: ChapterGenerationStreamService.publish() advances the bridge
 * cursor optimistically before the Redis write, so events published by THIS
 * instance are pre-counted and the bridge skips them on the next poll.
 *
 * Graceful degradation: if Redis is not configured the bridge does not start
 * and single-instance delivery via the fast path in publish() still works.
 */
@Injectable()
export class SseEventBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SseEventBridgeService.name);
  private timer?: NodeJS.Timeout;
  private isPolling = false;

  constructor(
    private readonly streamService: ChapterGenerationStreamService,
    private readonly upstashService: UpstashService,
  ) {}

  onModuleInit(): void {
    if (!this.upstashService.isConfigured()) {
      this.logger.warn(
        'Redis not configured — SSE event bridge is disabled. ' +
          'Chapter streaming will only work reliably on single-instance deployments.',
      );
      return;
    }
    this.timer = setInterval(() => void this.poll(), 200);
    this.logger.log('SSE event bridge started (200 ms poll interval).');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const manuscriptIds = this.streamService.getActiveManuscriptIds();
      if (!manuscriptIds.length) return;

      const redis = this.upstashService.getClient();

      for (const manuscriptId of manuscriptIds) {
        try {
          const key = this.streamService.eventListKey(manuscriptId);
          const cursor = this.streamService.getBridgeCursor(manuscriptId);
          const totalLen = await redis.llen(key);

          if (totalLen <= cursor) continue;

          const rawEvents = await redis.lrange<string>(key, cursor, totalLen - 1);

          for (const raw of rawEvents) {
            try {
              const event = (
                typeof raw === 'string' ? JSON.parse(raw) : raw
              ) as ChapterGenerationEvent;
              this.streamService.deliverLocally(event);
            } catch (parseErr) {
              this.logger.warn(
                `Failed to parse SSE bridge event for manuscript ${manuscriptId}`,
                parseErr,
              );
            }
          }

          this.streamService.setBridgeCursor(manuscriptId, totalLen);
        } catch (err) {
          this.logger.warn(
            `SSE bridge poll failed for manuscript ${manuscriptId}`,
            err,
          );
        }
      }
    } finally {
      this.isPolling = false;
    }
  }
}
