import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateManuscriptDto {
  @IsString()
  @ApiProperty()
  title!: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  description?: string;

  @IsString()
  @ApiProperty({ format: 'uuid' })
  voiceProfileId!: string;

  @IsOptional()
  @ApiProperty({ required: false })
  outline?: Record<string, any>;
}
