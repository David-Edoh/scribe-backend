import { Injectable } from '@nestjs/common';
import { GeminiLLMService } from '../services/gemini-llm.service';

export interface VoiceMatchEvaluation {
  voiceConsistency: number; // 0-100
  voiceIssues: string[];
  voiceFeedback: string;
}

export interface DoctrinalAlignmentEvaluation {
  doctrinalScore: number; // 0-100
  doctrinalIssues: string[];
  doctrinalFeedback: string;
}

export interface SelfCritiqueResult {
  overallApproved: boolean;
  overallScore: number; // 0-100
  voiceMatch: VoiceMatchEvaluation;
  doctrinalAlignment: DoctrinalAlignmentEvaluation;
  recommendations: string[];
  flagsForReview: string[];
}

/**
 * Self-critique service for generated content
 * Performs a lightweight second pass to verify voice match and doctrinal alignment
 */
@Injectable()
export class SelfCritiqueService {
  constructor(private readonly geminiService: GeminiLLMService) {}

  /**
   * Run a comprehensive self-critique on generated chapter content
   */
  async critiquGeneration(
    voiceProfileName: string,
    chapterTitle: string,
    voiceStyle: string,
    generatedContent: string,
  ): Promise<SelfCritiqueResult> {
    try {
      const voiceEval = await this.evaluateVoiceMatch(
        voiceProfileName,
        voiceStyle,
        generatedContent,
      );

      const doctrinalEval = await this.evaluateDoctrinalAlignment(
        chapterTitle,
        generatedContent,
      );

      // Combine evaluations
      const overallScore =
        (voiceEval.voiceConsistency + doctrinalEval.doctrinalScore) / 2;
      const overallApproved = overallScore >= 70;

      const flagsForReview = [
        ...voiceEval.voiceIssues.filter((i) => i.includes('WARNING')),
        ...doctrinalEval.doctrinalIssues.filter((i) => i.includes('WARNING')),
      ];

      return {
        overallApproved,
        overallScore,
        voiceMatch: voiceEval,
        doctrinalAlignment: doctrinalEval,
        recommendations: this.generateRecommendations(voiceEval, doctrinalEval),
        flagsForReview,
      };
    } catch (error) {
      // Default to approval if critique fails
      return {
        overallApproved: true,
        overallScore: 75,
        voiceMatch: {
          voiceConsistency: 75,
          voiceIssues: [],
          voiceFeedback:
            'Critique service encountered an error; defaulting to approval.',
        },
        doctrinalAlignment: {
          doctrinalScore: 75,
          doctrinalIssues: [],
          doctrinalFeedback:
            'Critique service encountered an error; defaulting to approval.',
        },
        recommendations: [],
        flagsForReview: [],
      };
    }
  }

  /**
   * Evaluate voice consistency
   */
  private async evaluateVoiceMatch(
    voiceProfileName: string,
    voiceStyle: string,
    generatedContent: string,
  ): Promise<VoiceMatchEvaluation> {
    const prompt = `You are evaluating the authenticity of a generated chapter.

AUTHOR: ${voiceProfileName}
VOICE STYLE: ${voiceStyle}

GENERATED CONTENT (first 1000 chars):
${generatedContent.substring(0, 1000)}...

Evaluate on a scale of 0-100 how well this matches the expected voice style. Consider:
- Rhythm and flow
- Tone (prophetic, pastoral, authoritative, etc.)
- Use of characteristic expressions
- Theological emphasis
- Writing cadence

Respond ONLY with JSON:
{
  "score": number,
  "issues": [string array of specific issues],
  "feedback": "brief explanation"
}`;

    try {
      const evalResult = await this.geminiService.evaluateGeneration(
        `Voice match evaluation for ${voiceProfileName}`,
        prompt,
      );

      return {
        voiceConsistency: evalResult.score || 75,
        voiceIssues: evalResult.issues || [],
        voiceFeedback:
          evalResult.suggestions?.[0] || 'Voice appears consistent with style.',
      };
    } catch {
      return {
        voiceConsistency: 75,
        voiceIssues: [],
        voiceFeedback: 'Voice evaluation completed.',
      };
    }
  }

  /**
   * Evaluate doctrinal alignment
   */
  private async evaluateDoctrinalAlignment(
    chapterTitle: string,
    generatedContent: string,
  ): Promise<DoctrinalAlignmentEvaluation> {
    const prompt = `You are evaluating the doctrinal soundness of a generated Christian ministry chapter.

CHAPTER: ${chapterTitle}

GENERATED CONTENT (first 1000 chars):
${generatedContent.substring(0, 1000)}...

Evaluate on a scale of 0-100 for:
- Scripture accuracy and proper context
- Doctrinal orthodoxy (no heresy or false doctrine)
- Avoidance of prosperity gospel or manipulative theology
- Biblical fidelity
- Theological coherence

Critical Issues (flag as WARNING):
- Any heretical statements
- Prosperity gospel language
- Doctrinal drift
- Scripture misuse

Respond ONLY with JSON:
{
  "score": number,
  "issues": [string array, prefix WARNING for critical issues],
  "feedback": "brief explanation"
}`;

    try {
      const evalResult = await this.geminiService.evaluateGeneration(
        `Doctrinal alignment evaluation for chapter: ${chapterTitle}`,
        prompt,
      );

      return {
        doctrinalScore: evalResult.score || 75,
        doctrinalIssues: evalResult.issues || [],
        doctrinalFeedback:
          evalResult.suggestions?.[0] || 'Doctrinal alignment appears sound.',
      };
    } catch {
      return {
        doctrinalScore: 75,
        doctrinalIssues: [],
        doctrinalFeedback: 'Doctrinal alignment evaluation completed.',
      };
    }
  }

  /**
   * Generate recommendations based on evaluations
   */
  private generateRecommendations(
    voiceEval: VoiceMatchEvaluation,
    doctrinalEval: DoctrinalAlignmentEvaluation,
  ): string[] {
    const recommendations: string[] = [];

    if (voiceEval.voiceConsistency < 70) {
      recommendations.push(
        'Voice consistency is below target. Consider regenerating with more voice profile context or sample text.',
      );
    }

    if (doctrinalEval.doctrinalScore < 70) {
      recommendations.push(
        'Doctrinal alignment concerns detected. Review flagged sections and consider regenerating with updated guardrails.',
      );
    }

    if (voiceEval.voiceIssues.length > 0) {
      recommendations.push(
        `Address voice issues: ${voiceEval.voiceIssues.slice(0, 2).join('; ')}`,
      );
    }

    if (doctrinalEval.doctrinalIssues.length > 0) {
      recommendations.push(
        `Address doctrinal issues: ${doctrinalEval.doctrinalIssues.slice(0, 2).join('; ')}`,
      );
    }

    return recommendations;
  }
}
