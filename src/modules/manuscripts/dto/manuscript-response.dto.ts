import { Expose } from 'class-transformer';
import { ManuscriptStatus } from '../models/manuscript.model';

export class ManuscriptResponseDto {
  @Expose()
  id!: string;

  @Expose()
  title!: string;

  @Expose()
  authorId!: string;

  @Expose()
  status!: ManuscriptStatus;

  @Expose()
  outline?: string;

  @Expose()
  content?: string;
}
