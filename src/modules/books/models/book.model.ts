import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class BookModel {
  @IsString()
  @IsOptional()
  @Expose()
  id?: string;

  @IsString()
  @Expose()
  voiceProfileId!: string;

  @IsString()
  @Expose()
  userId!: string;

  @IsString()
  @Expose()
  title!: string;

  @IsString()
  @Expose()
  source!: string;

  @IsOptional()
  @IsString()
  @Expose()
  fileName?: string | null;

  @IsOptional()
  @Expose()
  createdAt?: Date;
}
