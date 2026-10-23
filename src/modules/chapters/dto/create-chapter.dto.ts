import { ApiProperty } from '@nestjs/swagger';

export class CreateChapterDto {
  @ApiProperty()
  title: string = '';

  @ApiProperty({ required: false })
  outlineSection?: string;

  @ApiProperty()
  order: number = 0;

  @ApiProperty({ required: false })
  voiceStyle?: string;
}
