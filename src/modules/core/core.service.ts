import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CoreService {
  private readonly logger = new Logger(CoreService.name);

  health() {
    this.logger.debug('core health check');
    return { ok: true, timestamp: new Date().toISOString() };
  }
}
