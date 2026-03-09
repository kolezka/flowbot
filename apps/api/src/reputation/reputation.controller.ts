import {
  Controller,
  Get,
  Param,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ReputationService } from './reputation.service';
import { ReputationResponseDto } from './dto';

@ApiTags('reputation')
@Controller('api/reputation')
export class ReputationController {
  constructor(private readonly reputationService: ReputationService) {}

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
