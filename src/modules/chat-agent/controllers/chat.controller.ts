import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ChatService } from '../services/chat.service';
import { CreateChatSessionDto } from '../dto/create-chat-session.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import {
  ChatSessionResponseDto,
  ChatMessageResponseDto,
} from '../dto/chat-session-response.dto';
import {
  prepareSseResponse,
  writeSseComment,
  writeSseEvent,
} from '../../../common/utils/sse.util';

@ApiBearerAuth()
@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiOperation({ summary: 'Create new chat session' })
  @ApiResponse({ status: 201, description: 'Chat session created' })
  @ApiResponse({ status: 400, description: 'Chat agent not available' })
  @Post('sessions')
  async createSession(
    @Request() req: any,
    @Body() dto: CreateChatSessionDto,
  ): Promise<ChatSessionResponseDto> {
    if (!this.chatService.isAgentAvailable()) {
      throw new BadRequestException('Chat agent is not currently available');
    }

    const session = await this.chatService.createSession(req.user.id, dto);
    return this.mapSessionToResponse(session);
  }

  @ApiOperation({ summary: 'Get all chat sessions for user' })
  @ApiResponse({ status: 200, description: 'Chat sessions retrieved' })
  @Get('sessions')
  async getUserSessions(
    @Request() req: any,
  ): Promise<ChatSessionResponseDto[]> {
    const sessions = await this.chatService.getUserSessions(req.user.id);
    return sessions.map((session) => this.mapSessionToResponse(session));
  }

  @ApiOperation({ summary: 'Get specific chat session' })
  @ApiResponse({ status: 200, description: 'Chat session retrieved' })
  @ApiResponse({ status: 404, description: 'Chat session not found' })
  @Get('sessions/:sessionId')
  async getSession(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
  ): Promise<ChatSessionResponseDto> {
    const session = await this.chatService.getSession(sessionId, req.user.id);
    if (!session) {
      throw new NotFoundException('Chat session not found');
    }
    return this.mapSessionToResponse(session);
  }

  @ApiOperation({ summary: 'Send message to chat' })
  @ApiResponse({ status: 200, description: 'Message sent and response received' })
  @ApiResponse({ status: 400, description: 'Chat agent not available' })
  @Post('messages')
  async sendMessage(
    @Request() req: any,
    @Body() dto: SendMessageDto,
  ): Promise<{
    userMessage: ChatMessageResponseDto;
    assistantMessage: ChatMessageResponseDto;
  }> {
    if (!this.chatService.isAgentAvailable()) {
      throw new BadRequestException('Chat agent is not currently available');
    }

    try {
      // Pass user context including voice profile for agent personalization
      const result = await this.chatService.sendMessage(req.user.id, dto, {
        userId: req.user.id,
        userEmail: req.user.email,
        voiceProfileId: dto.voiceProfileId,
        manuscriptContext: dto.metadata?.manuscriptContext,
        frontendActions: dto.metadata?.frontendActions,
      });
      return {
        userMessage: this.mapMessageToResponse(result.userMessage),
        assistantMessage: this.mapMessageToResponse(result.assistantMessage),
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'Session not found') {
        throw new NotFoundException('Chat session not found');
      }
      throw error;
    }
  }

  @Post('messages/stream')
  async streamMessage(
    @Request() req: any,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.chatService.isAgentAvailable()) {
      throw new BadRequestException('Chat agent is not currently available');
    }

    prepareSseResponse(res);
    writeSseComment(res, 'scribe-stream-open');

    try {
      for await (const event of this.chatService.sendMessageStream(
        req.user.id,
        dto,
        {
          userId: req.user.id,
          userEmail: req.user.email,
          voiceProfileId: dto.voiceProfileId,
          manuscriptContext: dto.metadata?.manuscriptContext,
          frontendActions: dto.metadata?.frontendActions,
        },
      )) {
        if (res.destroyed) return;

        if (event.type === 'user-message') {
          writeSseEvent(res, {
            event: 'user-message',
            data: {
              userMessage: this.mapMessageToResponse(event.userMessage),
            },
          });
        } else if (event.type === 'assistant-delta') {
          writeSseEvent(res, {
            event: 'assistant-delta',
            data: { content: event.content },
          });
        } else if (event.type === 'assistant-status') {
          writeSseEvent(res, {
            event: 'assistant-status',
            data: { message: event.message, toolName: event.toolName },
          });
        } else if (event.type === 'assistant-message') {
          writeSseEvent(res, {
            event: 'assistant-message',
            data: {
              assistantMessage: this.mapMessageToResponse(
                event.assistantMessage,
              ),
            },
          });
        }
      }

      writeSseEvent(res, { event: 'done', data: { ok: true } });
      res.end();
    } catch (error) {
      if (error instanceof Error && error.message === 'Session not found') {
        writeSseEvent(res, {
          event: 'error',
          data: { message: 'Chat session not found' },
        });
      } else {
        writeSseEvent(res, {
          event: 'error',
          data: {
            message:
              error instanceof Error
                ? error.message
                : 'Failed to stream assistant response',
          },
        });
      }
      res.end();
    }
  }

  @Patch('sessions/:sessionId/title')
  async updateSessionTitle(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
    @Body() body: { title: string },
  ): Promise<ChatSessionResponseDto> {
    if (!body.title) {
      throw new BadRequestException('Title is required');
    }

    const session = await this.chatService.updateSessionTitle(
      req.user.id,
      sessionId,
      body.title,
    );
    return this.mapSessionToResponse(session);
  }

  @Patch('sessions/:sessionId/archive')
  async archiveSession(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
  ): Promise<ChatSessionResponseDto> {
    const session = await this.chatService.archiveSession(
      req.user.id,
      sessionId,
    );
    return this.mapSessionToResponse(session);
  }

  @Delete('sessions/:sessionId')
  async deleteSession(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
  ): Promise<{ success: boolean }> {
    await this.chatService.deleteSession(req.user.id, sessionId);
    return { success: true };
  }

  private mapSessionToResponse(session: any): ChatSessionResponseDto {
    return {
      id: session.id,
      title: session.title,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages?.map((msg: any) =>
        this.mapMessageToResponse(msg),
      ),
    };
  }

  private mapMessageToResponse(message: any): ChatMessageResponseDto {
    return {
      id: message.id,
      role: message.role as 'user' | 'assistant',
      content: message.content,
      metadata: message.metadata,
      createdAt: message.createdAt,
    };
  }
}
