import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingsService } from '../src/modules/embeddings.service';
import { VoiceProfileRepository } from '../src/modules/voice-profile/voice-profile.repository';

/**
 * Unit tests for the EmbeddingsService
 * Tests embedding generation and storage with mocked Gemini API
 */
describe('EmbeddingsService (Unit Tests)', () => {
  let embeddingsService: EmbeddingsService;
  let voiceProfileRepositoryMock: jest.Mocked<VoiceProfileRepository>;

  // Mock environment variables for Gemini
  const mockGeminiUrl: string = 'https://api.gemini.example.com/embeddings';
  const mockGeminiApiKey: string = 'test-api-key-12345';

  // Mock embedding vector (1536 dimensions - typical for Gemini embedding model)
  const mockEmbeddingVector: number[] = Array.from({ length: 1536 }, () =>
    Math.random(),
  );

  beforeEach(async () => {
    // Set environment variables
    process.env.GEMINI_EMBEDDINGS_URL = mockGeminiUrl;
    process.env.GEMINI_API_KEY = mockGeminiApiKey;

    // Mock the VoiceProfileRepository
    voiceProfileRepositoryMock = {
      addEmbedding: jest.fn().mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174000',
        voiceProfileId: '123e4567-e89b-12d3-a456-426614174111',
        embedding: mockEmbeddingVector,
        metadata: {},
        createdAt: new Date(),
      }),
    } as any;

    // Mock fetch globally
    global.fetch = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingsService,
        {
          provide: VoiceProfileRepository,
          useValue: voiceProfileRepositoryMock,
        },
      ],
    }).compile();

    embeddingsService = module.get<EmbeddingsService>(EmbeddingsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('embedText()', () => {
    it('should successfully embed a single text string', async () => {
      const textToEmbed: string =
        'Thus says the Lord, your God is mighty and faithful.';

      // Mock successful Gemini API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          predictions: [
            {
              embedding: mockEmbeddingVector,
            },
          ],
        }),
      });

      const result: number[] = await embeddingsService.embedText(textToEmbed);

      expect(result).toEqual(mockEmbeddingVector);
      expect(result.length).toBe(1536);
      expect(global.fetch).toHaveBeenCalledWith(
        mockGeminiUrl,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockGeminiApiKey}`,
          },
          body: JSON.stringify({ instances: [{ content: textToEmbed }] }),
        }),
      );
    });

    it('should handle different Gemini API response shapes', async () => {
      const textToEmbed: string = 'Sample prophetic text for embedding.';

      // Test with alternative response shape (direct embedding field)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          embedding: mockEmbeddingVector,
        }),
      });

      const result: number[] = await embeddingsService.embedText(textToEmbed);

      expect(result).toEqual(mockEmbeddingVector);
    });

    it('should throw error if GEMINI_EMBEDDINGS_URL or GEMINI_API_KEY is missing', async () => {
      const originalUrl = process.env.GEMINI_EMBEDDINGS_URL;
      delete process.env.GEMINI_EMBEDDINGS_URL;

      const textToEmbed: string = 'Test text';

      await expect(embeddingsService.embedText(textToEmbed)).rejects.toThrow(
        'Gemini embeddings not configured',
      );

      process.env.GEMINI_EMBEDDINGS_URL = originalUrl;
    });

    it('should throw error if API response is invalid', async () => {
      const textToEmbed: string = 'Test text';

      // Mock invalid API response (no embedding field)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          error: 'Invalid request',
        }),
      });

      await expect(embeddingsService.embedText(textToEmbed)).rejects.toThrow(
        'Invalid embedding response',
      );
    });

    it('should handle API errors gracefully', async () => {
      const textToEmbed: string = 'Test text';

      // Mock network error
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error'),
      );

      await expect(embeddingsService.embedText(textToEmbed)).rejects.toThrow(
        'Network error',
      );
    });
  });

  describe('embedMany()', () => {
    it('should embed multiple texts and return array of vectors', async () => {
      const textsToEmbed: string[] = [
        'First prophetic text.',
        'Second apostolic text.',
        'Third Spirit-filled text.',
      ];

      // Mock Gemini API responses for each text
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          json: async () => ({
            predictions: [{ embedding: mockEmbeddingVector }],
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            predictions: [{ embedding: mockEmbeddingVector }],
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            predictions: [{ embedding: mockEmbeddingVector }],
          }),
        });

      const results: number[][] =
        await embeddingsService.embedMany(textsToEmbed);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual(mockEmbeddingVector);
      expect(results[1]).toEqual(mockEmbeddingVector);
      expect(results[2]).toEqual(mockEmbeddingVector);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle empty array input', async () => {
      const emptyTexts: string[] = [];

      const results: number[][] = await embeddingsService.embedMany(emptyTexts);

      expect(results).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('embedAndStoreForVoiceProfile()', () => {
    it('should embed texts and store embeddings for a voice profile', async () => {
      const voiceProfileId: string = '123e4567-e89b-12d3-a456-426614174111';
      const textsToEmbed: string[] = ['Sample text 1', 'Sample text 2'];
      const metadata: Record<string, string> = { type: 'voice_profile_sample' };

      // Mock Gemini API responses
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          json: async () => ({
            predictions: [{ embedding: mockEmbeddingVector }],
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            predictions: [{ embedding: mockEmbeddingVector }],
          }),
        });

      const results = await embeddingsService.embedAndStoreForVoiceProfile(
        voiceProfileId,
        textsToEmbed,
        metadata,
      );

      // Verify repository was called with correct parameters
      expect(voiceProfileRepositoryMock.addEmbedding).toHaveBeenCalledTimes(2);
      expect(voiceProfileRepositoryMock.addEmbedding).toHaveBeenCalledWith(
        voiceProfileId,
        mockEmbeddingVector,
        expect.objectContaining({
          type: 'voice_profile_sample',
          index: expect.any(Number),
        }),
      );

      expect(results).toHaveLength(2);
    });

    it('should include correct metadata with index for each embedding', async () => {
      const voiceProfileId: string = '123e4567-e89b-12d3-a456-426614174111';
      const textsToEmbed: string[] = ['Text A', 'Text B', 'Text C'];
      const metadata: Record<string, string> = { source: 'interview' };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          json: async () => ({
            predictions: [{ embedding: mockEmbeddingVector }],
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            predictions: [{ embedding: mockEmbeddingVector }],
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            predictions: [{ embedding: mockEmbeddingVector }],
          }),
        });

      await embeddingsService.embedAndStoreForVoiceProfile(
        voiceProfileId,
        textsToEmbed,
        metadata,
      );

      // Verify each call has incrementing index
      const callsArgs = voiceProfileRepositoryMock.addEmbedding.mock.calls;
      expect(callsArgs[0][2]).toHaveProperty('index', 0);
      expect(callsArgs[1][2]).toHaveProperty('index', 1);
      expect(callsArgs[2][2]).toHaveProperty('index', 2);
    });
  });
});
