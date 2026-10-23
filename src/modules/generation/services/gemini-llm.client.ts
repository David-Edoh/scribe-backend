import { BadRequestException, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { GoogleAuthService } from '../../../common/services/google-auth.service';

const GEMINI_LOCATION = 'us-central1';
const CLOUD_PLATFORM_SCOPE = ['https://www.googleapis.com/auth/cloud-platform'];

export const createGeminiClient = (
  authService: GoogleAuthService,
  logger: Logger,
): GoogleGenAI | null => {
  try {
    const credentials = authService.getCredentials();
    const projectId = authService.getProjectId();

    const client = new GoogleGenAI({
      vertexai: true,
      project: projectId,
      location: GEMINI_LOCATION,
      googleAuthOptions: {
        credentials,
        scopes: CLOUD_PLATFORM_SCOPE,
      },
    });

    logger.debug('Google Gen AI initialized with service account for Vertex AI');
    return client;
  } catch (error) {
    logger.error('Failed to initialize Google Gen AI', error);
    return null;
  }
};

export const requireGeminiClient = (genAI: GoogleGenAI | null): GoogleGenAI => {
  if (!genAI) {
    throw new BadRequestException(
      'Google Gen AI not initialized. Check service account credentials.',
    );
  }

  return genAI;
};
