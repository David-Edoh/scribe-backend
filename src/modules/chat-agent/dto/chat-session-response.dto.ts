export class ChatMessageResponseDto {
  id!: string;
  role!: 'user' | 'assistant';
  content!: string;
  metadata?: Record<string, any>;
  createdAt!: Date;
}

export class ChatSessionResponseDto {
  id!: string;
  title?: string;
  status!: string;
  createdAt!: Date;
  updatedAt!: Date;
  messages?: ChatMessageResponseDto[];
}
