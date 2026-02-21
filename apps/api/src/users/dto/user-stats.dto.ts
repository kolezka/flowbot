import { ApiProperty } from '@nestjs/swagger';

export class UserStatsDto {
  @ApiProperty({ description: 'Total number of users' })
  totalUsers!: number;

  @ApiProperty({ description: 'Number of active users (seen in last 7 days)' })
  activeUsers!: number;

  @ApiProperty({ description: 'Number of banned users' })
  bannedUsers!: number;

  @ApiProperty({ description: 'Number of new users today' })
  newUsersToday!: number;

  @ApiProperty({ description: 'Number of verified users' })
  verifiedUsers!: number;

  @ApiProperty({ description: 'Total messages sent' })
  totalMessages!: number;

  @ApiProperty({ description: 'Total commands used' })
  totalCommands!: number;
}
