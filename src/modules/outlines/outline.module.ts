import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { ManuscriptModule } from '../manuscripts/manuscript.module';
import { GenerationModule } from '../generation/generation.module';
import { RagModule } from '../rag/rag.module';
import { OutlineGenerationController } from './controllers/outline-generation.controller';
import { OutlineGenerationService } from './services/outline-generation.service';

@Module({
  imports: [CommonModule, ManuscriptModule, GenerationModule, RagModule],
  controllers: [OutlineGenerationController],
  providers: [OutlineGenerationService],
  exports: [OutlineGenerationService],
})
export class OutlineModule {}
