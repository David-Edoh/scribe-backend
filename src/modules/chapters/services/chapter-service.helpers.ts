import { PrismaService } from '../../../prisma.service';
import { CreateChapterDto } from '../dto/create-chapter.dto';
import { UpdateChapterDto } from '../dto/update-chapter.dto';

export async function createChapter(
  prisma: PrismaService,
  manuscriptId: string,
  dto: CreateChapterDto,
) {
  return prisma.chapter.create({
    data: {
      manuscriptId,
      title: dto.title,
      outlineSection: dto.outlineSection,
      order: dto.order,
      voiceStyle: dto.voiceStyle,
    },
  });
}

export async function getChapter(prisma: PrismaService, id: string) {
  return prisma.chapter.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function updateChapter(
  prisma: PrismaService,
  id: string,
  dto: UpdateChapterDto,
) {
  return prisma.chapter.update({
    where: { id },
    data: dto,
  });
}

export async function deleteChapter(prisma: PrismaService, id: string) {
  return prisma.chapter.delete({
    where: { id },
  });
}

export async function reorderChapters(
  prisma: PrismaService,
  manuscriptId: string,
  chapters: Array<{ id: string; order: number }>,
) {
  return prisma.$transaction(async (tx) => {
    for (let index = 0; index < chapters.length; index += 1) {
      await tx.chapter.update({
        where: { id: chapters[index].id },
        data: { order: -100000 - index },
      });
    }

    for (const chapter of chapters) {
      await tx.chapter.update({
        where: { id: chapter.id },
        data: { order: chapter.order },
      });
    }

    return tx.manuscript.findUnique({
      where: { id: manuscriptId },
      include: {
        chapters: { orderBy: { order: 'asc' } },
        versions: { orderBy: { createdAt: 'desc' } },
      },
    });
  });
}
