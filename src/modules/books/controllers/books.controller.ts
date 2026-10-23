import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  BooksResponseDto,
  BookStatsResponseDto,
  DeleteBookResponseDto,
} from '../dto/book.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { BooksService } from '../services/books.service';

@ApiBearerAuth()
@ApiTags('Books')
@Controller('books')
@UseGuards(JwtAuthGuard)
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @ApiOperation({ summary: 'Get all books for a voice profile' })
  @ApiResponse({ status: 200, description: 'Books retrieved', type: BooksResponseDto })
  @Get('profile/:voiceProfileId')
  async getBooksByProfile(
   @Request() req: any,
   @Param('voiceProfileId') voiceProfileId: string,
  ) {
   const books = await this.booksService.getBooksByVoiceProfile(
     voiceProfileId,
     req.user.id,
   );
   return {
     success: true,
     books,
   };
  }

  @ApiOperation({ summary: 'Get book statistics for a voice profile' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved', type: BookStatsResponseDto })
  @Get('stats/:voiceProfileId')
  async getBookStats(
    @Request() req: any,
    @Param('voiceProfileId') voiceProfileId: string,
  ) {
    const stats = await this.booksService.getBookStats(
      voiceProfileId,
      req.user.id,
    );
    return {
      success: true,
      ...stats,
    };
  }

  @ApiOperation({ summary: 'Delete a book and its embeddings' })
  @ApiResponse({ status: 200, description: 'Book deleted successfully', type: DeleteBookResponseDto })
  @ApiResponse({ status: 404, description: 'Book not found' })
  @Delete(':bookId')
  async deleteBook(@Request() req: any, @Param('bookId') bookId: string) {
    try {
      const book = await this.booksService.deleteBook(bookId, req.user.id);
      return {
        success: true,
        message: `Book "${book.title}" and all its embeddings have been deleted`,
        bookId: book.id,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundException(
          'Book not found or does not belong to user',
        );
      }
      throw error;
    }
  }
}
