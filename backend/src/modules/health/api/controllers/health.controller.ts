import { Controller, Get, Res } from '@nestjs/common';
import { HealthService } from '../../application/services/health.service';

type HttpResponse = {
  status: (statusCode: number) => void;
};

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  async getReadiness(@Res({ passthrough: true }) response: HttpResponse) {
    const readiness = await this.healthService.getReadiness();
    response.status(readiness.status === 'ready' ? 200 : 503);

    return readiness;
  }
}
