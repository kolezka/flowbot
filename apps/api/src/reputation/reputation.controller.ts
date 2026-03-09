import {
  Controller,
  Get,
  Param,
  Query,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ReputationService } from './reputation.service';
import { ReputationResponseDto, LeaderboardResponseDto } from './dto';

@ApiTags('reputation')
@Controller('api/reputation')
export class ReputationController {
  constructor(private readonly reputationService: ReputationService) {}

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get reputation leaderboard' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns top members by reputation score',
    type: LeaderboardResponseDto,
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Max entries to return (default 50)' })
  @ApiQuery({ name: 'groupId', required: false, description: 'Filter by group ID' })
  async getLeaderboard(
    @Query('limit') limit?: string,
    @Query('groupId') groupId?: string,
  ): Promise<LeaderboardResponseDto> {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.reputationService.getLeaderboard(
      Math.min(Math.max(parsedLimit, 1), 100),
      groupId || undefined,
    );
  }

  @Get(':telegramId')
  @ApiOperation({ summary: 'Get reputation score for a user by Telegram ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns reputation score and breakdown',
    type: ReputationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No reputation data found for this user',
  })
  @ApiParam({ name: 'telegramId', description: 'Telegram user ID' })
  async getReputation(
    @Param('telegramId') telegramId: string,
  ): Promise<ReputationResponseDto> {
    return this.reputationService.getByTelegramId(telegramId);
  }
}
