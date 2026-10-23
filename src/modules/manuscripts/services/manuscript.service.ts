import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../../prisma.service';
import { CreateManuscriptDto } from '../dto/create-manuscript.dto';
import { UpdateManuscriptDto } from '../dto/update-manuscript.dto';
import { ManuscriptModel } from '../models/manuscript.model';
import { ManuscriptVersionModel } from '../models/manuscript-version.model';
import {
  buildManuscriptUpdateData,
  logManuscriptUpdateResult,
  refetchManuscriptWithChapters,
} from './manuscript-service-crud.helpers';
import {
  getManuscriptVersions,
  restoreVersion,
  saveManuscriptVersion,
} from './manuscript-service-version.helpers';

@Injectable()
export class ManuscriptService {
  constructor(private prisma: PrismaService) {}

  async createManuscript(userId: string, dto: CreateManuscriptDto): Promise<ManuscriptModel> {
    if (!dto.voiceProfileId) {
      throw new Error('voiceProfileId is required');
    }

    const manuscript = await this.prisma.manuscript.create({
      data: {
        userId,
        voiceProfileId: dto.voiceProfileId,
        title: dto.title,
        description: dto.description || null,
        outline: dto.outline || {},
      },
      include: {
        chapters: true,
        versions: true,
      },
    });

    return plainToInstance(ManuscriptModel, manuscript);
  }

  async getManuscript(id: string, userId: string): Promise<ManuscriptModel | null> {
    const manuscript = await this.prisma.manuscript.findFirst({
      where: { id, userId },
      include: {
        chapters: { orderBy: { order: 'asc' } },
        versions: { orderBy: { createdAt: 'desc' } },
        voiceProfile: { select: { id: true, name: true } },
      },
    });

    if (manuscript) {
      if (manuscript.voiceProfile) {
        const mapped = {
          ...manuscript,
          authorName: manuscript.voiceProfile.name,
        };
        return plainToInstance(ManuscriptModel, mapped);
      }
      return plainToInstance(ManuscriptModel, manuscript);
    }

    return null;
  }

  async listManuscripts(userId: string): Promise<ManuscriptModel[]> {
    const manuscripts = await this.prisma.manuscript.findMany({
      where: { userId },
      include: {
        chapters: { select: { id: true, title: true, order: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return plainToInstance(ManuscriptModel, manuscripts);
  }

  async listManuscriptsByVoiceProfile(userId: string, voiceProfileId: string): Promise<ManuscriptModel[]> {
    const manuscripts = await this.prisma.manuscript.findMany({
      where: { userId, voiceProfileId },
      include: {
        chapters: { select: { id: true, title: true, order: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return plainToInstance(ManuscriptModel, manuscripts);
  }

  async updateManuscript(id: string, userId: string, dto: UpdateManuscriptDto): Promise<ManuscriptModel> {
    const updateData = buildManuscriptUpdateData(dto);

    const updated = await this.prisma.manuscript.update({
      where: { id },
      data: updateData,
      include: {
        chapters: { orderBy: { order: 'asc' } },
      },
    });

    logManuscriptUpdateResult(updated);

    const refetched = await refetchManuscriptWithChapters(this.prisma, id);
    return plainToInstance(ManuscriptModel, refetched);
  }

  async updateBookCoverUrl(id: string, bookCoverUrl: string): Promise<ManuscriptModel> {
    const manuscript = await this.prisma.manuscript.update({
      where: { id },
      data: { bookCoverUrl },
      include: {
        chapters: { orderBy: { order: 'asc' } },
        versions: { orderBy: { createdAt: 'desc' } },
      },
    });

    return plainToInstance(ManuscriptModel, manuscript);
  }

  async deleteManuscript(id: string, userId: string): Promise<ManuscriptModel> {
    const manuscript = await this.prisma.manuscript.delete({
      where: { id },
    });

    return plainToInstance(ManuscriptModel, manuscript);
  }

  async saveManuscriptVersion(
    manuscriptId: string,
    userId: string,
    manuscript: any,
    description?: string,
  ): Promise<ManuscriptVersionModel> {
    const version = await saveManuscriptVersion(
      this.prisma,
      manuscriptId,
      userId,
      manuscript,
      description,
    );

    return plainToInstance(ManuscriptVersionModel, version);
  }

  async getManuscriptVersions(manuscriptId: string, limit = 10): Promise<ManuscriptVersionModel[]> {
    const versions = await getManuscriptVersions(this.prisma, manuscriptId, limit);
    return plainToInstance(ManuscriptVersionModel, versions);
  }

  async restoreVersion(versionId: string, manuscriptId: string): Promise<ManuscriptModel> {
    const restored = await restoreVersion(this.prisma, versionId, manuscriptId);
    return plainToInstance(ManuscriptModel, restored);
  }
}
