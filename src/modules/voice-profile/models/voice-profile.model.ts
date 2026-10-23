import { Expose } from 'class-transformer';
import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export class VoiceProfileModel {
  @IsString()
  @IsOptional()
  @Expose()
  id?: string;

  @IsString()
  @Expose()
  userId!: string;

  @IsString()
  @Expose()
  name!: string; // e.g., "Prophetic Voice", "Apostolic Voice"

  @IsOptional()
  @IsString()
  @Expose()
  biography?: string | null;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @Expose()
  signaturePhrases?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @Expose()
  anchorScriptures?: string[];

  // Structured extraction fields – each stored in its own column
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @Expose()
  voiceThemes?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @Expose()
  toneMarkers?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @Expose()
  keyMessages?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @Expose()
  recurringMotifs?: string[];

  @IsObject()
  @IsOptional()
  @Expose()
  writingStyle?: any;

  @IsOptional()
  @IsString()
  @Expose()
  ministryDNA?: string | null;

  // Legacy fields retained for backward compatibility with older profiles
  @IsOptional()
  @IsString()
  @Expose()
  theologicalFramework?: string | null;

  @IsOptional()
  @IsString()
  @Expose()
  sampleTexts?: string | null;

  @IsOptional()
  @Expose()
  createdAt?: Date;

  @IsOptional()
  @Expose()
  updatedAt?: Date;
}
