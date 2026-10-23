import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class ScriptureEmbeddingModel {
  @IsString()
  @IsOptional()
  @Expose()
  id?: string;

  @IsString()
  @Expose()
  scriptureRef!: string;

  @IsString()
  @Expose()
  scriptureText!: string;

  @IsOptional()
  @Expose()
  metadata?: any;

  @IsOptional()
  @Expose()
  createdAt?: Date;
}
