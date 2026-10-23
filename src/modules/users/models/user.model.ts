import { Expose } from 'class-transformer';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UserModel {
  @IsString()
  @IsOptional()
  @Expose()
  id?: string;

  @IsEmail()
  @Expose()
  email!: string;

  @IsString()
  @Expose()
  passwordHash!: string;

  @IsOptional()
  @IsString()
  @Expose()
  displayName?: string | null;

  @IsOptional()
  @Expose()
  emailVerified?: boolean;

  @IsOptional()
  @IsString()
  @Expose()
  emailVerificationToken?: string | null;

  @IsOptional()
  @Expose()
  createdAt?: Date;

  @IsOptional()
  @Expose()
  updatedAt?: Date;
}
