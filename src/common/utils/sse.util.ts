import type { Response } from 'express';

export interface SseEvent<T = unknown> {
  event: string;
  data: T;
  id?: string;
}

export function prepareSseResponse(res: Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}

export function writeSseEvent<T>(res: Response, event: SseEvent<T>): void {
  if (event.id) {
    res.write(`id: ${event.id}\n`);
  }

  res.write(`event: ${event.event}\n`);
  res.write(`data: ${JSON.stringify(event.data)}\n\n`);
  (res as Response & { flush?: () => void }).flush?.();
}

export function writeSseComment(res: Response, comment: string): void {
  res.write(`: ${comment}\n\n`);
}
