import { Module } from '@nestjs/common';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { RetrieverModule } from './retrievers/retriever.module';
import { RAGService } from './services/rag.service';
import { RAGController } from './controllers/rag.controller';
import { VoiceProfileRepository } from '../voice-profile/voice-profile.repository';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule, EmbeddingsModule, RetrieverModule],
  controllers: [RAGController],
  providers: [
    RAGService,
    VoiceProfileRepository,
  ],
  exports: [EmbeddingsModule, RetrieverModule, RAGService],
})
export class RagModule {}
