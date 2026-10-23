import { Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../../prisma.service';
import { BookModel } from '../models/book.model';

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new book record
   */
  async createBook(data: {
    voiceProfileId: string;
    userId: string;
    title: string;
    source?: string;
    fileName?: string;
  }): Promise<BookModel> {
    this.logger.debug('Creating book:', data);

    const book = await this.prisma.book.create({
      data: {
        voiceProfileId: data.voiceProfileId,
        userId: data.userId,
        title: data.title,
        source: data.source || 'interview',
        fileName: data.fileName,
      },
    });

    return plainToInstance(BookModel, book);
  }

  /**
   * Get a book by ID
   */
  async getBook(bookId: string, userId: string): Promise<BookModel | null> {
    const book = await this.prisma.book.findFirst({
      where: {
        id: bookId,
        userId,
      },
      include: {
        embeddings: {
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
    });

    return book ? plainToInstance(BookModel, book) : null;
  }

  /**
   * Get all books for a voice profile
   */
  async getBooksByVoiceProfile(voiceProfileId: string, userId: string): Promise<BookModel[]> {
    const books = await this.prisma.book.findMany({
      where: {
        voiceProfileId,
        userId,
      },
      include: {
        embeddings: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return plainToInstance(BookModel, books);
  }

  /**
   * Delete a book and its associated embeddings
   * Embeddings are cascade-deleted by Prisma due to onDelete: Cascade
   */
  async deleteBook(bookId: string, userId: string): Promise<BookModel> {
    this.logger.debug('Deleting book:', { bookId, userId });

    const book = await this.prisma.book.findFirst({
      where: {
        id: bookId,
        userId,
      },
    });

    if (!book) {
      throw new Error('Book not found or does not belong to user');
    }

    // Delete the book - embeddings will be cascade-deleted
    const deletedBook = await this.prisma.book.delete({
      where: {
        id: bookId,
      },
    });

    this.logger.debug('Book deleted successfully:', deletedBook.id);
    return plainToInstance(BookModel, deletedBook);
  }

  /**
   * Get book statistics for a voice profile
   */
  async getBookStats(voiceProfileId: string, userId: string) {
    const books = await this.prisma.book.findMany({
      where: {
        voiceProfileId,
        userId,
      },
      include: {
        embeddings: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      totalBooks: books.length,
      totalEmbeddings: books.reduce(
        (sum, book) => sum + book.embeddings.length,
        0,
      ),
      books: books.map((book) => ({
        id: book.id,
        title: book.title,
        source: book.source,
        fileName: book.fileName,
        embeddingCount: book.embeddings.length,
        createdAt: book.createdAt,
      })),
    };
  }
}
