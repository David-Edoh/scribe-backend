import { ChatRepository } from '../repositories/chat.repository';
import { SendMessageDto } from '../dto/send-message.dto';
import { VoiceProfileService } from '../../voice-profile/services/voice-profile.service';

export interface ConversationLine {
  role: string;
  content: string;
}

export interface VoiceProfileContext {
  voiceProfileId?: string;
  voiceProfile: any;
}

export function formatConversationHistory(
  messages: Array<{ role: string; content: string }>,
): ConversationLine[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

export async function resolveVoiceProfile(
  dto: SendMessageDto,
  context: Record<string, any> | undefined,
  voiceProfileService: VoiceProfileService,
  logMissingId = false,
): Promise<VoiceProfileContext> {
  const voiceProfileId = dto.voiceProfileId || context?.voiceProfileId;

  if (!voiceProfileId) {
    if (logMissingId) {
      console.log('[CHAT-SERVICE] No voiceProfileId provided. DTO:', dto);
    }
    return { voiceProfileId: undefined, voiceProfile: null };
  }

  console.log('[CHAT-SERVICE] Fetching voice profile with ID:', voiceProfileId);

  try {
    const voiceProfile = await voiceProfileService.findById(voiceProfileId);
    console.log(
      '[CHAT-SERVICE] Successfully fetched voice profile:',
      voiceProfile?.id,
      voiceProfile?.name,
    );
    return { voiceProfileId, voiceProfile };
  } catch (error) {
    console.warn(
      '[CHAT-SERVICE] Failed to fetch voice profile:',
      voiceProfileId,
      error,
    );
    return { voiceProfileId, voiceProfile: null };
  }
}

export function filterAgentMetadata(metadata: any): any {
  if (!metadata) return {};

  const filtered: any = {
    model: metadata.model,
    timestamp: metadata.timestamp,
  };

  if (metadata.manuscriptData) filtered.manuscriptData = metadata.manuscriptData;
  if (metadata.profileData) filtered.profileData = metadata.profileData;
  if (metadata.manuscriptDetailData)
    filtered.manuscriptDetailData = metadata.manuscriptDetailData;
  if (metadata.generatedOutlineData)
    filtered.generatedOutlineData = metadata.generatedOutlineData;
  if (metadata.userKnowledgeSearched !== undefined)
    filtered.userKnowledgeSearched = metadata.userKnowledgeSearched;
  if (metadata.frontendActions)
    filtered.frontendActions = metadata.frontendActions;

  delete filtered.toolCalls;
  return filtered;
}

export async function updateSessionTitleIfEmpty(
  session: any,
  sessionId: string,
  userId: string,
  userMessage: string,
  chatRepository: ChatRepository,
): Promise<void> {
  if (!session.title && session.messages.length === 0) {
    const title = userMessage.substring(0, 50).trim();
    await chatRepository.updateSessionTitle(sessionId, userId, title);
  }
}
