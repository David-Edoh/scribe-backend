import './setup-ssl';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Prisma will use sslmode from DATABASE_URL if configured
    // The setup-ssl module will decode PG_CA_CERT for use in database drivers
    const databaseUrl = PrismaService.withConnectionLimit(
      process.env.DATABASE_URL,
    );
    super(
      databaseUrl
        ? {
            datasources: {
              db: {
                url: databaseUrl,
              },
            },
          }
        : undefined,
    );
  }

  async onModuleInit() {
    // Avoid connecting during tests to keep E2E fast and isolated
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.SKIP_DB_CONNECT === 'true'
    )
      return;
    await this.$connect();
  }

  async onModuleDestroy() {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.SKIP_DB_CONNECT === 'true'
    )
      return;
    await this.$disconnect();
  }

  private static withConnectionLimit(url: string | undefined) {
    if (!url) return undefined;

    try {
      const parsed = new URL(url);
      if (!parsed.searchParams.has('connection_limit')) {
        parsed.searchParams.set(
          'connection_limit',
          process.env.PRISMA_CONNECTION_LIMIT || '3',
        );
      }
      if (!parsed.searchParams.has('pool_timeout')) {
        parsed.searchParams.set('pool_timeout', '20');
      }
      return parsed.toString();
    } catch {
      return url;
    }
  }
}
