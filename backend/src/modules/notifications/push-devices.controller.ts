import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { RegisterPushDeviceDto } from './push-device.dto';
import { NotificationService } from './notification.service';

@UseGuards(JwtAuthGuard)
@Controller('me/push-devices')
export class PushDevicesController {
  constructor(private readonly notifications: NotificationService) {}
  @Post()
  register(@Req() req: AuthenticatedRequest, @Body() dto: RegisterPushDeviceDto) { return this.notifications.register(req.user.id, dto); }
  @Delete(':deviceId') @HttpCode(204)
  deactivate(@Req() req: AuthenticatedRequest, @Param('deviceId', ParseUUIDPipe) id: string) { return this.notifications.deactivate(req.user.id, id); }
}
