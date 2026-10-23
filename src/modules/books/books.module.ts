import { Module } from '@nestjs/common';
import { BooksService } from './services/books.service';
import { BooksController } from './controllers/books.controller';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [BooksController],
  providers: [BooksService],
  exports: [BooksService],
})
export class BooksModule {}
