import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { GoogleAuthService } from '../../../common/services/google-auth.service';
import { FeedbackInterviewDto } from '../dto/feedback-interview.dto';

export interface AnswerFeedbackResult {
  score: number;        // 0-100 completeness score
  feedback: string[];   // exactly 3 feedback lines
}

/**
 * Service that calls Gemini to evaluate the completeness of a single interview answer
 * in real-time as the author types. Mirrors the authentication pattern used by
 * VoiceProfileExtractionAgent (Vertex AI via explicit service account credentials).
 */
@Injectable()
export class InterviewFeedbackService {
  private readonly logger = new Logger(InterviewFeedbackService.name);
  private genAI: GoogleGenAI | null = null;

  constructor(private readonly googleAuthService: GoogleAuthService) {
    const credentials = this.googleAuthService.getCredentials();

    if (!credentials) {
      this.logger.warn(
        'Service account credentials not found. ' +
          'InterviewFeedbackService will operate in fallback mode.',
      );
      return;
    }

    try {
      const projectId = this.googleAuthService.getProjectId();

      this.genAI = new GoogleGenAI({
        vertexai: true,
        project: projectId,
        location: 'us-central1',
        googleAuthOptions: {
          credentials,
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        },
      });

      this.logger.debug(
        'InterviewFeedbackService initialized with Vertex AI',
      );
    } catch (error) {
      this.logger.error('Failed to initialize Google Gen AI for feedback', error);
      this.genAI = null;
    }
  }

  /**
   * Evaluate a single interview answer for completeness and richness.
   * Returns a score (0-100) and exactly 3 short feedback lines.
   */
  async evaluateAnswer(dto: FeedbackInterviewDto): Promise<AnswerFeedbackResult> {
    if (!this.genAI) {
      return this.getFallbackFeedback(dto.answer);
    }

    const prompt = this.buildFeedbackPrompt(dto);

    try {
      const model = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';

      const response = await this.genAI.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 300,
        },
      } as any);

      const responseText = this.extractText(response);
      return this.parseResponse(responseText);
    } catch (error) {
      this.logger.error('Answer feedback evaluation failed', error);
      return this.getFallbackFeedback(dto.answer);
    }
  }

  private buildFeedbackPrompt(dto: FeedbackInterviewDto): string {
    const wordCount = dto.answer.trim().split(/\s+/).filter(Boolean).length;

    return `You are a writing coach helping a Christian minister craft a detailed voice profile.

QUESTION: "${dto.questionTitle}"

CURRENT ANSWER (${wordCount} words):
"${dto.answer}"

Evaluate how complete and rich this answer is for capturing this minister's unique voice and theological perspective for a writing profile. Consider: specificity, personal detail, theological depth, and actionability for an AI ghostwriter.

Respond ONLY with a JSON object in this exact format:
{
  "score": <integer 0-100>,
  "feedback": [
    "<line 1: one concise sentence about what is good or missing>",
    "<line 2: one concise sentence with a specific suggestion>",
    "<line 3: one concise encouraging sentence about next steps>"
  ]
}

Scoring guide:
- 0-20: Just started, very little to work with
- 21-40: Some content but needs much more depth and specificity
- 41-60: Decent foundation, missing key personal details
- 61-80: Good content with solid theological grounding
- 81-100: Rich, specific, and highly usable for voice profiling

Return ONLY valid JSON, nothing else.`;
  }

  private parseResponse(responseText: string): AnswerFeedbackResult {
    try {
      const startIdx = responseText.indexOf('{');
      const endIdx = responseText.lastIndexOf('}');
      if (startIdx === -1 || endIdx === -1) throw new Error('No JSON found');

      const jsonStr = responseText.substring(startIdx, endIdx + 1);
      const parsed = JSON.parse(jsonStr);

      const score = Math.min(100, Math.max(0, Number(parsed.score) || 0));
      const feedback: string[] = Array.isArray(parsed.feedback)
        ? parsed.feedback.slice(0, 3).map(String)
        : [];

      // Ensure exactly 3 lines
      while (feedback.length < 3) {
        feedback.push('Keep adding more detail to strengthen your voice profile.');
      }

      return { score, feedback };
    } catch (error) {
      this.logger.warn('Failed to parse feedback response', error);
      return this.getFallbackFeedback('');
    }
  }

  private getFallbackFeedback(answer: string): AnswerFeedbackResult {
    const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
    const score = Math.min(100, Math.round((wordCount / 150) * 100));

    return {
      score,
      feedback: [
        'Keep writing — more detail helps build a stronger voice profile.',
        'Include specific scripture references, phrases, or personal stories.',
        'The more you share, the better your AI ghostwriter can match your voice.',
      ],
    };
  }

  private extractText(response: any): string {
    try {
      const text = response.text;
      if (typeof text === 'string' && text.length > 0) return text;
      const candidates = response.candidates;
      if (Array.isArray(candidates) && candidates.length > 0) {
        const parts = candidates[0]?.content?.parts;
        if (Array.isArray(parts)) {
          return parts.map((p: any) => p.text || '').join('');
        }
      }
    } catch {
      // fall through
    }
    return '';
  }
}
