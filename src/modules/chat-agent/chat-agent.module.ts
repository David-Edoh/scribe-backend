import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { ChatController } from './controllers/chat.controller';
import { ChatService } from './services/chat.service';
import { ChatRepository } from './repositories/chat.repository';
import { ScribeAgentService } from './agents/scribe.agent';
import { ManuscriptModule } from '../manuscripts/manuscript.module';
import { VoiceProfileModule } from '../voice-profile/voice-profile.module';
import { RagModule } from '../rag/rag.module';
import { GenerationModule } from '../generation/generation.module';
import { OutlineModule } from '../outlines/outline.module';

@Module({
  imports: [
    CommonModule,
    ManuscriptModule,
    VoiceProfileModule,
    RagModule,
    GenerationModule,
    OutlineModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatRepository, ScribeAgentService],
  exports: [ChatService, ScribeAgentService],
})
export class ChatAgentModule {}
