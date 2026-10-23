import { Module } from '@nestjs/common';
import { RetrieverService } from '../retrievers/retriever.service';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { CommonModule } from '../../../common/common.module';

@Module({
  imports: [CommonModule, EmbeddingsModule],
  providers: [RetrieverService],
  exports: [RetrieverService],
})
export class RetrieverModule {}
