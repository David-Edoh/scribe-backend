import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../../prisma.service';
import { CreateChapterDto } from '../dto/create-chapter.dto';
import { UpdateChapterDto } from '../dto/update-chapter.dto';
import { ChapterModel } from '../models/chapter.model';
import {
  createChapter,
  deleteChapter,
  getChapter,
  reorderChapters,
  updateChapter,
} from './chapter-service.helpers';

@Injectable()
export class ChapterService {
  constructor(private readonly prisma: PrismaService) {}

  async createChapter(manuscriptId: string, dto: CreateChapterDto): Promise<ChapterModel> {
    const chapter = await createChapter(this.prisma, manuscriptId, dto);
    return plainToInstance(ChapterModel, chapter);
  }

  async getChapter(id: string): Promise<ChapterModel | null> {
    const chapter = await getChapter(this.prisma, id);
    return chapter ? plainToInstance(ChapterModel, chapter) : null;
  }

  async updateChapter(id: string, dto: UpdateChapterDto): Promise<ChapterModel> {
    const chapter = await updateChapter(this.prisma, id, dto);
    return plainToInstance(ChapterModel, chapter);
  }

  async reorderChapters(
    manuscriptId: string,
    chapters: Array<{ id: string; order: number }>,
  ) {
    // reorderChapters returns a manuscript with updated chapters/versions
    return reorderChapters(this.prisma, manuscriptId, chapters);
  }

  async deleteChapter(id: string): Promise<ChapterModel> {
    const chapter = await deleteChapter(this.prisma, id);
    return plainToInstance(ChapterModel, chapter);
  }
}
