import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SystemService } from './system.service';

@ApiTags('system')
@Controller('api/system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get system status overview' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns aggregated system status',
  })
  async getStatus() {
    return this.systemService.getStatus();
  }

  @Get('workers')
  @ApiOperation({ summary: 'Get all connector pool worker instances' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns all running worker instances with health data',
  })
  async getWorkers() {
    return this.systemService.getWorkers();
  }
}
