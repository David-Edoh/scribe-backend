import { Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../prisma.service';
import { VoiceProfileEmbeddingModel } from '../rag/models/voice-profile-embedding.model';
import { ScriptureEmbeddingModel } from '../rag/models/scripture-embedding.model';
import { VoiceProfileModel } from './models/voice-profile.model';

@Injectable()
export class VoiceProfileRepository {
  private readonly logger = new Logger(VoiceProfileRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(profile: any): Promise<VoiceProfileModel> {
    this.logger.debug(
      `[REPO-CREATE] Creating voice profile - name: ${profile.name}`,
    );
    const result = await this.prisma.voiceProfile.create({ data: profile });
    this.logger.debug(`[REPO-CREATE] Voice profile created - id: ${result.id}`);
    return plainToInstance(VoiceProfileModel, result);
  }

  async findAllByUser(userId: string): Promise<VoiceProfileModel[]> {
    const results = await this.prisma.voiceProfile.findMany({ where: { userId } });
    return plainToInstance(VoiceProfileModel, results);
  }

  async findById(id: string): Promise<VoiceProfileModel | null> {
    const result = await this.prisma.voiceProfile.findUnique({ where: { id } });
    return result ? plainToInstance(VoiceProfileModel, result) : null;
  }

  async update(id: string, changes: any): Promise<VoiceProfileModel> {
    const result = await this.prisma.voiceProfile.update({ where: { id }, data: changes });
    return plainToInstance(VoiceProfileModel, result);
  }

  async remove(id: string): Promise<VoiceProfileModel> {
    const result = await this.prisma.voiceProfile.delete({ where: { id } });
    return plainToInstance(VoiceProfileModel, result);
  }

  async addEmbedding(
    voiceProfileId: string,
    vector: number[],
    sourceText: string = '',
    metadata: any = {},
  ): Promise<VoiceProfileEmbeddingModel> {
    if (vector.length !== 384) {
      throw new Error(
        `Voice profile embeddings must be 384 dimensions, received ${vector.length}.`,
      );
    }
    const vectorLiteral = this.toPgVectorLiteral(vector);

    // Prisma binds number[] as bytea in raw queries, so pass pgvector text format.
    // metadata must be cast to JSONB type
    // Return only non-vector columns to avoid deserialization issues
    const result = await this.prisma.$queryRaw<any>`
      INSERT INTO "voice_profile_embeddings" ("id", "voiceProfileId", "embedding", "sourceText", "metadata", "createdAt")
      VALUES (gen_random_uuid()::text, ${voiceProfileId}, ${vectorLiteral}::vector, ${sourceText || null}, ${JSON.stringify(metadata)}::jsonb, NOW())
      RETURNING "id", "voiceProfileId", "sourceText", "metadata", "createdAt";
    `;
    return plainToInstance(VoiceProfileEmbeddingModel, result[0]);
  }

  // Nearest-neighbor search for a user's voice profile embeddings using pgVector
  // Uses native PostgreSQL vector operators for efficient similarity search
  // Returns embeddings for profiles owned by the user, sorted by cosine distance
  async queryNearestByUser(userId: string, vector: number[], limit = 5): Promise<VoiceProfileEmbeddingModel[]> {
    try {
      const vectorLiteral = this.toPgVectorLiteral(vector);
      const results = await this.prisma.$queryRaw`
        SELECT 
          vpe.id,
          vpe."voiceProfileId",
          vpe."sourceText",
          vpe.metadata,
          (vpe.embedding <=> ${vectorLiteral}::vector) as distance
        FROM voice_profile_embeddings vpe
        INNER JOIN voice_profiles vp ON vpe."voiceProfileId" = vp.id
        WHERE vp."userId" = ${userId}
          AND vpe.embedding IS NOT NULL
          AND vector_dims(vpe.embedding) = ${vector.length}
        ORDER BY vpe.embedding <=> ${vectorLiteral}::vector
        LIMIT ${limit}
      `;

      const mapped = (results as any[]).map((r) => ({
        id: r.id,
        voiceProfileId: r.voiceProfileId,
        sourceText: r.sourceText || '',
        metadata: r.metadata,
        distance: parseFloat(r.distance) || 0,
      }));

      this.logger.debug(`[VECTOR-SEARCH] userId=${userId} results=${JSON.stringify(mapped)}`);
      return plainToInstance(VoiceProfileEmbeddingModel, mapped);
    } catch (error) {
      this.logger.error(
        `Vector search failed for user ${userId}. Falling back to in-memory search.`,
        error,
      );
      return this.queryNearestByUserFallback(userId, vector, limit);
    }
  }

  // Fallback: In-memory vector search if pgVector is unavailable
  private async queryNearestByUserFallback(
    userId: string,
    vector: number[],
    limit = 5,
  ): Promise<VoiceProfileEmbeddingModel[]> {
    const results = await this.prisma.voiceProfileEmbedding.findMany({
      where: {
        voiceProfile: {
          userId,
        },
      },
      include: {
        voiceProfile: true,
      },
    });

    const withDistance = results.map((emb: any) => {
      const distance = this.calculateCosineSimilarity(
        vector,
        emb.embedding as number[],
      );
      return {
        id: emb.id,
        voiceProfileId: emb.voiceProfileId,
        sourceText: emb.sourceText || '',
        metadata: emb.metadata,
        distance,
      };
    });

    const sorted = withDistance.sort((a, b) => a.distance - b.distance).slice(0, limit);
    this.logger.debug(`[VECTOR-SEARCH-FALLBACK] userId=${userId} results=${JSON.stringify(sorted)}`);
    return plainToInstance(VoiceProfileEmbeddingModel, sorted);
  }

  // Retrieve scripture embeddings ordered by similarity using pgVector
  // Uses native PostgreSQL vector operators for efficient similarity search
  async queryNearestScriptures(vector: number[], limit = 5): Promise<ScriptureEmbeddingModel[]> {
    try {
      const vectorLiteral = this.toPgVectorLiteral(vector);
      const results = await this.prisma.$queryRaw`
        SELECT 
          id,
          "scriptureRef",
          "scriptureText",
          metadata,
          (embedding <=> ${vectorLiteral}::vector) as distance
        FROM scripture_embeddings
        WHERE embedding IS NOT NULL
          AND vector_dims(embedding) = ${vector.length}
        ORDER BY embedding <=> ${vectorLiteral}::vector
        LIMIT ${limit}
      `;

      const mapped = (results as any[]).map((r) => ({
        id: r.id,
        scriptureRef: r.scriptureRef,
        scriptureText: r.scriptureText,
        metadata: r.metadata,
        distance: parseFloat(r.distance) || 0,
      }));

      return plainToInstance(ScriptureEmbeddingModel, mapped);
    } catch (error) {
      this.logger.error(
        'Scripture vector search failed. Falling back to in-memory search.',
        error,
      );
      return this.queryNearestScripturesFallback(vector, limit);
    }
  }

  // Fallback: In-memory vector search if pgVector is unavailable
  private async queryNearestScripturesFallback(vector: number[], limit = 5) {
    const results = await this.prisma.scriptureEmbedding.findMany({
      take: limit,
    });

    const withDistance = results.map((emb: any) => {
      const distance = this.calculateCosineSimilarity(
        vector,
        emb.embedding as number[],
      );
      return {
        id: emb.id,
        scriptureRef: emb.scriptureRef,
        scriptureText: emb.scriptureText,
        metadata: emb.metadata,
        distance,
      };
    });

    return withDistance.sort((a, b) => a.distance - b.distance).slice(0, limit);
  }

  // Calculate cosine similarity between two vectors (0 = exact match, 1 = opposite, 0.5 = orthogonal)
  // Used as fallback when pgVector is unavailable
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      return 1; // Maximum distance for mismatched vectors
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }

    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);

    if (mag1 === 0 || mag2 === 0) {
      return 1;
    }

    // Cosine similarity ranges from -1 to 1, convert to distance (0 to 1)
    const similarity = dotProduct / (mag1 * mag2);
    return 1 - similarity;
  }

  private toPgVectorLiteral(vector: number[]): string {
    if (!vector || typeof vector.length !== 'number' || vector.length === 0) {
      throw new Error('Cannot serialize an empty embedding vector.');
    }

    const values = Array.from(vector);

    for (const value of values) {
      if (!Number.isFinite(value)) {
        throw new Error('Embedding vector contains a non-finite value.');
      }
    }

    return `[${values.join(',')}]`;
  }
}
