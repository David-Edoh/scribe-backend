import { IsArray, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVoiceProfileDto {
  @IsOptional()
  @IsUUID()
  @ApiProperty({ required: false, format: 'uuid' })
  userId?: string;

  @IsString()
  @ApiProperty()
  name!: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  biography?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, isArray: true, type: String })
  signaturePhrases?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, isArray: true, type: String })
  anchorScriptures?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, isArray: true, type: String })
  voiceThemes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, isArray: true, type: String })
  toneMarkers?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, isArray: true, type: String })
  keyMessages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ required: false, isArray: true, type: String })
  recurringMotifs?: string[];

  @IsOptional()
  @IsObject()
  @ApiProperty({
    required: false,
    description: 'Writing style object with tone, rhythm, and emphasis fields',
  })
  writingStyle?: {
    tone: string;
    rhythm: string;
    emphasis: string[];
  };

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  ministryDNA?: string;

  // Legacy fields retained for backward compatibility
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  theologicalFramework?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  sampleTexts?: string;
}
