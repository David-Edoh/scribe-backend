import { IsString, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class TextChunkDto {
  @IsString()
  @ApiProperty()
  fileName!: string;

  @IsString()
  @ApiProperty()
  content!: string;
}

export class UploadPreviousWorksDto {
  @IsString()
  @ApiProperty()
  voiceProfileId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TextChunkDto)
  @ApiProperty({ type: TextChunkDto, isArray: true })
  chunks!: TextChunkDto[];

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, format: 'uuid' })
  userId?: string;
}
