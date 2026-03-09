import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMemberRoleDto {
  @ApiProperty({
    enum: ['member', 'moderator'],
    description: 'New role for the member',
  })
  @IsString()
  @IsIn(['member', 'moderator'])
  role: string;
}
