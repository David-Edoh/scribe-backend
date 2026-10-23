import { PrismaService } from '../../../prisma.service';

export async function saveManuscriptVersion(
  prisma: PrismaService,
  manuscriptId: string,
  userId: string,
  manuscript: any,
  description?: string,
) {
  const { chapters, ...manuscriptData } = manuscript;

  await prisma.manuscript.update({
    where: { id: manuscriptId },
    data: {
      title: manuscriptData.title,
      description: manuscriptData.description || null,
      outline: manuscriptData.outline || {},
      status: manuscriptData.status || 'draft',
    },
  });

  if (chapters && Array.isArray(chapters)) {
    for (const chapter of chapters) {
      if (chapter.id) {
        await prisma.chapter.update({
          where: { id: chapter.id },
          data: {
            title: chapter.title,
            content: chapter.content,
            status: chapter.status || 'draft',
            voiceStyle: chapter.voiceStyle,
            outlineSection: chapter.outlineSection,
          },
        });
      }
    }
  }

  const lastVersion = await prisma.manuscriptVersion.findFirst({
    where: { manuscriptId },
    orderBy: { versionNumber: 'desc' },
  });

  const versionNumber = (lastVersion?.versionNumber || 0) + 1;

  return prisma.manuscriptVersion.create({
    data: {
      manuscriptId,
      userId,
      versionNumber,
      title: manuscript.title,
      description,
      fullContent: manuscript,
    },
  });
}

export async function getManuscriptVersions(
  prisma: PrismaService,
  manuscriptId: string,
  limit = 10,
) {
  return prisma.manuscriptVersion.findMany({
    where: { manuscriptId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      versionNumber: true,
      title: true,
      description: true,
      createdAt: true,
      metadata: true,
    },
  });
}

export async function restoreVersion(
  prisma: PrismaService,
  versionId: string,
  manuscriptId: string,
) {
  const version = await prisma.manuscriptVersion.findUnique({
    where: { id: versionId },
  });

  if (!version || version.manuscriptId !== manuscriptId) {
    throw new Error('Version not found');
  }

  const content = version.fullContent as Record<string, any>;
  const { chapters, ...manuscriptData } = content;

  const restored = await prisma.manuscript.update({
    where: { id: manuscriptId },
    data: {
      title: manuscriptData.title,
      description: manuscriptData.description || null,
      outline: manuscriptData.outline || {},
      status: manuscriptData.status || 'draft',
    },
    include: {
      chapters: { orderBy: { order: 'asc' } },
    },
  });

  if (chapters && Array.isArray(chapters)) {
    for (const chapter of chapters) {
      if (chapter.id) {
        await prisma.chapter.update({
          where: { id: chapter.id },
          data: {
            title: chapter.title,
            content: chapter.content,
            status: chapter.status || 'draft',
            voiceStyle: chapter.voiceStyle,
            outlineSection: chapter.outlineSection,
          },
        });
      } else {
        await prisma.chapter.create({
          data: {
            manuscriptId,
            title: chapter.title,
            content: chapter.content,
            order: chapter.order,
            status: chapter.status || 'draft',
            voiceStyle: chapter.voiceStyle,
            outlineSection: chapter.outlineSection,
          },
        });
      }
    }
  }

  return restored;
}
