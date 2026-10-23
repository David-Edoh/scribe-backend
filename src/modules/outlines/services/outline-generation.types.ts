export interface GenerateOutlineRequest {
  userId: string;
  voiceProfileId: string;
  title: string;
  moreInfo: string;
  voiceStyleKey?: string;
}

export interface ManuscriptOutline {
  title: string;
  description: string;
  chapters: OutlineChapter[];
  overview: string;
  themes: string[];
  estimatedWordCount?: number;
}

export interface OutlineChapter {
  number: number;
  title: string;
  objectives: string[];
  keyPoints: string[];
  estimatedWordCount?: number;
}
