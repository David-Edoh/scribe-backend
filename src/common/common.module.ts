import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoogleAuthService } from './services/google-auth.service';
import { StorageService } from './services/storage.service';
import { UpstashService } from './services/upstash.service';
import { PrismaService } from '../prisma.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [GoogleAuthService, StorageService, UpstashService, PrismaService],
  exports: [GoogleAuthService, StorageService, UpstashService, PrismaService],
})
export class CommonModule {}
