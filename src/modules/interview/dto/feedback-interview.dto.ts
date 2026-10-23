import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FeedbackInterviewDto {
  @IsString()
  @ApiProperty({ description: 'The interview question field ID (e.g. "ministryCalling")' })
  questionId!: string;

  @IsString()
  @ApiProperty({ description: 'Human-readable question title' })
  questionTitle!: string;

  @IsString()
  @ApiProperty({ description: 'The current text the author has typed' })
  answer!: string;
}
