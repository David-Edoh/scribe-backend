import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateChapterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  outlineSection?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  voiceStyle?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;
}
