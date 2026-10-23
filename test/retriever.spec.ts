import { Test, TestingModule } from '@nestjs/testing';
import { RetrieverService } from '../src/modules/rag/retrievers/retriever.service';
import { EmbeddingsService } from '../src/modules/embeddings.service';
import { VoiceProfileRepository } from '../src/modules/voice-profile/voice-profile.repository';

/**
 * Interface for mock embedding retrieval result
 */
interface MockEmbeddingResult {
  id: string;
  voiceProfileId: string;
  embedding: number[];
  metadata: Record<string, any>;
  source: 'user' | 'scripture';
  distance: number;
}

/**
 * Unit tests for the RetrieverService
 * Tests RAG retrieval logic with mocked embeddings and database queries
 */
describe('RetrieverService (Unit Tests)', () => {
  let retrieverService: RetrieverService;
  let embeddingsServiceMock: jest.Mocked<EmbeddingsService>;
  let voiceProfileRepositoryMock: jest.Mocked<VoiceProfileRepository>;

  // Mock embedding vector (1536 dimensions)
  const mockEmbeddingVector: number[] = Array.from(
    { length: 1536 },
    (_, i) => i / 1536,
  );

  // Test data
  const testUserId: string = '123e4567-e89b-12d3-a456-426614174000';
  const testVoiceProfileId: string = '123e4567-e89b-12d3-a456-426614174111';

  beforeEach(async () => {
    // Create mocks
    embeddingsServiceMock = {
      embedText: jest.fn().mockResolvedValue(mockEmbeddingVector),
    } as any;

    voiceProfileRepositoryMock = {
      queryNearestByUser: jest.fn(),
      queryNearestScriptures: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetrieverService,
        {
          provide: EmbeddingsService,
          useValue: embeddingsServiceMock,
        },
        {
          provide: VoiceProfileRepository,
          useValue: voiceProfileRepositoryMock,
        },
      ],
    }).compile();

    retrieverService = module.get<RetrieverService>(RetrieverService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('retrieveRelevant()', () => {
    it('should retrieve user voice profile embeddings and scripture embeddings for a query', async () => {
      const queryText: string = 'prophetic word about judgment';
      const retrievalLimit: number = 5;

      // Mock user-scoped embeddings
      const mockUserEmbeddings: MockEmbeddingResult[] = [
        {
          id: 'emb-1',
          voiceProfileId: testVoiceProfileId,
          embedding: mockEmbeddingVector,
          metadata: { source: 'interview_response' },
          source: 'user',
          distance: 0.15,
        },
        {
          id: 'emb-2',
          voiceProfileId: testVoiceProfileId,
          embedding: mockEmbeddingVector,
          metadata: { source: 'sample_text' },
          source: 'user',
          distance: 0.22,
        },
      ];

      // Mock scripture embeddings
      const mockScriptureEmbeddings: MockEmbeddingResult[] = [
        {
          id: 'emb-scripture-1',
          voiceProfileId: testVoiceProfileId,
          embedding: mockEmbeddingVector,
          metadata: { scripture_ref: 'Isaiah 13:6-13' },
          source: 'scripture',
          distance: 0.18,
        },
        {
          id: 'emb-scripture-2',
          voiceProfileId: testVoiceProfileId,
          embedding: mockEmbeddingVector,
          metadata: { scripture_ref: 'Joel 1:15' },
          source: 'scripture',
          distance: 0.25,
        },
      ];

      // Set up mocks
      (embeddingsServiceMock.embedText as jest.Mock).mockResolvedValueOnce(
        mockEmbeddingVector,
      );
      (
        voiceProfileRepositoryMock.queryNearestByUser as jest.Mock
      ).mockResolvedValueOnce(mockUserEmbeddings);
      (
        voiceProfileRepositoryMock.queryNearestScriptures as jest.Mock
      ).mockResolvedValueOnce(mockScriptureEmbeddings);

      const results = await retrieverService.retrieveRelevant(
        testUserId,
        queryText,
        retrievalLimit,
      );

      // Verify embeddings service was called with the query
      expect(embeddingsServiceMock.embedText).toHaveBeenCalledWith(queryText);

      // Verify repository queries were called
      expect(
        voiceProfileRepositoryMock.queryNearestByUser,
      ).toHaveBeenCalledWith(testUserId, mockEmbeddingVector, retrievalLimit);
      expect(
        voiceProfileRepositoryMock.queryNearestScriptures,
      ).toHaveBeenCalledWith(mockEmbeddingVector, retrievalLimit);

      // Verify results are combined and sorted by distance
      expect(results).toHaveLength(4);
      expect(results[0].distance).toBeLessThanOrEqual(results[1].distance);
      expect(results[1].distance).toBeLessThanOrEqual(results[2].distance);
    });

    it('should handle cases where only user embeddings are found', async () => {
      const queryText: string = 'What is apostolic ministry?';
      const retrievalLimit: number = 5;

      const mockUserEmbeddings: MockEmbeddingResult[] = [
        {
          id: 'emb-1',
          voiceProfileId: testVoiceProfileId,
          embedding: mockEmbeddingVector,
          metadata: { source: 'voice_profile' },
          source: 'user',
          distance: 0.12,
        },
      ];

      (embeddingsServiceMock.embedText as jest.Mock).mockResolvedValueOnce(
        mockEmbeddingVector,
      );
      (
        voiceProfileRepositoryMock.queryNearestByUser as jest.Mock
      ).mockResolvedValueOnce(mockUserEmbeddings);
      (
        voiceProfileRepositoryMock.queryNearestScriptures as jest.Mock
      ).mockResolvedValueOnce([]);

      const results = await retrieverService.retrieveRelevant(
        testUserId,
        queryText,
        retrievalLimit,
      );

      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('user');
    });

    it('should handle cases where only scripture embeddings are found', async () => {
      const queryText: string = 'Scripture about faith';
      const retrievalLimit: number = 5;

      const mockScriptureEmbeddings: MockEmbeddingResult[] = [
        {
          id: 'emb-scripture-1',
          voiceProfileId: testVoiceProfileId,
          embedding: mockEmbeddingVector,
          metadata: { scripture_ref: 'Hebrews 11:1' },
          source: 'scripture',
          distance: 0.09,
        },
        {
          id: 'emb-scripture-2',
          voiceProfileId: testVoiceProfileId,
          embedding: mockEmbeddingVector,
          metadata: { scripture_ref: 'Romans 10:17' },
          source: 'scripture',
          distance: 0.14,
        },
      ];

      (embeddingsServiceMock.embedText as jest.Mock).mockResolvedValueOnce(
        mockEmbeddingVector,
      );
      (
        voiceProfileRepositoryMock.queryNearestByUser as jest.Mock
      ).mockResolvedValueOnce([]);
      (
        voiceProfileRepositoryMock.queryNearestScriptures as jest.Mock
      ).mockResolvedValueOnce(mockScriptureEmbeddings);

      const results = await retrieverService.retrieveRelevant(
        testUserId,
        queryText,
        retrievalLimit,
      );

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.source === 'scripture')).toBe(true);
    });

    it('should return empty array when no embeddings are found', async () => {
      const queryText: string = 'No matching content';
      const retrievalLimit: number = 5;

      (embeddingsServiceMock.embedText as jest.Mock).mockResolvedValueOnce(
        mockEmbeddingVector,
      );
      (
        voiceProfileRepositoryMock.queryNearestByUser as jest.Mock
      ).mockResolvedValueOnce([]);
      (
        voiceProfileRepositoryMock.queryNearestScriptures as jest.Mock
      ).mockResolvedValueOnce([]);

      const results = await retrieverService.retrieveRelevant(
        testUserId,
        queryText,
        retrievalLimit,
      );

      expect(results).toEqual([]);
    });

    it('should respect the retrieval limit parameter', async () => {
      const queryText: string = 'Test query';
      const retrievalLimit: number = 3;

      // Create 10 mock embeddings
      const mockEmbeddings: MockEmbeddingResult[] = Array.from(
        { length: 10 },
        (_, i) => ({
          id: `emb-${i}`,
          voiceProfileId: testVoiceProfileId,
          embedding: mockEmbeddingVector,
          metadata: { index: i },
          source: 'user' as const,
          distance: i * 0.05,
        }),
      );

      (embeddingsServiceMock.embedText as jest.Mock).mockResolvedValueOnce(
        mockEmbeddingVector,
      );
      (
        voiceProfileRepositoryMock.queryNearestByUser as jest.Mock
      ).mockResolvedValueOnce(mockEmbeddings);
      (
        voiceProfileRepositoryMock.queryNearestScriptures as jest.Mock
      ).mockResolvedValueOnce([]);

      const results = await retrieverService.retrieveRelevant(
        testUserId,
        queryText,
        retrievalLimit,
      );

      // Should return only up to the limit
      expect(results.length).toBeLessThanOrEqual(retrievalLimit);
    });

    it('should sort results by distance (closest first)', async () => {
      const queryText: string = 'Sort test';
      const retrievalLimit: number = 10;

      // Create embeddings with varying distances (intentionally out of order)
      const mockResults: MockEmbeddingResult[] = [
        {
          id: '1',
          voiceProfileId: testVoiceProfileId,
          embedding: mockEmbeddingVector,
          metadata: {},
          source: 'user',
          distance: 0.5,
        },
        {
          id: '2',
          voiceProfileId: testVoiceProfileId,
          embedding: mockEmbeddingVector,
          metadata: {},
          source: 'scripture',
          distance: 0.1,
        },
        {
          id: '3',
          voiceProfileId: testVoiceProfileId,
          embedding: mockEmbeddingVector,
          metadata: {},
          source: 'user',
          distance: 0.25,
        },
        {
          id: '4',
          voiceProfileId: testVoiceProfileId,
          embedding: mockEmbeddingVector,
          metadata: {},
          source: 'scripture',
          distance: 0.15,
        },
      ];

      (embeddingsServiceMock.embedText as jest.Mock).mockResolvedValueOnce(
        mockEmbeddingVector,
      );
      (
        voiceProfileRepositoryMock.queryNearestByUser as jest.Mock
      ).mockResolvedValueOnce(mockResults.filter((r) => r.source === 'user'));
      (
        voiceProfileRepositoryMock.queryNearestScriptures as jest.Mock
      ).mockResolvedValueOnce(
        mockResults.filter((r) => r.source === 'scripture'),
      );

      const results = await retrieverService.retrieveRelevant(
        testUserId,
        queryText,
        retrievalLimit,
      );

      // Verify results are sorted by distance (smallest distance first = most similar)
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].distance).toBeLessThanOrEqual(
          results[i + 1].distance,
        );
      }
    });

    it('should handle embeddings service errors gracefully', async () => {
      const queryText: string = 'Error test';
      const retrievalLimit: number = 5;

      (embeddingsServiceMock.embedText as jest.Mock).mockRejectedValueOnce(
        new Error('Embeddings API failed'),
      );

      await expect(
        retrieverService.retrieveRelevant(
          testUserId,
          queryText,
          retrievalLimit,
        ),
      ).rejects.toThrow('Embeddings API failed');
    });

    it('should handle repository query errors gracefully', async () => {
      const queryText: string = 'Error test';
      const retrievalLimit: number = 5;

      (embeddingsServiceMock.embedText as jest.Mock).mockResolvedValueOnce(
        mockEmbeddingVector,
      );
      (
        voiceProfileRepositoryMock.queryNearestByUser as jest.Mock
      ).mockRejectedValueOnce(new Error('Database query failed'));

      await expect(
        retrieverService.retrieveRelevant(
          testUserId,
          queryText,
          retrievalLimit,
        ),
      ).rejects.toThrow('Database query failed');
    });
  });

  describe('retrieveRelevant() - Integration behavior', () => {
    it('should provide contextual information for RAG-augmented generation', async () => {
      const queryText: string = 'How do we respond to crisis in ministry?';
      const retrievalLimit: number = 5;

      // Simulate realistic retrieval results
      const userContext: MockEmbeddingResult[] = [
        {
          id: 'user-voice-1',
          voiceProfileId: testVoiceProfileId,
          embedding: mockEmbeddingVector,
          metadata: {
            source: 'voice_profile',
            text_excerpt:
              'When crisis comes, we must rely on the Holy Spirit...',
          },
          source: 'user',
          distance: 0.08,
        },
      ];

      const scriptureContext: MockEmbeddingResult[] = [
        {
          id: 'scripture-1',
          voiceProfileId: testVoiceProfileId,
          embedding: mockEmbeddingVector,
          metadata: {
            scripture_ref: 'Philippians 4:6-7',
            text: 'Do not be anxious about anything...',
          },
          source: 'scripture',
          distance: 0.12,
        },
        {
          id: 'scripture-2',
          voiceProfileId: testVoiceProfileId,
          embedding: mockEmbeddingVector,
          metadata: {
            scripture_ref: 'Psalm 27:10',
            text: 'Though my father and mother forsake me...',
          },
          source: 'scripture',
          distance: 0.19,
        },
      ];

      (embeddingsServiceMock.embedText as jest.Mock).mockResolvedValueOnce(
        mockEmbeddingVector,
      );
      (
        voiceProfileRepositoryMock.queryNearestByUser as jest.Mock
      ).mockResolvedValueOnce(userContext);
      (
        voiceProfileRepositoryMock.queryNearestScriptures as jest.Mock
      ).mockResolvedValueOnce(scriptureContext);

      const results = await retrieverService.retrieveRelevant(
        testUserId,
        queryText,
        retrievalLimit,
      );

      // Verify results can be used for RAG context injection
      expect(results).toHaveLength(3);
      expect(results.some((r) => r.source === 'user')).toBe(true);
      expect(results.some((r) => r.source === 'scripture')).toBe(true);

      // Verify metadata is preserved for prompt injection
      const userResult = results.find((r) => r.source === 'user');
      expect(userResult?.metadata).toHaveProperty('text_excerpt');

      const scriptureResult = results.find((r) => r.source === 'scripture');
      expect(scriptureResult?.metadata).toHaveProperty('scripture_ref');
    });
  });
});
