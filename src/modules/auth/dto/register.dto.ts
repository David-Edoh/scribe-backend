import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @IsEmail()
  @ApiProperty({ format: 'email' })
  email!: string;

  @IsString()
  @MinLength(6)
  @ApiProperty({ minLength: 6 })
  password!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  displayName!: string;
}
