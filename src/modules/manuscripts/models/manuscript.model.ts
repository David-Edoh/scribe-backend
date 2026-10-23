import { Expose, Type } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { ChapterModel } from '../../chapters/models/chapter.model';
import { ManuscriptVersionModel } from './manuscript-version.model';

export enum ManuscriptStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  FINAL = 'final',
}

export class ManuscriptModel {
  @IsString()
  @IsOptional()
  @Expose()
  id?: string;

  @IsString()
  @Expose()
  userId!: string;

  @IsString()
  @Expose()
  voiceProfileId!: string;

  @IsString()
  @Expose()
  title!: string;

  @IsOptional()
  @IsString()
  @Expose()
  description?: string | null;

  @IsOptional()
  @Expose()
  outline?: any;

  @IsString()
  @Expose()
  status!: string;

  @IsOptional()
  @IsString()
  @Expose()
  bookCoverUrl?: string | null;

  @IsOptional()
  @IsString()
  @Expose()
  authorName?: string;

  @IsOptional()
  @Expose()
  @Type(() => ChapterModel)
  chapters?: ChapterModel[];

  @IsOptional()
  @Expose()
  @Type(() => ManuscriptVersionModel)
  versions?: ManuscriptVersionModel[];

  @IsOptional()
  @Expose()
  createdAt?: Date;

  @IsOptional()
  @Expose()
  updatedAt?: Date;
}
