import { ApiProperty } from '@nestjs/swagger';

export class ReputationResponseDto {
  @ApiProperty({ description: 'Telegram user ID', example: '123456789' })
  telegramId: string;

  @ApiProperty({ description: 'Total reputation score', example: 350 })
  totalScore: number;

  @ApiProperty({ description: 'Score from message activity', example: 200 })
  messageFactor: number;

  @ApiProperty({ description: 'Score from membership tenure', example: 150 })
  tenureFactor: number;

  @ApiProperty({ description: 'Penalty from warnings', example: 50 })
  warningPenalty: number;

  @ApiProperty({ description: 'Bonus from moderation role', example: 100 })
  moderationBonus: number;

  @ApiProperty({ description: 'When the score was last calculated' })
  lastCalculated: string;
}
