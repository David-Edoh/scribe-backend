import { Module } from '@nestjs/common';
import { ManuscriptController } from './controllers/manuscript.controller';
import { VersionController } from './controllers/version.controller';
import { ExportController } from './controllers/export.controller';
import { ManuscriptService } from './services/manuscript.service';
import { DocxExportService } from './services/docx-export.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [
    ManuscriptController,
    VersionController,
    ExportController,
  ],
  providers: [ManuscriptService, DocxExportService],
  exports: [ManuscriptService],
})
export class ManuscriptModule {}
