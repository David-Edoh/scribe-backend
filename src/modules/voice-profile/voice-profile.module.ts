import { Module } from '@nestjs/common';
import { VoiceProfileService } from './services/voice-profile.service';
import { VoiceProfileController } from './controllers/voice-profile.controller';
import { VoiceProfileRepository } from './voice-profile.repository';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [VoiceProfileController],
  providers: [VoiceProfileService, VoiceProfileRepository],
  exports: [VoiceProfileService, VoiceProfileRepository],
})
export class VoiceProfileModule {}
