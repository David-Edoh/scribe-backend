import { Expose } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class ChapterModel {
  @IsString()
  @IsOptional()
  @Expose()
  id?: string;

  @IsString()
  @Expose()
  manuscriptId!: string;

  @IsString()
  @Expose()
  title!: string;

  @IsOptional()
  @IsString()
  @Expose()
  outlineSection?: string | null;

  @IsInt()
  @Expose()
  order!: number;

  @IsOptional()
  @IsString()
  @Expose()
  content?: string | null;

  @IsOptional()
  @IsString()
  @Expose()
  generatedFrom?: string | null;

  @IsOptional()
  @IsString()
  @Expose()
  voiceStyle?: string | null;

  @IsString()
  @Expose()
  status!: string;

  @IsOptional()
  @Expose()
  createdAt?: Date;

  @IsOptional()
  @Expose()
  updatedAt?: Date;
}
