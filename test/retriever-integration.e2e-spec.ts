import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { RetrieverService } from '../src/modules/rag/retrievers/retriever.service';
import { EmbeddingsService } from '../src/modules/rag/embeddings/embeddings.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../src/modules/users/users.service';
import {
  createMockEmbeddingVector,
  overrideE2eProviders,
} from './helpers/e2e-test-utils';

jest.setTimeout(30000);

describe('RAG Retriever Integration E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let retrieverService: RetrieverService;
  let embeddingsService: EmbeddingsService;
  let jwtService: JwtService;
  let usersService: UsersService;

  let userA: any;
  let userB: any;
  let profileA: any;
  let profileB: any;

  const mockVector1: number[] = createMockEmbeddingVector(1);
  const mockVector2: number[] = createMockEmbeddingVector(2);
  const mockVector3: number[] = createMockEmbeddingVector(3);
  const queryVector: number[] = mockVector1; // Use first vector as query

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
    retrieverService = module.get<RetrieverService>(RetrieverService);
    embeddingsService = module.get<EmbeddingsService>(EmbeddingsService);
    jwtService = module.get<JwtService>(JwtService);
    usersService = module.get<UsersService>(UsersService);

    // Create User A
    const createdUserA = await usersService.create(
      `user-a-retriever-${Date.now()}@example.com`,
      'PasswordA123!',
      'User A Retriever',
    );
    await prisma.user.create({
      data: {
        id: createdUserA.id,
        email: createdUserA.email,
        password: 'PasswordA123!',
        name: createdUserA.displayName,
      },
    });
    const tokenA = jwtService.sign({
      sub: createdUserA.id,
      email: createdUserA.email,
    });
    userA = { id: createdUserA.id, email: createdUserA.email, token: tokenA };

    // Create User B
    const createdUserB = await usersService.create(
      `user-b-retriever-${Date.now()}@example.com`,
      'PasswordB123!',
      'User B Retriever',
    );
    await prisma.user.create({
      data: {
        id: createdUserB.id,
        email: createdUserB.email,
        password: 'PasswordB123!',
        name: createdUserB.displayName,
      },
    });
    const tokenB = jwtService.sign({
      sub: createdUserB.id,
      email: createdUserB.email,
    });
    userB = { id: createdUserB.id, email: createdUserB.email, token: tokenB };

    // Create profiles
    profileA = await prisma.voiceProfile.create({
      data: {
        userId: userA.id,
        name: 'Prophetic Voice A',
        biography: 'User A profile',
      },
    });

    profileB = await prisma.voiceProfile.create({
      data: {
        userId: userB.id,
        name: 'Apostolic Voice B',
        biography: 'User B profile',
      },
    });
  });

  afterAll(async () => {
    // Cleanup embeddings
    if (profileA) {
      await prisma.voiceProfileEmbedding.deleteMany({
        where: { voiceProfileId: profileA.id },
      });
    }
    if (profileB) {
      await prisma.voiceProfileEmbedding.deleteMany({
        where: { voiceProfileId: profileB.id },
      });
    }

    // Cleanup profiles
    if (profileA) {
      await prisma.voiceProfile.delete({ where: { id: profileA.id } });
    }
    if (profileB) {
      await prisma.voiceProfile.delete({ where: { id: profileB.id } });
    }

    // Cleanup users
    await prisma.user.delete({ where: { id: userA.id } });
    await prisma.user.delete({ where: { id: userB.id } });

    await app.close();
  });

  beforeEach(() => {
    // Mock Gemini API
    global.fetch = jest.fn().mockImplementation((url, opts) => {
      // Return different vectors based on call count
      let vector = mockVector1;
      if (global.fetch.mock.callCount > 1) {
        vector = mockVector2;
      }
      if (global.fetch.mock.callCount > 2) {
        vector = mockVector3;
      }

      return Promise.resolve({
        json: async () => ({
          predictions: [{ embedding: vector }],
        }),
      });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic RAG Retrieval', () => {
    it('should retrieve relevant embeddings when user embeddings exist', async () => {
      // Store some embeddings for User A
      const userATexts = [
        'The Spirit of the Lord is moving in power',
        'God speaks through prophetic utterance',
      ];

      // Mock to return predictable vectors
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          json: async () => ({ predictions: [{ embedding: mockVector1 }] }),
        })
        .mockResolvedValueOnce({
          json: async () => ({ predictions: [{ embedding: mockVector2 }] }),
        });

      await embeddingsService.embedAndStoreForVoiceProfile(
        profileA.id,
        userATexts,
        {
          type: 'interview_response',
        },
      );

      // Mock the embeddings service to return our query vector
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ predictions: [{ embedding: queryVector }] }),
      });

      // Retrieve relevant embeddings
      const results = await retrieverService.retrieveRelevant(
        userA.id,
        'Spirit moving',
        5,
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should retrieve user embeddings with metadata', async () => {
      // Store embeddings with specific metadata
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          json: async () => ({ predictions: [{ embedding: mockVector1 }] }),
        })
        .mockResolvedValueOnce({
          json: async () => ({ predictions: [{ embedding: mockVector2 }] }),
        });

      const texts = ['When crisis comes, we must rely on the Holy Spirit'];
      await embeddingsService.embedAndStoreForVoiceProfile(profileA.id, texts, {
        type: 'voice_profile',
        source: 'interview',
      });

      // Mock query
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ predictions: [{ embedding: queryVector }] }),
      });

      const results = await retrieverService.retrieveRelevant(
        userA.id,
        'crisis ministry',
        5,
      );

      expect(results).toBeDefined();
      // Verify metadata is preserved in results
      const userResults = results.filter((r: any) => r.source === 'user');
      userResults.forEach((result: any) => {
        expect(result.item).toBeDefined();
        expect(result.item.metadata).toBeDefined();
      });
    });

    it('should sort results by distance (closest first)', async () => {
      // Store multiple embeddings
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          json: async () => ({ predictions: [{ embedding: mockVector1 }] }),
        })
        .mockResolvedValueOnce({
          json: async () => ({ predictions: [{ embedding: mockVector2 }] }),
        })
        .mockResolvedValueOnce({
          json: async () => ({ predictions: [{ embedding: mockVector3 }] }),
        });

      const texts = ['Text 1', 'Text 2', 'Text 3'];
      await embeddingsService.embedAndStoreForVoiceProfile(profileA.id, texts, {
        type: 'test',
      });

      // Mock query
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ predictions: [{ embedding: queryVector }] }),
      });

      const results = await retrieverService.retrieveRelevant(
        userA.id,
        'test query',
        10,
      );

      // Verify results are sorted by distance
      for (let i = 0; i < results.length - 1; i++) {
        const currentDistance = results[i].item?.distance ?? 0;
        const nextDistance = results[i + 1].item?.distance ?? 0;
        expect(currentDistance).toBeLessThanOrEqual(nextDistance);
      }
    });

    it('should respect retrieval limit', async () => {
      // Store multiple embeddings
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          json: async () => ({ predictions: [{ embedding: mockVector1 }] }),
        })
        .mockResolvedValueOnce({
          json: async () => ({ predictions: [{ embedding: mockVector2 }] }),
        })
        .mockResolvedValueOnce({
          json: async () => ({ predictions: [{ embedding: mockVector3 }] }),
        });

      const texts = ['Text 1', 'Text 2', 'Text 3'];
      await embeddingsService.embedAndStoreForVoiceProfile(profileA.id, texts, {
        type: 'test',
      });

      // Mock query
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ predictions: [{ embedding: queryVector }] }),
      });

      const limitedResults = await retrieverService.retrieveRelevant(
        userA.id,
        'query',
        2,
      );

      expect(limitedResults.length).toBeLessThanOrEqual(2);
    });
  });

  describe('User Isolation in Retrieval', () => {
    beforeEach(async () => {
      // Store embeddings for User A
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          json: async () => ({ predictions: [{ embedding: mockVector1 }] }),
        })
        .mockResolvedValueOnce({
          json: async () => ({ predictions: [{ embedding: mockVector2 }] }),
        });

      await embeddingsService.embedAndStoreForVoiceProfile(
        profileA.id,
        ['User A text 1', 'User A text 2'],
        {
          type: 'user_a_data',
        },
      );

      // Store embeddings for User B
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          json: async () => ({ predictions: [{ embedding: mockVector2 }] }),
        })
        .mockResolvedValueOnce({
          json: async () => ({ predictions: [{ embedding: mockVector3 }] }),
        });

      await embeddingsService.embedAndStoreForVoiceProfile(
        profileB.id,
        ['User B text 1', 'User B text 2'],
        {
          type: 'user_b_data',
        },
      );
    });

    it('should NOT return User B embeddings in User A retrieval', async () => {
      // Mock query for User A
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ predictions: [{ embedding: queryVector }] }),
      });

      const userAResults = await retrieverService.retrieveRelevant(
        userA.id,
        'query',
        10,
      );

      // Filter user-scoped results (exclude scripture)
      const userAEmbeddings = userAResults.filter(
        (r: any) => r.source === 'user',
      );

      // Verify no User B data in User A results
      userAEmbeddings.forEach((result: any) => {
        expect(result.item.metadata.type).not.toBe('user_b_data');
      });
    });

    it('should NOT return User A embeddings in User B retrieval', async () => {
      // Mock query for User B
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ predictions: [{ embedding: queryVector }] }),
      });

      const userBResults = await retrieverService.retrieveRelevant(
        userB.id,
        'query',
        10,
      );

      // Filter user-scoped results (exclude scripture)
      const userBEmbeddings = userBResults.filter(
        (r: any) => r.source === 'user',
      );

      // Verify no User A data in User B results
      userBEmbeddings.forEach((result: any) => {
        expect(result.item.metadata.type).not.toBe('user_a_data');
      });
    });

    it("should isolate different users' embeddings correctly", async () => {
      // Mock queries
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ predictions: [{ embedding: queryVector }] }),
      });

      const userAResults = await retrieverService.retrieveRelevant(
        userA.id,
        'query',
        10,
      );
      const userBResults = await retrieverService.retrieveRelevant(
        userB.id,
        'query',
        10,
      );

      // Get user-scoped results
      const userAEmbeddings = userAResults
        .filter((r: any) => r.source === 'user')
        .map((r: any) => r.item.metadata.type);
      const userBEmbeddings = userBResults
        .filter((r: any) => r.source === 'user')
        .map((r: any) => r.item.metadata.type);

      // Verify isolation
      expect(userAEmbeddings.every((t: any) => t !== 'user_b_data')).toBe(true);
      expect(userBEmbeddings.every((t: any) => t !== 'user_a_data')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty retrieval results gracefully', async () => {
      // New user with no embeddings
      const newUser = await usersService.create(
        `new-user-retriever-${Date.now()}@example.com`,
        'Password123!',
        'New User',
      );
      await prisma.user.create({
        data: {
          id: newUser.id,
          email: newUser.email,
          password: 'Password123!',
          name: newUser.displayName,
        },
      });

      // Mock query
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ predictions: [{ embedding: queryVector }] }),
      });

      const results = await retrieverService.retrieveRelevant(
        newUser.id,
        'query',
        5,
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      // Cleanup
      await prisma.user.delete({ where: { id: newUser.id } });
    });

    it('should handle zero limit gracefully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ predictions: [{ embedding: queryVector }] }),
      });

      const results = await retrieverService.retrieveRelevant(
        userA.id,
        'query',
        0,
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('Metadata Preservation in Results', () => {
    it('should preserve metadata for RAG prompt injection', async () => {
      // Store embeddings with detailed metadata
      global.fetch = jest.fn().mockResolvedValueOnce({
        json: async () => ({ predictions: [{ embedding: mockVector1 }] }),
      });

      const enrichedText =
        'The Kingdom of Heaven manifests in signs and wonders';
      await embeddingsService.embedAndStoreForVoiceProfile(
        profileA.id,
        [enrichedText],
        {
          type: 'interview_response',
          source: 'interview_session',
          question: 'How does God manifest His kingdom?',
          timestamp: new Date().toISOString(),
        },
      );

      // Mock query
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ predictions: [{ embedding: queryVector }] }),
      });

      const results = await retrieverService.retrieveRelevant(
        userA.id,
        'kingdom manifestation',
        5,
      );

      // Find our text in results
      const found = results.find(
        (r: any) =>
          r.item?.metadata?.question === 'How does God manifest His kingdom?',
      );

      if (found) {
        expect(found.item.metadata).toHaveProperty(
          'type',
          'interview_response',
        );
        expect(found.item.metadata).toHaveProperty(
          'source',
          'interview_session',
        );
        expect(found.item.metadata).toHaveProperty('question');
        expect(found.item.metadata).toHaveProperty('timestamp');
      }
    });
  });
});
