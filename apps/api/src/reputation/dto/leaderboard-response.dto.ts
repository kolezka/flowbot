import { ApiProperty } from '@nestjs/swagger';
import { LeaderboardEntryDto } from './leaderboard-entry.dto';

export class LeaderboardStatsDto {
  @ApiProperty({ description: 'Average reputation score', example: 150.5 })
  averageScore: number;

  @ApiProperty({ description: 'Median reputation score', example: 120 })
  medianScore: number;
}

export class LeaderboardResponseDto {
  @ApiProperty({ type: [LeaderboardEntryDto] })
  entries: LeaderboardEntryDto[];

  @ApiProperty({ description: 'Total scored members', example: 100 })
  total: number;

  @ApiProperty({ type: LeaderboardStatsDto })
  stats: LeaderboardStatsDto;
}
