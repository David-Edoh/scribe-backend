import { PrismaService } from '../../../prisma.service';
import { UpdateManuscriptDto } from '../dto/update-manuscript.dto';

export function buildManuscriptUpdateData(dto: UpdateManuscriptDto) {
  const updateData: Record<string, any> = {};

  if (dto.title !== undefined) updateData.title = dto.title;
  if (dto.description !== undefined) updateData.description = dto.description;
  if (dto.status !== undefined) updateData.status = dto.status;
  if (dto.outline !== undefined) {
    updateData.outline = dto.outline;
  }

  return updateData;
}

export function logManuscriptUpdateResult(updated: any) {
  console.log('Manuscript updated successfully');
  console.log('Returned outline:', JSON.stringify(updated?.outline, null, 2));
  console.log(
    'Returned chapters from table:',
    (updated as any).chapters?.map((chapter: any) => ({
      id: chapter.id,
      title: chapter.title,
      order: chapter.order,
    })),
  );
}

export async function refetchManuscriptWithChapters(
  prisma: PrismaService,
  id: string,
) {
  return prisma.manuscript.findUnique({
    where: { id },
    include: {
      chapters: { orderBy: { order: 'asc' } },
    },
  });
}
