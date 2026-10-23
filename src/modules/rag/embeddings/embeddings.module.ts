import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';
import { VoiceProfileRepository } from '../../voice-profile/voice-profile.repository';
import { CommonModule } from '../../../common/common.module';

@Module({
  imports: [CommonModule],
  providers: [EmbeddingsService, VoiceProfileRepository],
  exports: [EmbeddingsService, VoiceProfileRepository],
})
export class EmbeddingsModule {}
