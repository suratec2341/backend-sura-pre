import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  idToken!: string;
}

export class FacebookLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  accessToken!: string;
}

export class AppleLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  identityToken!: string;
}

export class VerifyTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  token!: string;
}
