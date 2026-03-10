import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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
  findSession(@Param('id') id: string) {
    return this.service.findSession(id);
  }

  @Patch('sessions/:id')
  updateSession(@Param('id') id: string, @Body() dto: UpdateSessionDto) {
    return this.service.updateSession(id, dto);
  }

  @Post('sessions/:id/deactivate')
  deactivateSession(@Param('id') id: string) {
    return this.service.deactivateSession(id);
  }

  @Post('sessions/:id/rotate')
  rotateSession(@Param('id') id: string) {
    return this.service.rotateSession(id);
  }

  @Get('health')
  getTransportHealth() {
    return this.service.getTransportHealth();
  }

  @Post('auth/start')
  startAuth(@Body() dto: StartAuthDto) {
    return this.service.startAuth(dto);
  }

  @Post('auth/code')
  submitCode(@Body() dto: SubmitCodeDto) {
    return this.service.submitCode(dto);
  }

  @Post('auth/password')
  submitPassword(@Body() dto: SubmitPasswordDto) {
    return this.service.submitPassword(dto);
  }
}
