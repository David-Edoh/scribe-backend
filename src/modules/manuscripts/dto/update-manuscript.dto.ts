import { IsOptional, IsString, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateManuscriptDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  title?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  description?: string;

    @IsOptional()
    @IsObject()
    @ApiProperty({ required: false })
  outline?: Record<string, any>;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  status?: string;
}
