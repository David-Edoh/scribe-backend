import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { ManuscriptModule } from '../manuscripts/manuscript.module';
import { ChapterController } from './controllers/chapter.controller';
import { ChapterManagementController } from './controllers/chapter-management.controller';
import { ChapterService } from './services/chapter.service';

@Module({
  imports: [CommonModule, ManuscriptModule],
  controllers: [ChapterController, ChapterManagementController],
  providers: [ChapterService],
  exports: [ChapterService],
})
export class ChapterModule {}
