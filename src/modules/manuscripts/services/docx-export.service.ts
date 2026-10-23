import { Injectable } from '@nestjs/common';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';

interface ChapterContent {
  title: string;
  content: string;
  voiceStyle?: string | null;
}

interface ManuscriptExportData {
  title: string;
  description?: string;
  chapters: ChapterContent[];
  voiceProfileName?: string;
  generatedDate?: string;
}

@Injectable()
export class DocxExportService {
  async exportToDocx(data: ManuscriptExportData): Promise<Buffer> {
    const sections: Paragraph[] = [];

    // Title page
    sections.push(
      new Paragraph({
        text: data.title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
    );

    if (data.description) {
      sections.push(
        new Paragraph({
          text: data.description,
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
        }),
      );
    }

    if (data.voiceProfileName) {
      sections.push(
        new Paragraph({
          text: `By ${data.voiceProfileName}`,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
      );
    }

    if (data.generatedDate) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated: ${data.generatedDate}`,
              italics: true,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 800 },
        }),
      );
    }

    // Page break after title
    sections.push(new Paragraph({ text: '', pageBreakBefore: true }));

    // Chapters
    data.chapters.forEach((chapter, idx) => {
      // Chapter heading
      sections.push(
        new Paragraph({
          text: `Chapter ${idx + 1}: ${chapter.title}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 },
        }),
      );

      if (chapter.voiceStyle) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `[${chapter.voiceStyle} Voice]`,
                italics: true,
              }),
            ],
            spacing: { after: 200 },
          }),
        );
      }

      // Split chapter content by paragraphs and add them
      const paragraphs = chapter.content.split('\n\n').filter((p) => p.trim());

      paragraphs.forEach((para) => {
        sections.push(
          new Paragraph({
            text: para.trim(),
            spacing: { after: 200 },
            alignment: AlignmentType.JUSTIFIED,
          }),
        );
      });

      // Add spacing between chapters
      if (idx < data.chapters.length - 1) {
        sections.push(new Paragraph({ text: '', pageBreakBefore: true }));
      }
    });

    const doc = new Document({
      sections: [{ children: sections }],
    });

    const buffer = await Packer.toBuffer(doc);
    return buffer;
  }

  async saveDocxFile(
    data: ManuscriptExportData,
    outputPath: string,
  ): Promise<string> {
    const buffer = await this.exportToDocx(data);
    const fullPath = path.resolve(outputPath);

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, buffer);
    return fullPath;
  }
}
