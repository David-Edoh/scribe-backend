import { IsString, MinLength, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @IsString()
  @ApiProperty()
  sessionId!: string;

  @IsString()
  @MinLength(1)
  @ApiProperty()
  content!: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, format: 'uuid' })
  voiceProfileId?: string;

  @IsOptional()
  @IsObject()
  @ApiProperty({ required: false })
  metadata?: Record<string, any>;
}
