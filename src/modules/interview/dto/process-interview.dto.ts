import {
  IsString,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class PreviousWorkChunkDto {
  @IsString()
  @ApiProperty()
  fileName!: string;

  @IsString()
  @ApiProperty()
  content!: string;
}

export class ProcessInterviewDto {
  @IsString()
  @ApiProperty()
  voiceProfileId!: string;

  @IsString()
  @ApiProperty()
  ministryCalling!: string;

  @IsString()
  @ApiProperty()
  signatureScriptures!: string;

  @IsString()
  @ApiProperty()
  signaturePhrases!: string;

  @IsString()
  @ApiProperty()
  personalStories!: string;

  @IsString()
  @ApiProperty()
  audience!: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  additionalContext?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviousWorkChunkDto)
  @ApiProperty({ required: false, type: PreviousWorkChunkDto, isArray: true })
  previousWorks?: PreviousWorkChunkDto[];
}
