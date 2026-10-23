import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class VoiceProfileEmbeddingModel {
  @IsString()
  @IsOptional()
  @Expose()
  id?: string;

  @IsString()
  @Expose()
  voiceProfileId!: string;

  @IsOptional()
  @IsString()
  @Expose()
  bookId?: string | null;

  @IsOptional()
  @Expose()
  metadata?: any;

  @IsOptional()
  @Expose()
  createdAt?: Date;

  @IsOptional()
  @IsString()
  @Expose()
  sourceText?: string | null;
}
