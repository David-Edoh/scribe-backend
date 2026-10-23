import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateChatSessionDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  title?: string;

  @IsOptional()
  @ApiProperty({ required: false })
  metadata?: Record<string, any>;
}
