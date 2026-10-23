import { ApiProperty } from '@nestjs/swagger';

export class BookDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  source!: string;

  @ApiProperty({ required: false })
  fileName?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ required: false })
  embeddingCount?: number;
}

export class BooksResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: [BookDto] })
  books!: BookDto[];
}

export class BookStatsDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  source!: string;

  @ApiProperty({ required: false })
  fileName?: string | null;

  @ApiProperty()
  embeddingCount!: number;

  @ApiProperty()
  createdAt!: Date;
}

export class BookStatsResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  totalBooks!: number;

  @ApiProperty()
  totalEmbeddings!: number;

  @ApiProperty({ type: [BookStatsDto] })
  books!: BookStatsDto[];
}

export class DeleteBookResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  bookId!: string;
}
