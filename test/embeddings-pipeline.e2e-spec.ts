import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { EmbeddingsService } from '../src/modules/rag/embeddings/embeddings.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../src/modules/users/users.service';
import {
  createMockEmbeddingVector,
  overrideE2eProviders,
} from './helpers/e2e-test-utils';

jest.setTimeout(30000);

describe('Embeddings Pipeline E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let embeddingsService: EmbeddingsService;
  let jwtService: JwtService;
  let usersService: UsersService;
  let testUser: any;
  let testProfile: any;

  const mockEmbeddingVector: number[] = createMockEmbeddingVector();

  beforeAll(async () => {
    process.env.JWT_SECRET = 'dev_jwt_secret';
    process.env.GEMINI_EMBEDDINGS_URL = 'https://mock.api/embeddings';
    process.env.GEMINI_API_KEY = 'mock-key';

    const overrides = overrideE2eProviders(Test.createTestingModule({
      imports: [AppModule],
    }));
    const module: TestingModule = await overrides.builder.compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = module.get<PrismaService>(PrismaService);
    embeddingsService = module.get<EmbeddingsService>(EmbeddingsService);
    jwtService = module.get<JwtService>(JwtService);
    usersService = module.get<UsersService>(UsersService);

    // Setup test user
    const createdUser = await usersService.create(
      `test-${Date.now()}@example.com`,
      'TestPassword123!',
      'Test User',
    );

    // Also create in Prisma
    await prisma.user.create({
      data: {
        id: createdUser.id,
        email: createdUser.email,
        password: 'TestPassword123!',
        name: createdUser.displayName,
      },
    });

    const token = jwtService.sign({
      sub: createdUser.id,
      email: createdUser.email,
    });
    testUser = { id: createdUser.id, email: createdUser.email, token };
  });

  afterAll(async () => {
    // Cleanup: delete embeddings and profiles
    if (testProfile) {
      await prisma.voiceProfileEmbedding.deleteMany({
        where: { voiceProfileId: testProfile.id },
      });
      await prisma.voiceProfile.delete({
        where: { id: testProfile.id },
      });
    }
    // Cleanup user
    await prisma.user.delete({
      where: { id: testUser.id },
    });
    await app.close();
  });

  it('should create a voice profile for embedding', async () => {
    testProfile = await prisma.voiceProfile.create({
      data: {
        userId: testUser.id,
        name: 'Test Prophet',
        biography: 'Test biography for embeddings',
      },
    });

    expect(testProfile).toBeDefined();
    expect(testProfile.userId).toBe(testUser.id);
    expect(testProfile.name).toBe('Test Prophet');
  });

  it('should embed and store interview responses', async () => {
    // Mock Gemini API
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        predictions: [{ embedding: mockEmbeddingVector }],
      }),
    });

    const interviewResponses = [
      'When I pray, the Spirit moves mightily.',
      'God speaks through prophetic utterance.',
      'The Lord revealed His purposes through visions.',
    ];

    // Call embedAndStoreForVoiceProfile
    const stored = await embeddingsService.embedAndStoreForVoiceProfile(
      testProfile.id,
      interviewResponses,
      { type: 'interview_response', source: 'voice_profile_interview' },
    );

    // Verify embeddings were stored
    expect(stored).toHaveLength(3);
    expect(stored[0].voiceProfileId).toBe(testProfile.id);

    // Verify embedding is an array of numbers (don't compare exact values due to float precision)
    expect(Array.isArray(stored[0].embedding)).toBe(true);
    expect(stored[0].embedding.length).toBe(384);

    expect(stored[0].sourceText).toBe(interviewResponses[0]);
  });

  it('should retrieve stored embeddings from database', async () => {
    const embeddings = await prisma.voiceProfileEmbedding.findMany({
      where: { voiceProfileId: testProfile.id },
    });

    expect(embeddings).toHaveLength(3);

    // Verify each embedding
    embeddings.forEach((emb, idx) => {
      expect(emb.embedding).toBeDefined();
      expect(Array.isArray(emb.embedding)).toBe(true);
      expect(emb.embedding).toHaveLength(384);
      expect(emb.metadata.index).toBe(idx);
      expect(emb.metadata.type).toBe('interview_response');
      expect(emb.metadata.source).toBe('voice_profile_interview');
    });
  });

  it('should embed and store sample texts', async () => {
    // Mock Gemini API for sample texts
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        predictions: [{ embedding: mockEmbeddingVector }],
      }),
    });

    const sampleTexts = [
      "Therefore, as God's chosen people, holy and dearly loved, clothe yourselves with compassion.",
      'The kingdom of heaven is like a mustard seed that a man planted in his field.',
    ];

    // Store sample text embeddings with different metadata
    const stored = await embeddingsService.embedAndStoreForVoiceProfile(
      testProfile.id,
      sampleTexts,
      { type: 'sample_text', source: 'author_voice_sample' },
    );

    expect(stored).toHaveLength(2);

    // Verify both interview + sample embeddings are in database
    const allEmbeddings = await prisma.voiceProfileEmbedding.findMany({
      where: { voiceProfileId: testProfile.id },
    });

    expect(allEmbeddings.length).toBeGreaterThan(3);

    // Separate by type
    const interviewEmbeddings = allEmbeddings.filter(
      (e) => e.metadata.type === 'interview_response',
    );
    const sampleEmbeddings = allEmbeddings.filter(
      (e) => e.metadata.type === 'sample_text',
    );

    expect(interviewEmbeddings).toHaveLength(3);
    expect(sampleEmbeddings).toHaveLength(2);
  });

  it('should embed and store signature phrases', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        predictions: [{ embedding: mockEmbeddingVector }],
      }),
    });

    const signaturePhrases = [
      'Thus saith the Lord',
      "By the Spirit's anointing",
      'A word of the Lord came unto me',
    ];

    const stored = await embeddingsService.embedAndStoreForVoiceProfile(
      testProfile.id,
      signaturePhrases,
      { type: 'signature_phrase', source: 'voice_profile_meta' },
    );

    expect(stored).toHaveLength(3);

    const allEmbeddings = await prisma.voiceProfileEmbedding.findMany({
      where: { voiceProfileId: testProfile.id },
    });

    const phraseEmbeddings = allEmbeddings.filter(
      (e) => e.metadata.type === 'signature_phrase',
    );
    expect(phraseEmbeddings).toHaveLength(3);
  });

  it('should preserve embedding metadata through storage and retrieval', async () => {
    const allEmbeddings = await prisma.voiceProfileEmbedding.findMany({
      where: { voiceProfileId: testProfile.id },
    });

    // Test data integrity: metadata should roundtrip correctly
    allEmbeddings.forEach((emb) => {
      expect(emb.metadata).toHaveProperty('type');
      expect(emb.metadata).toHaveProperty('source');
      expect(emb.metadata).toHaveProperty('index');
      expect([
        'interview_response',
        'sample_text',
        'signature_phrase',
      ]).toContain(emb.metadata.type);
    });
  });

  it('should handle API response variations for Gemini', async () => {
    // Mock alternative Gemini response shape
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        // Gemini sometimes returns direct embedding field
        embedding: mockEmbeddingVector,
      }),
    });

    const testText = ['Alternative response format test'];

    const stored = await embeddingsService.embedAndStoreForVoiceProfile(
      testProfile.id,
      testText,
      { type: 'test', source: 'api_variation_test' },
    );

    expect(stored).toHaveLength(1);
    expect(Array.isArray(stored[0].embedding)).toBe(true);
    expect(stored[0].embedding.length).toBe(384);
  });

  it('should handle multiple profiles independently', async () => {
    // Create second voice profile
    const profile2 = await prisma.voiceProfile.create({
      data: {
        userId: testUser.id,
        name: 'Apostolic Voice',
        biography: 'Second test profile',
      },
    });

    // Mock Gemini API
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        predictions: [{ embedding: mockEmbeddingVector }],
      }),
    });

    // Store embeddings for profile 2
    await embeddingsService.embedAndStoreForVoiceProfile(
      profile2.id,
      ['Test embedding for profile 2'],
      { type: 'test', source: 'profile2' },
    );

    // Verify profile 1 embeddings not affected
    const profile1Embeddings = await prisma.voiceProfileEmbedding.findMany({
      where: { voiceProfileId: testProfile.id },
    });

    const profile2Embeddings = await prisma.voiceProfileEmbedding.findMany({
      where: { voiceProfileId: profile2.id },
    });

    expect(profile1Embeddings.length).toBeGreaterThan(3);
    expect(profile2Embeddings).toHaveLength(1);

    // Cleanup profile 2
    await prisma.voiceProfileEmbedding.deleteMany({
      where: { voiceProfileId: profile2.id },
    });
    await prisma.voiceProfile.delete({
      where: { id: profile2.id },
    });
  });

  it('should handle empty texts array gracefully', async () => {
    global.fetch = jest.fn();

    const stored = await embeddingsService.embedAndStoreForVoiceProfile(
      testProfile.id,
      [],
      { type: 'test' },
    );

    expect(stored).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
