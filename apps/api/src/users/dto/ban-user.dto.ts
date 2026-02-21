import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class BanUserDto {
  @ApiProperty({
    description: 'Whether to ban or unban the user',
    example: true,
  })
  @IsBoolean()
  isBanned!: boolean;

  @ApiProperty({ description: 'Reason for banning', required: false })
  @IsOptional()
  @IsString()
  banReason?: string;
}
