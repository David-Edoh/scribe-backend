import { Injectable } from '@nestjs/common';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { VoiceProfileRepository } from '../../voice-profile/voice-profile.repository';

@Injectable()
export class RetrieverService {
  constructor(
    private readonly embeddings: EmbeddingsService,
    private readonly repo: VoiceProfileRepository,
  ) {}

  // Retrieve nearest user-scoped vectors and scripture vectors, then return combined results
  async retrieveRelevant(userId: string, query: string, limit = 5) {
    const qvec = await this.embeddings.embedText(query);

    // user-scoped vectors (join voice_profiles -> voice_profile_embeddings)
    const userResults = await this.repo.queryNearestByUser(userId, qvec, limit);

    // scripture vectors
    const scriptureResults = await this.repo.queryNearestScriptures(
      qvec,
      limit,
    );

    // Format and combine results
    const combined: any[] = [];

    if (Array.isArray(userResults)) {
      userResults.forEach((r) => {
        combined.push({
          source: 'user',
          item: r,
        });
      });
    }

    if (Array.isArray(scriptureResults)) {
      scriptureResults.forEach((r) => {
        combined.push({
          source: 'scripture',
          item: r,
        });
      });
    }

    // Sort by distance (closest first)
    combined.sort((a, b) => (a.item.distance ?? 0) - (b.item.distance ?? 0));

    return combined.slice(0, limit);
  }
}
