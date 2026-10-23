import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @IsEmail()
  @ApiProperty({ format: 'email' })
  email!: string;

  @IsString()
  @ApiProperty()
  password!: string;
}
