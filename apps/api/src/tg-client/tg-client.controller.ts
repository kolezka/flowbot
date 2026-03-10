import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TgClientService } from './tg-client.service';
import {
  StartAuthDto,
  SubmitCodeDto,
  SubmitPasswordDto,
  UpdateSessionDto,
} from './dto';

@ApiTags('TG Client')
@Controller('api/tg-client')
export class TgClientController {
  constructor(private readonly service: TgClientService) {}

  @Get('sessions')
  @ApiOperation({ summary: 'List all TG client sessions' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiResponse({ status: 200, description: 'Paginated list of sessions' })
  findAllSessions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAllSessions(
      page ? parseInt(page) : undefined,
      limit ? parseInt(limit) : undefined,
    );
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get a session by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Session details' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  findSession(@Param('id') id: string) {
    return this.service.findSession(id);
  }

  @Patch('sessions/:id')
  @ApiOperation({ summary: 'Update a session' })
  @ApiParam({ name: 'id', type: String, description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Session updated' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  updateSession(@Param('id') id: string, @Body() dto: UpdateSessionDto) {
    return this.service.updateSession(id, dto);
  }

  @Post('sessions/:id/deactivate')
  @ApiOperation({ summary: 'Deactivate a session' })
  @ApiParam({ name: 'id', type: String, description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Session deactivated' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  deactivateSession(@Param('id') id: string) {
    return this.service.deactivateSession(id);
  }

  @Post('sessions/:id/rotate')
  @ApiOperation({ summary: 'Rotate a session (create new, deactivate old)' })
  @ApiParam({ name: 'id', type: String, description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Session rotated' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  rotateSession(@Param('id') id: string) {
    return this.service.rotateSession(id);
  }

  @Get('health')
  @ApiOperation({ summary: 'Get TG transport health status' })
  @ApiResponse({ status: 200, description: 'Transport health information' })
  getTransportHealth() {
    return this.service.getTransportHealth();
  }

  @Post('auth/start')
  @ApiOperation({ summary: 'Start MTProto authentication' })
  @ApiResponse({ status: 200, description: 'Auth flow started, code sent' })
  startAuth(@Body() dto: StartAuthDto) {
    return this.service.startAuth(dto);
  }

  @Post('auth/code')
  @ApiOperation({ summary: 'Submit verification code for auth' })
  @ApiResponse({ status: 200, description: 'Code accepted' })
  @ApiResponse({ status: 400, description: 'Invalid code' })
  submitCode(@Body() dto: SubmitCodeDto) {
    return this.service.submitCode(dto);
  }

  @Post('auth/password')
  @ApiOperation({ summary: 'Submit 2FA password for auth' })
  @ApiResponse({ status: 200, description: 'Password accepted, session created' })
  @ApiResponse({ status: 400, description: 'Invalid password' })
  submitPassword(@Body() dto: SubmitPasswordDto) {
    return this.service.submitPassword(dto);
  }
}
