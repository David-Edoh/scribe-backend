import { Injectable } from '@nestjs/common';
import { ChatRepository } from '../repositories/chat.repository';
import { ScribeAgentService } from '../agents/scribe.agent';
import { VoiceProfileService } from '../../voice-profile/services/voice-profile.service';
import { CreateChatSessionDto } from '../dto/create-chat-session.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import { AgentStreamEvent } from '../types/agent.types';
import {
  filterAgentMetadata,
  formatConversationHistory,
  resolveVoiceProfile,
  updateSessionTitleIfEmpty,
} from './chat-service.helpers';

@Injectable()
export class ChatService {
  constructor(
    private readonly chatRepository: ChatRepository,
    private readonly scribeAgent: ScribeAgentService,
    private readonly voiceProfileService: VoiceProfileService,
  ) {}

  async createSession(userId: string, dto: CreateChatSessionDto) {
    return this.chatRepository.createSession(userId, dto);
  }

  async getSession(sessionId: string, userId: string) {
    return this.chatRepository.getSession(sessionId, userId);
  }

  async getUserSessions(userId: string) {
    return this.chatRepository.getUserSessions(userId);
  }

  async sendMessage(
    userId: string,
    dto: SendMessageDto,
    context?: Record<string, any>,
  ) {
    const session = await this.chatRepository.getSession(dto.sessionId, userId);
    if (!session) {
      throw new Error('Session not found');
    }

    const userMessage = await this.chatRepository.addMessage(
      dto.sessionId,
      'user',
      dto.content,
    );

    const conversationHistory = formatConversationHistory(session.messages || []);
    const { voiceProfileId, voiceProfile } = await resolveVoiceProfile(
      dto,
      context,
      this.voiceProfileService,
      true,
    );

    console.log('[CHAT-SERVICE] About to call processMessage with context:', {
      userId,
      voiceProfileId,
      voiceProfileName: voiceProfile?.name || 'null',
      contextKeys: Object.keys(context || {}),
    });

    const agentResponse = await this.scribeAgent.processMessage(
      userId,
      dto.content,
      conversationHistory,
      {
        ...context,
        voiceProfile,
        voiceProfileId,
      },
    );

    console.log(
      'Agent response metadata:',
      JSON.stringify(agentResponse.metadata, null, 2),
    );

    const filteredMetadata = filterAgentMetadata(agentResponse.metadata);
    const assistantMessage = await this.chatRepository.addMessage(
      dto.sessionId,
      'assistant',
      agentResponse.content,
      filteredMetadata,
    );

    await updateSessionTitleIfEmpty(
      session,
      dto.sessionId,
      userId,
      dto.content,
      this.chatRepository,
    );

    return {
      userMessage,
      assistantMessage,
    };
  }

  async *sendMessageStream(
    userId: string,
    dto: SendMessageDto,
    context?: Record<string, any>,
  ): AsyncGenerator<
    | { type: 'user-message'; userMessage: any }
    | { type: 'assistant-status'; message: string; toolName?: string }
    | { type: 'assistant-delta'; content: string }
    | { type: 'assistant-message'; assistantMessage: any }
  > {
    const session = await this.chatRepository.getSession(dto.sessionId, userId);
    if (!session) {
      throw new Error('Session not found');
    }

    const userMessage = await this.chatRepository.addMessage(
      dto.sessionId,
      'user',
      dto.content,
    );
    yield { type: 'user-message', userMessage };

    const conversationHistory = formatConversationHistory(session.messages || []);
    const { voiceProfileId, voiceProfile } = await resolveVoiceProfile(
      dto,
      context,
      this.voiceProfileService,
    );

    let finalResponse: AgentStreamEvent | null = null;

    for await (const event of this.scribeAgent.processMessageStream(
      userId,
      dto.content,
      conversationHistory,
      {
        ...context,
        voiceProfile,
        voiceProfileId,
      },
    )) {
      if (event.type === 'delta') {
        yield { type: 'assistant-delta', content: event.content };
      } else if (event.type === 'status') {
        yield {
          type: 'assistant-status',
          message: event.message,
          toolName: event.toolName,
        };
      } else {
        finalResponse = event;
      }
    }

    if (!finalResponse || finalResponse.type !== 'complete') {
      throw new Error('Agent stream ended without a completed response');
    }

    const filteredMetadata = filterAgentMetadata(
      finalResponse.response.metadata,
    );
    const assistantMessage = await this.chatRepository.addMessage(
      dto.sessionId,
      'assistant',
      finalResponse.response.content,
      filteredMetadata,
    );

    await updateSessionTitleIfEmpty(
      session,
      dto.sessionId,
      userId,
      dto.content,
      this.chatRepository,
    );

    yield { type: 'assistant-message', assistantMessage };
  }

  async updateSessionTitle(userId: string, sessionId: string, title: string) {
    return this.chatRepository.updateSessionTitle(sessionId, userId, title);
  }

  async archiveSession(userId: string, sessionId: string) {
    return this.chatRepository.archiveSession(sessionId, userId);
  }

  async deleteSession(userId: string, sessionId: string) {
    return this.chatRepository.deleteSession(sessionId, userId);
  }

  isAgentAvailable(): boolean {
    return this.scribeAgent.isAvailable();
  }
}
