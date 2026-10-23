import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class ChatMessageModel {
  @IsString()
  @IsOptional()
  @Expose()
  id?: string;

  @IsString()
  @Expose()
  sessionId!: string;

  @IsString()
  @Expose()
  role!: string;

  @IsString()
  @Expose()
  content!: string;

  @IsOptional()
  @Expose()
  metadata?: any;

  @IsOptional()
  @Expose()
  createdAt?: Date;
}
