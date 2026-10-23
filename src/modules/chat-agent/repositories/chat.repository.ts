import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../../prisma.service';
import { CreateChatSessionDto } from '../dto/create-chat-session.dto';
import { ChatSessionModel } from '../models/chat-session.model';
import { ChatMessageModel } from '../models/chat-message.model';

@Injectable()
export class ChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: string, dto: CreateChatSessionDto): Promise<ChatSessionModel> {
    const session = await this.prisma.chatSession.create({
      data: {
        userId,
        title: dto.title,
        metadata: dto.metadata,
      },
    });
    return plainToInstance(ChatSessionModel, session);
  }

  async getSession(id: string, userId: string): Promise<ChatSessionModel | null> {
    const session = await this.prisma.chatSession.findFirst({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return session ? plainToInstance(ChatSessionModel, session) : null;
  }

  async getUserSessions(userId: string): Promise<ChatSessionModel[]> {
    const sessions = await this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return plainToInstance(ChatSessionModel, sessions);
  }

  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: Record<string, any>,
  ): Promise<ChatMessageModel> {
    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    const message = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role,
        content,
        metadata,
      },
    });
    return plainToInstance(ChatMessageModel, message);
  }

  async updateSessionTitle(id: string, userId: string, title: string): Promise<ChatSessionModel> {
    const session = await this.prisma.chatSession.update({
      where: { id, userId },
      data: { title },
    });
    return plainToInstance(ChatSessionModel, session);
  }

  async archiveSession(id: string, userId: string): Promise<ChatSessionModel> {
    const session = await this.prisma.chatSession.update({
      where: { id, userId },
      data: { status: 'archived' },
    });
    return plainToInstance(ChatSessionModel, session);
  }

  async deleteSession(id: string, userId: string): Promise<ChatSessionModel> {
    // Delete all messages in the session first (in case of foreign key constraints)
    await this.prisma.chatMessage.deleteMany({
      where: { sessionId: id },
    });

    // Then delete the session itself
    const session = await this.prisma.chatSession.delete({
      where: { id, userId },
    });
    return plainToInstance(ChatSessionModel, session);
  }
}
