import { Expose, Type } from 'class-transformer';
import { IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { ChatMessageModel } from './chat-message.model';

export class ChatSessionModel {
  @IsString()
  @IsOptional()
  @Expose()
  id?: string;

  @IsString()
  @Expose()
  userId!: string;

  @IsOptional()
  @IsString()
  @Expose()
  title?: string | null;

  @IsString()
  @Expose()
  status!: string;

  @IsOptional()
  @Expose()
  metadata?: any;

  @IsOptional()
  @Expose()
  createdAt?: Date;

  @IsOptional()
  @Expose()
  updatedAt?: Date;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageModel)
  @IsOptional()
  @Expose()
  messages?: ChatMessageModel[];
}
