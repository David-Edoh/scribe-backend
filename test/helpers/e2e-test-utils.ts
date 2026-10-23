import { PrismaService } from '../../src/prisma.service';
import { EmbeddingsService } from '../../src/modules/rag/embeddings/embeddings.service';
import { VoiceProfileRepository } from '../../src/modules/voice-profile/voice-profile.repository';
import { ChapterGenerationWorker } from '../../src/modules/generation/services/chapter-generation.worker';
import { InterviewProcessingWorker } from '../../src/modules/interview/services/interview-processing.worker';
import { GeminiLLMService } from '../../src/modules/generation/services/gemini-llm.service';
import { ImageGenerationService } from '../../src/modules/generation/services/image-generation.service';

type Entity = Record<string, any>;

const EMBEDDING_DIMENSIONS = 384;

function makeId(prefix: string, sequence: number) {
  return `${prefix}_${sequence.toString().padStart(6, '0')}`;
}

function clone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (Array.isArray(value)) return value.map((item) => clone(item)) as T;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, clone(item)]),
  ) as T;
}

function matchesWhere(row: Entity, where: Entity = {}) {
  return Object.entries(where).every(([key, expected]) => {
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('contains' in expected) {
        return String(row[key] ?? '').includes(String(expected.contains));
      }

      if ('path' in expected && 'equals' in expected) {
        const path = expected.path as string[];
        const actual = path.reduce((current, segment) => current?.[segment], row[key]);
        return actual === expected.equals;
      }

      return matchesWhere(row[key] ?? {}, expected);
    }

    return row[key] === expected;
  });
}

function cosineDistance(vec1: number[], vec2: number[]) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) return 1;

  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    mag1 += vec1[i] * vec1[i];
    mag2 += vec2[i] * vec2[i];
  }

  if (mag1 === 0 || mag2 === 0) return 1;
  return 1 - dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

class InMemoryDelegate {
  constructor(
    private readonly rows: Entity[],
    private readonly idPrefix: string,
    private readonly getNextSequence: () => number,
    private readonly defaults: (data: Entity) => Entity = (data) => data,
  ) {}

  async create({ data }: { data: Entity }) {
    const now = new Date();
    const row = this.defaults({
      id: data.id ?? makeId(this.idPrefix, this.getNextSequence()),
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
      ...data,
    });

    this.rows.push(row);
    return clone(row);
  }

  async findUnique({ where }: { where: Entity }) {
    const row = this.rows.find((item) => matchesWhere(item, where));
    return row ? clone(row) : null;
  }

  async findFirst({ where = {} }: { where?: Entity } = {}) {
    const row = this.rows.find((item) => matchesWhere(item, where));
    return row ? clone(row) : null;
  }

  async findMany({
    where = {},
    include = {},
    take,
  }: { where?: Entity; include?: Entity; take?: number } = {}) {
    let results = this.rows.filter((item) => matchesWhere(item, where));

    if (take !== undefined) {
      results = results.slice(0, take);
    }

    return results.map((row) => {
      const item = clone(row);
      if (include.voiceProfile && row.voiceProfile) {
        item.voiceProfile = clone(row.voiceProfile);
      }
      return item;
    });
  }

  async update({ where, data }: { where: Entity; data: Entity }) {
    const row = this.rows.find((item) => matchesWhere(item, where));
    if (!row) throw new Error(`${this.idPrefix} record not found`);

    Object.assign(row, data, { updatedAt: new Date() });
    return clone(row);
  }

  async delete({ where }: { where: Entity }) {
    const index = this.rows.findIndex((item) => matchesWhere(item, where));
    if (index === -1) throw new Error(`${this.idPrefix} record not found`);

    const [deleted] = this.rows.splice(index, 1);
    return clone(deleted);
  }

  async deleteMany({ where = {} }: { where?: Entity } = {}) {
    const before = this.rows.length;

    for (let index = this.rows.length - 1; index >= 0; index--) {
      if (matchesWhere(this.rows[index], where)) {
        this.rows.splice(index, 1);
      }
    }

    return { count: before - this.rows.length };
  }
}

export class InMemoryPrismaService {
  private sequence = 0;
  private readonly users: Entity[] = [];
  private readonly voiceProfiles: Entity[] = [];
  private readonly voiceProfileEmbeddings: Entity[] = [];
  private readonly scriptureEmbeddings: Entity[] = [];

  readonly user = new InMemoryDelegate(
    this.users,
    'user',
    () => ++this.sequence,
    (data) => ({
      name: null,
      emailVerified: false,
      emailVerificationToken: null,
      emailVerificationSentAt: null,
      ...data,
    }),
  );

  readonly voiceProfile = new InMemoryDelegate(
    this.voiceProfiles,
    'profile',
    () => ++this.sequence,
    (data) => ({
      biography: null,
      signaturePhrases: [],
      anchorScriptures: [],
      theologicalFramework: null,
      sampleTexts: null,
      ...data,
    }),
  );

  readonly voiceProfileEmbedding = new InMemoryDelegate(
    this.voiceProfileEmbeddings,
    'embedding',
    () => ++this.sequence,
    (data) => ({
      bookId: null,
      sourceText: null,
      metadata: {},
      ...data,
      voiceProfile:
        data.voiceProfile ??
        this.voiceProfiles.find((profile) => profile.id === data.voiceProfileId),
    }),
  );

  readonly scriptureEmbedding = new InMemoryDelegate(
    this.scriptureEmbeddings,
    'scripture',
    () => ++this.sequence,
    (data) => ({
      metadata: {},
      ...data,
    }),
  );

  async $connect() {}

  async $disconnect() {}

  async onModuleInit() {}

  async onModuleDestroy() {}

  async $queryRaw(strings: TemplateStringsArray | string[], ...values: any[]) {
    const sql = Array.from(strings).join('?').toLowerCase();

    if (sql.includes('insert into "voice_profile_embeddings"')) {
      const [voiceProfileId, vectorLiteral, sourceText, metadataJson] = values;
      const embedding = String(vectorLiteral)
        .replace(/^\[|\]$/g, '')
        .split(',')
        .filter(Boolean)
        .map(Number);
      const metadata =
        typeof metadataJson === 'string' ? JSON.parse(metadataJson) : metadataJson;

      const row = await this.voiceProfileEmbedding.create({
        data: {
          voiceProfileId,
          embedding,
          sourceText,
          metadata,
        },
      });

      const { embedding: _embedding, voiceProfile: _voiceProfile, ...result } = row;
      return [result];
    }

    if (sql.includes('pg_indexes')) {
      return [
        {
          indexname: 'voice_profile_embeddings_embedding_hnsw_idx',
          indexdef: 'CREATE INDEX voice_profile_embeddings_embedding_hnsw_idx',
        },
      ];
    }

    if (sql.includes('information_schema.columns')) {
      return [
        { column_name: 'embedding_vector', data_type: 'USER-DEFINED' },
      ];
    }

    throw new Error('Raw vector query is not available in the e2e test store.');
  }

  findVoiceProfileEmbeddingsByUser(userId: string) {
    const profileIds = new Set(
      this.voiceProfiles
        .filter((profile) => profile.userId === userId)
        .map((profile) => profile.id),
    );

    return this.voiceProfileEmbeddings.filter((embedding) =>
      profileIds.has(embedding.voiceProfileId),
    );
  }

  findNearestVoiceProfileEmbeddings(userId: string, vector: number[], limit = 5) {
    return this.findVoiceProfileEmbeddingsByUser(userId)
      .filter((embedding) => Array.isArray(embedding.embedding))
      .map((embedding) => ({
        id: embedding.id,
        voiceProfileId: embedding.voiceProfileId,
        sourceText: embedding.sourceText || '',
        metadata: clone(embedding.metadata),
        distance: cosineDistance(vector, embedding.embedding),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  findNearestScriptureEmbeddings(vector: number[], limit = 5) {
    return this.scriptureEmbeddings
      .filter((embedding) => Array.isArray(embedding.embedding))
      .map((embedding) => ({
        id: embedding.id,
        scriptureRef: embedding.scriptureRef,
        scriptureText: embedding.scriptureText,
        metadata: clone(embedding.metadata),
        distance: cosineDistance(vector, embedding.embedding),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }
}

export class TestVoiceProfileRepository {
  constructor(private readonly prisma: InMemoryPrismaService) {}

  async create(profile: any) {
    return this.prisma.voiceProfile.create({ data: profile });
  }

  async findAllByUser(userId: string) {
    return this.prisma.voiceProfile.findMany({ where: { userId } });
  }

  async findById(id: string) {
    return this.prisma.voiceProfile.findUnique({ where: { id } });
  }

  async update(id: string, changes: any) {
    return this.prisma.voiceProfile.update({ where: { id }, data: changes });
  }

  async remove(id: string) {
    return this.prisma.voiceProfile.delete({ where: { id } });
  }

  async addEmbedding(
    voiceProfileId: string,
    vector: number[],
    sourceText = '',
    metadata: any = {},
  ) {
    return this.prisma.voiceProfileEmbedding.create({
      data: {
        voiceProfileId,
        embedding: vector,
        sourceText,
        metadata,
      },
    });
  }

  async queryNearestByUser(userId: string, vector: number[], limit = 5) {
    return this.prisma.findNearestVoiceProfileEmbeddings(userId, vector, limit);
  }

  async queryNearestScriptures(vector: number[], limit = 5) {
    return this.prisma.findNearestScriptureEmbeddings(vector, limit);
  }
}

export function createMockEmbeddingVector(seed = 0, dimensions = EMBEDDING_DIMENSIONS) {
  return Array.from({ length: dimensions }, (_, index) => {
    const value = ((index + seed) % 23) + 1;
    return value / 23;
  });
}

export class MockEmbeddingsService {
  constructor(private readonly repo?: TestVoiceProfileRepository) {}

  async embedText(text: string) {
    return createMockEmbeddingVector(text.length);
  }

  async embedMany(texts: string[]) {
    return texts.map((text, index) => createMockEmbeddingVector(text.length + index));
  }

  async embedAndStoreForVoiceProfile(
    voiceProfileId: string,
    texts: string[],
    metadata: any = {},
  ) {
    const vectors = await this.embedMany(texts);
    const results: any[] = [];

    for (let index = 0; index < texts.length; index++) {
      const stored = {
        voiceProfileId,
        sourceText: texts[index],
        metadata: {
          ...metadata,
          index,
        },
        embedding: vectors[index],
      };

      results.push(
        this.repo
          ? await this.repo.addEmbedding(
              voiceProfileId,
              vectors[index],
              texts[index],
              stored.metadata,
            )
          : stored,
      );
    }

    return results;
  }

  getEmbeddingConfig() {
    return { method: 'local' as const, dimensions: EMBEDDING_DIMENSIONS };
  }
}

export function overrideE2eProviders(moduleBuilder: any) {
  const prisma = new InMemoryPrismaService();
  const repo = new TestVoiceProfileRepository(prisma);
  const noOpWorker = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  };
  const geminiStub = {
    generateChapter: jest.fn().mockResolvedValue({
      content: '',
      model: 'test-model',
      tokensUsed: { input: 0, output: 0 },
      finishReason: 'STOP',
    }),
    generateChapterStream: jest.fn(async function* () {}),
    evaluateGeneration: jest.fn().mockResolvedValue({
      isApproved: true,
      issues: [],
      score: 100,
    }),
  };
  const imageGenerationStub = {
    generateBookCover: jest.fn().mockResolvedValue({
      success: true,
      image: 'data:image/png;base64,',
      model: 'test-image-model',
      generatedAt: new Date(0).toISOString(),
    }),
  };

  return {
    prisma,
    repo,
    builder: moduleBuilder
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(EmbeddingsService)
      .useValue(new MockEmbeddingsService(repo))
      .overrideProvider(VoiceProfileRepository)
      .useValue(repo)
      .overrideProvider(ChapterGenerationWorker)
      .useValue(noOpWorker)
      .overrideProvider(InterviewProcessingWorker)
      .useValue(noOpWorker)
      .overrideProvider(GeminiLLMService)
      .useValue(geminiStub)
      .overrideProvider(ImageGenerationService)
      .useValue(imageGenerationStub),
  };
}
