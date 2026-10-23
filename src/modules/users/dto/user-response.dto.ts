import { Expose } from 'class-transformer';

export class UserResponseDto {
  @Expose()
  id!: string;

  @Expose()
  email!: string;

  @Expose()
  displayName?: string;
}
