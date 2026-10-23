import { Expose } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class ChapterVersionModel {
  @IsString()
  @IsOptional()
  @Expose()
  id?: string;

  @IsString()
  @Expose()
  chapterId!: string;

  @IsInt()
  @Expose()
  versionNum!: number;

  @IsString()
  @Expose()
  content!: string;

  @IsOptional()
  @Expose()
  createdAt?: Date;
}
