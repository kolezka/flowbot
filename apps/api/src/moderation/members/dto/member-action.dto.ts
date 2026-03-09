import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';

export class WarnMemberDto {
  @ApiProperty({ required: false, description: 'Reason for the warning' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class MuteMemberDto {
  @ApiProperty({ description: 'Mute duration in seconds', minimum: 60 })
  @IsInt()
  @Min(60)
  duration: number;

  @ApiProperty({ required: false, description: 'Reason for the mute' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class BanMemberDto {
  @ApiProperty({ required: false, description: 'Reason for the ban' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class MemberActionResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;
}
