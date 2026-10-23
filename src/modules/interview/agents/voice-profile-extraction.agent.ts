import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { GoogleAuthService } from '../../../common/services/google-auth.service';
import { ProcessInterviewDto } from '../dto/process-interview.dto';

export interface ExtractedVoiceData {
  signaturePhrases: string[];
  voiceThemes: string[];
  toneMarkers: string[];
  writingStyle: {
    tone: string;
    rhythm: string;
    emphasis: string[];
  };
  keyMessages: string[];
  recurringMotifs: string[];
  ministryDNA: string;
}

/**
 * Voice Profile Extraction Agent using @google/genai with Vertex AI.
 * Authenticates via explicit GoogleAuth credentials object — no ADC, no temp files.
 * This mirrors GeminiLLMService and works correctly on Google App Engine.
 */
@Injectable()
export class VoiceProfileExtractionAgent {
  private readonly logger = new Logger(VoiceProfileExtractionAgent.name);
  private genAI: GoogleGenAI | null = null;

  constructor(private readonly googleAuthService: GoogleAuthService) {
    const credentials = this.googleAuthService.getCredentials();

    if (!credentials) {
      this.logger.warn(
        'Service account credentials not found. ' +
          'VoiceProfileExtractionAgent will not be initialized.',
      );
      return;
    }

    try {
      const projectId = this.googleAuthService.getProjectId();

      // Use googleAuthOptions to pass credentials directly to the SDK's internal
      // NodeAuth — no ADC, no temp files, works correctly on GAE.
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
        'VoiceProfileExtractionAgent initialized with Vertex AI (explicit service account)',
      );
    } catch (error) {
      this.logger.error('Failed to initialize Google Gen AI', error);
      this.genAI = null;
    }
  }

  /**
   * Extract voice profile data from interview answers using Gemini
   */
  async extractVoiceProfile(
    interviewAnswers: ProcessInterviewDto,
  ): Promise<ExtractedVoiceData> {
    if (!this.genAI) {
      this.logger.warn(
        'Voice profile extraction not available. Service account credentials are not configured. ' +
          'Returning empty profile data.',
      );
      return this.getEmptyProfile();
    }

    this.logger.debug('Starting voice profile extraction with Vertex AI');

    const extractionPrompt = this.buildExtractionPrompt(interviewAnswers);

    try {
      const model = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';

      const response = await this.genAI.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4000,
        },
      } as any);

      const responseText = this.extractText(response);
      return this.parseExtractionResponse(responseText);
    } catch (error) {
      this.logger.error('Voice profile extraction failed', error);
      throw new Error('Failed to extract voice profile from interview answers');
    }
  }

  /**
   * Extract plain text from a Gemini GenerateContentResponse.
   * .text is a getter property on the response object, not a method.
   */
  private extractText(response: any): string {
    try {
      const text = response.text;
      if (typeof text === 'string' && text.length > 0) return text;
      // Fallback: manual candidate parsing
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

  private getEmptyProfile(): ExtractedVoiceData {
    return {
      signaturePhrases: [],
      voiceThemes: [],
      toneMarkers: [],
      writingStyle: {
        tone: 'Not configured',
        rhythm: 'Not configured',
        emphasis: [],
      },
      keyMessages: [],
      recurringMotifs: [],
      ministryDNA:
        'Profile extraction not configured. Please ensure service account credentials are set.',
    };
  }

  private buildExtractionPrompt(answers: ProcessInterviewDto): string {
    return `You are an expert analyst specialized in capturing Christian ministry voices and writing styles.

Analyze the following interview responses and extract comprehensive voice profile data in JSON format. Be precise, specific, and capture the unique theological voice and writing DNA.

INTERVIEW RESPONSES:
1. Ministry Calling & Theological Foundation:
${answers.ministryCalling}

2. Signature Scriptures & Personal Interpretation:
${answers.signatureScriptures}

3. Signature Phrases, Cadence & Voice Markers:
${answers.signaturePhrases}

4. Personal Stories & Testimonies:
${answers.personalStories}

5. Audience & Desired Impact:
${answers.audience}

${answers.additionalContext ? `Additional Context:\n${answers.additionalContext}` : ''}

EXTRACTION TASK:
Extract and return a JSON object with the following structure. Be specific, citing exact phrases and patterns from the responses:

{
  "signaturePhrases": ["phrase1", "phrase2", "phrase3", "phrase4", "phrase5"],
  "voiceThemes": ["theme1", "theme2", "theme3", "theme4", "theme5"],
  "toneMarkers": ["marker1", "marker2", "marker3", "marker4"],
  "writingStyle": {
    "tone": "clear one-line description of overall tone",
    "rhythm": "description of sentence rhythm and flow",
    "emphasis": ["emphatic element1", "emphatic element2"]
  },
  "keyMessages": ["message1", "message2", "message3"],
  "recurringMotifs": ["motif1", "motif2", "motif3"],
  "ministryDNA": "comprehensive 2-3 sentence summary of this author's unique spiritual DNA and voice"
}

Guidelines:
- Signature phrases: Extract 4-6 exact repeated patterns, declarations, or expressions (most impactful first)
- Voice themes: Identify 5-7 core theme emphases (topics and subjects) 
- Tone markers: Capture 3-5 emotional/spiritual tone descriptors
- Writing style: Analyze rhythm, sentence structure, and emphasis patterns
- Key messages: 2-3 core transformation messages the author wants readers to experience
- Recurring motifs: 2-4 patterns in metaphors, biblical references, or story types
- Ministry DNA: A unique summary that captures their "anointing" and calling

Return ONLY valid JSON, no other text.`;
  }

  private parseExtractionResponse(responseText: string): ExtractedVoiceData {
    try {
      // Log the response for debugging
      this.logger.debug(
        'Extraction response received, length: ' + responseText.length,
      );

      let jsonStr: string | null = null;

      // Try multiple extraction strategies
      // 1. Try to find JSON starting with { and ending with }
      const jsonMatch = responseText.match(/\{[\s\S]*?\}\s*$/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      } else {
        // 2. Try to find any balanced JSON object
        const startIdx = responseText.indexOf('{');
        if (startIdx === -1) {
          throw new Error('No JSON object found in response');
        }

        // Find the matching closing brace by counting braces
        let braceCount = 0;
        let endIdx = -1;
        for (let i = startIdx; i < responseText.length; i++) {
          if (responseText[i] === '{') braceCount++;
          else if (responseText[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              endIdx = i;
              break;
            }
          }
        }

        if (endIdx === -1) {
          throw new Error(
            'Could not find matching closing brace for JSON object',
          );
        }

        jsonStr = responseText.substring(startIdx, endIdx + 1);
      }

      if (!jsonStr) {
        this.logger.error(
          'No JSON found in extraction response',
          responseText.substring(0, 500),
        );
        throw new Error('Invalid extraction response format');
      }

      // Clean up potential formatting issues
      jsonStr = jsonStr.trim();

      // Attempt to fix incomplete JSON by adding closing braces/brackets if needed
      let braceCount = 0;
      let bracketCount = 0;
      for (const char of jsonStr) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
      }

      // Add closing braces if unbalanced
      while (braceCount > 0) {
        jsonStr += '}';
        braceCount--;
      }

      // Add closing brackets if unbalanced
      while (bracketCount > 0) {
        jsonStr += ']';
        bracketCount--;
      }

      const parsed = JSON.parse(jsonStr);

      return {
        signaturePhrases: parsed.signaturePhrases || [],
        voiceThemes: parsed.voiceThemes || [],
        toneMarkers: parsed.toneMarkers || [],
        writingStyle: parsed.writingStyle || {
          tone: 'Not specified',
          rhythm: 'Not specified',
          emphasis: [],
        },
        keyMessages: parsed.keyMessages || [],
        recurringMotifs: parsed.recurringMotifs || [],
        ministryDNA: parsed.ministryDNA || '',
      };
    } catch (error) {
      this.logger.error('Failed to parse extraction response', error);
      throw new Error('Failed to extract voice profile from response');
    }
  }
}
