import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';

/**
 * Service for uploading files to Google Cloud Storage
 * Used for storing generated images and other assets
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private storage: Storage | null = null;
  private bucket: any = null;
  private bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('GCS_BUCKET_NAME', '');
    this.initializeStorage();
  }

  private initializeStorage(): void {
    try {
      const projectId = this.configService.get<string>('GCP_PROJECT_ID');
      const gcpServiceAccountKeyBase64 = this.configService.get<string>(
        'GCP_SERVICE_ACCOUNT_KEY',
      );

      if (!projectId || !gcpServiceAccountKeyBase64 || !this.bucketName) {
        this.logger.warn(
          'GCP storage not fully configured. Skipping initialization.',
        );
        return;
      }

      // Decode base64 service account key
      const keyString = Buffer.from(
        gcpServiceAccountKeyBase64,
        'base64',
      ).toString('utf-8');
      const credentials = JSON.parse(keyString);

      this.storage = new Storage({
        projectId,
        credentials,
      });

      this.bucket = this.storage.bucket(this.bucketName);
      this.logger.debug(
        `GCS storage initialized with bucket: ${this.bucketName}`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize GCS storage', error);
      this.storage = null;
    }
  }

  /**
   * Upload a base64 image to GCS and return public URL
   */
  async uploadImage(
    base64Data: string,
    mimeType: string,
    fileName: string,
  ): Promise<string> {
    if (!this.storage || !this.bucket) {
      throw new Error('GCS storage not initialized');
    }

    try {
      // Remove data URI prefix if present
      const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');

      // Convert base64 to buffer
      const buffer = Buffer.from(cleanBase64, 'base64');

      // Create a reference to the file
      const file = this.bucket.file(fileName);

      // Upload the file
      await file.save(buffer, {
        metadata: {
          contentType: mimeType,
          cacheControl: 'public, max-age=31536000', // Cache for 1 year
        },
      });

      // Make file public
      await file.makePublic();

      // Construct public URL
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${fileName}`;

      this.logger.debug(`Image uploaded successfully: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      this.logger.error('Failed to upload image to GCS', error);
      throw new Error(
        `Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Generate a unique filename for book covers
   */
  generateBookCoverFileName(
    manuscriptId: string,
    timestamp: number = Date.now(),
  ): string {
    return `book-covers/${manuscriptId}-${timestamp}.png`;
  }
}
