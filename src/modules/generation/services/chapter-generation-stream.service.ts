import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import {
  prepareSseResponse,
  writeSseComment,
  writeSseEvent,
} from '../../../common/utils/sse.util';
import { ManuscriptService } from '../../manuscripts/services/manuscript.service';
import { UpstashService } from '../../../common/services/upstash.service';

export type ChapterGenerationEvent =
  | {
      type: 'chapter-started';
      manuscriptId: string;
      chapterId: string;
      chapterTitle: string;
    }
  | {
      type: 'chapter-delta';
      manuscriptId: string;
      chapterId: string;
      content: string;
      fullContent: string;
    }
  | {
      type: 'chapter-updated';
      manuscriptId: string;
      chapterId: string;
      content: string;
      status: string;
    }
  | {
      type: 'chapter-completed';
      manuscriptId: string;
      chapterId: string;
      content: string;
    }
  | {
      type: 'chapter-retry';
      manuscriptId: string;
      chapterId: string;
      retryCount: number;
      maxRetries: number;
    }
  | {
      type: 'chapter-failed';
      manuscriptId: string;
      chapterId: string;
      error: string;
    };

@Injectable()
export class ChapterGenerationStreamService {
  private readonly logger = new Logger(ChapterGenerationStreamService.name);

  /** In-process map of manuscriptId → set of active SSE Response objects on this instance. */
  private readonly clients = new Map<string, Set<Response>>();

  /**
   * Per-manuscript bridge cursor: tracks how many entries in the Redis event
   * list this instance has already processed (via local publish or bridge poll).
   *
   * Initialised to the current Redis list length when the first client subscribes,
   * so past events are never replayed to a newly-connecting client.
   * Incremented optimistically on every local publish() call so the bridge
   * does not re-deliver events that were already sent via the fast path.
   */
  private readonly bridgeCursors = new Map<string, number>();

  constructor(
    private readonly manuscriptService: ManuscriptService,
    private readonly upstashService: UpstashService,
  ) {}

  async subscribe(manuscriptId: string, userId: string, res: Response): Promise<void> {
    const manuscript = await this.manuscriptService.getManuscript(
      manuscriptId,
      userId,
    );
    if (!manuscript) throw new NotFoundException('Manuscript not found');

    prepareSseResponse(res);
    writeSseComment(res, 'chapter-generation-stream-open');

    // Initialise the bridge cursor the first time any client subscribes for this
    // manuscript on this instance.  Set it to the current Redis list length so
    // that events published before this client connected are never replayed.
    if (!this.bridgeCursors.has(manuscriptId) && this.upstashService.isConfigured()) {
      try {
        const len = await this.upstashService
          .getClient()
          .llen(this.eventListKey(manuscriptId));
        this.bridgeCursors.set(manuscriptId, len);
      } catch {
        this.bridgeCursors.set(manuscriptId, 0);
      }
    }

    const clients = this.clients.get(manuscriptId) ?? new Set<Response>();
    clients.add(res);
    this.clients.set(manuscriptId, clients);

    // Keepalive comment every 30 s prevents App Engine Flex's 60-second idle
    // timeout from closing the long-lived SSE connection.
    const keepaliveInterval = setInterval(() => {
      if (!res.destroyed) {
        writeSseComment(res, 'keepalive');
      }
    }, 30_000);

    res.on('close', () => {
      clearInterval(keepaliveInterval);
      clients.delete(res);
      if (clients.size === 0) {
        this.clients.delete(manuscriptId);
        this.bridgeCursors.delete(manuscriptId);
      }
    });
  }

  /**
   * Publish a chapter generation event.
   *
   * Two-phase delivery:
   *   1. Deliver synchronously to any SSE clients on THIS instance — zero-latency
   *      fast path, no Redis round-trip required.
   *   2. Write the event to a shared Redis list (fire-and-forget) so that
   *      SseEventBridgeService running on OTHER App Engine instances can poll
   *      and forward the event to clients connected there.
   *
   * The bridge cursor is incremented optimistically before the Redis write so
   * that the bridge's next poll skips this event and does not double-deliver it
   * to clients that already received it via step 1.
   */
  publish(event: ChapterGenerationEvent): void {
    // Advance cursor optimistically — prevents the bridge from re-delivering
    // events that this instance is about to send directly to local clients.
    const current = this.bridgeCursors.get(event.manuscriptId) ?? 0;
    this.bridgeCursors.set(event.manuscriptId, current + 1);

    // Step 1: deliver immediately to clients on this instance.
    this.deliverLocally(event);

    // Step 2: write to Redis so other instances can pick this up.
    // Fire-and-forget — we do NOT await so the streaming loop is never
    // stalled by a Redis REST round-trip (crucial for chapter-delta throughput).
    if (this.upstashService.isConfigured()) {
      const redis = this.upstashService.getClient();
      const key = this.eventListKey(event.manuscriptId);
      redis
        .rpush(key, JSON.stringify(event))
        .then(() => redis.expire(key, 60 * 30))
        .catch((err: unknown) =>
          this.logger.warn(
            `Redis SSE event write failed for manuscript ${event.manuscriptId}`,
            err,
          ),
        );
    }
  }

  /**
   * Deliver an event directly to local SSE clients without touching Redis.
   * Called by SseEventBridgeService for events that originated on other instances.
   */
  deliverLocally(event: ChapterGenerationEvent): void {
    const clients = this.clients.get(event.manuscriptId);
    if (!clients?.size) return;

    for (const client of clients) {
      if (client.destroyed) {
        clients.delete(client);
        continue;
      }
      writeSseEvent(client, { event: event.type, data: event });
    }
  }

  /** Returns the manuscript IDs that currently have active SSE clients on this instance. */
  getActiveManuscriptIds(): string[] {
    return [...this.clients.keys()];
  }

  /**
   * Returns how many Redis list entries this instance has already processed for
   * a given manuscript.  Used by SseEventBridgeService to know where to resume.
   */
  getBridgeCursor(manuscriptId: string): number {
    return this.bridgeCursors.get(manuscriptId) ?? 0;
  }

  /**
   * Advances the bridge cursor after the bridge has delivered a batch of events.
   * Only moves forward — never backwards.
   */
  setBridgeCursor(manuscriptId: string, value: number): void {
    if (value > (this.bridgeCursors.get(manuscriptId) ?? 0)) {
      this.bridgeCursors.set(manuscriptId, value);
    }
  }

  /** Shared Redis list key for the SSE event buffer for a manuscript. */
  eventListKey(manuscriptId: string): string {
    return `scribe:sse:events:${manuscriptId}`;
  }
}
