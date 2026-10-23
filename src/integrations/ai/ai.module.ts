import { Module } from '@nestjs/common';
import { LangchainService } from '../langchain/langchain.service';
import { LangraphService } from '../langraph/langraph.service';
import { LlamaIndexService } from '../llamaindex/llamaindex.service';

@Module({
  providers: [LangchainService, LangraphService, LlamaIndexService],
  exports: [LangchainService, LangraphService, LlamaIndexService],
})
export class AiModule {}
