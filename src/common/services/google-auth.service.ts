import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
}

/**
 * Service for managing Google Cloud authentication using service account credentials
 * Decodes base64-encoded service account key from environment variables
 */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly serviceAccount: ServiceAccountKey;
  private readonly projectId: string;

  constructor(private readonly configService: ConfigService) {
    const serviceAccountBase64 = this.configService.get<string>(
      'GOOGLE_SERVICE_ACCOUNT_KEY',
    );

    if (!serviceAccountBase64) {
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set',
      );
    }

    try {
      this.serviceAccount = this.decodeServiceAccount(serviceAccountBase64);
      this.projectId = this.serviceAccount.project_id;
      this.logger.debug(
        `Google Auth initialized for project: ${this.projectId}`,
      );
    } catch (error) {
      this.logger.error('Failed to decode service account key', error);
      throw new Error('Failed to initialize Google authentication');
    }
  }

  /**
   * Decode base64-encoded service account JSON
   */
  private decodeServiceAccount(base64String: string): ServiceAccountKey {
    try {
      const decodedString = Buffer.from(base64String, 'base64').toString(
        'utf-8',
      );
      const parsed = JSON.parse(decodedString);
      return parsed as ServiceAccountKey;
    } catch (error) {
      this.logger.error('Failed to decode or parse service account', error);
      throw error;
    }
  }

  /**
   * Get service account credentials
   */
  getCredentials(): ServiceAccountKey {
    return this.serviceAccount;
  }

  /**
   * Get project ID
   */
  getProjectId(): string {
    return this.projectId;
  }

  /**
   * Get service account email
   */
  getServiceAccountEmail(): string {
    return this.serviceAccount.client_email;
  }
}
