import { Expose } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class ManuscriptVersionModel {
  @IsString()
  @IsOptional()
  @Expose()
  id?: string;

  @IsString()
  @Expose()
  manuscriptId!: string;

  @IsString()
  @Expose()
  userId!: string;

  @IsInt()
  @Expose()
  versionNumber!: number;

  @IsString()
  @Expose()
  title!: string;

  @IsOptional()
  @IsString()
  @Expose()
  description?: string | null;

  @Expose()
  fullContent!: any;

  @IsOptional()
  @Expose()
  metadata?: any;

  @IsOptional()
  @Expose()
  createdAt?: Date;
}
