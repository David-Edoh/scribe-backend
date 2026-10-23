import { ManuscriptOutline } from '../../outlines/services/outline-generation.types';

export interface GenerateChapterRequest {
  voiceProfileId: string;
  chapterTitle: string;
  outlineSection: string;
  voiceStyleKey?: string;
  additionalContext?: string;
  retrievalQuery?: string;
  customGuardrails?: {
    doctrinalPrinciples?: string[];
    prohibitions?: string[];
  };
  performSelfCritique?: boolean;
}

export interface GenerateManuscriptChapterRequest {
  voiceProfileId: string;
  chapterTitle: string;
  chapterDescription: string;
  voiceStyleKey?: string;
  additionalContext?: string;
}

export interface ContinueChapterRequest {
  voiceProfileId: string;
  currentContent?: string;
  additionalContext?: string;
}

export interface GenerateOutlineRequest {
  voiceProfileId: string;
  title: string;
  more_info: string;
  voiceStyleKey?: string;
}

export interface GenerateOutlineResponse {
  success: boolean;
  outline: ManuscriptOutline;
}

export interface GenerateOutlineStreamRequest extends GenerateOutlineRequest {
  userId?: string;
}

export interface GenerateChapterResponse {
  success: boolean;
  draft: {
    content: string;
    chapterTitle: string;
    voiceProfileId: string;
    generatedAt: string;
  };
  metadata: any;
  critique?: any;
}

export interface OutlineStreamResult {
  outline: ManuscriptOutline;
  manuscriptId: string;
  voiceProfileId: string;
}

export function getOutlineStreamRequestKey(
  userId: string,
  dto: GenerateOutlineStreamRequest,
): string {
  const title = dto.title.trim().toLowerCase();
  const moreInfo = dto.more_info.trim().toLowerCase();
  const voiceStyleKey = dto.voiceStyleKey?.trim().toLowerCase() || '';

  return [userId, dto.voiceProfileId, title, moreInfo, voiceStyleKey].join(':');
}
