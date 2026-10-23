import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './modules/health/health.module';
import { VoiceProfileModule } from './modules/voice-profile/voice-profile.module';
import { InterviewModule } from './modules/interview/interview.module';
import { GenerationModule } from './modules/generation/generation.module';
import { ManuscriptModule } from './modules/manuscripts/manuscript.module';
import { ChapterModule } from './modules/chapters/chapter.module';
import { OutlineModule } from './modules/outlines/outline.module';
import { EmbeddingsModule } from './modules/rag/embeddings/embeddings.module';
import { RetrieverModule } from './modules/rag/retrievers/retriever.module';
import { ChatAgentModule } from './modules/chat-agent/chat-agent.module';
import { BooksModule } from './modules/books/books.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    AuthModule,
    UsersModule,
    HealthModule,
    VoiceProfileModule,
    InterviewModule,
    GenerationModule,
    ManuscriptModule,
    ChapterModule,
    OutlineModule,
    EmbeddingsModule,
    RetrieverModule,
    ChatAgentModule,
    BooksModule,
  ],
})
export class AppModule {}
