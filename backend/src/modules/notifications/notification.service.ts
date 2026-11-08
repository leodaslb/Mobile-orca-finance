import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Clock } from '../../common/clock';
import { NotificationsRepository } from './notifications.repository';
import { RegisterPushDeviceDto } from './push-device.dto';
import { PushPayload, PushProvider } from './push.provider';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly accepted = new Map<string, number>();
  private readonly pending = new Map<string, Promise<boolean>>();
  constructor(private readonly data: NotificationsRepository, private readonly provider: PushProvider, private readonly clock: Clock) {}
  async register(user: string, dto: RegisterPushDeviceDto) {
    const device = await this.data.register(user, dto.token, dto.platform);
    if (!device) throw new ConflictException('Token já associado a outra conta.');
    return { id: device.id, platform: device.plataforma, active: device.ativo, createdAt: device.createdAt.toISOString(), updatedAt: device.updatedAt.toISOString() };
  }
  async deactivate(user: string, id: string) {
    const device = await this.data.find(id);
    if (!device) throw new NotFoundException('Dispositivo não encontrado.');
    if (device.usuarioId !== user) throw new ForbiddenException('Dispositivo de outra conta.');
    await this.data.deactivate(user, id);
  }
  // RN-NOT-01: dedup por usuário/perfil/evento/janela/dispositivo no processo atual.
  // Janela determina expiração; falhas não são marcadas como sucesso e podem ser tentadas novamente.
  async notify(user: string, payload: PushPayload, window: string, expiresAt: Date) {
    const now = this.clock.now().getTime();
    for (const [key, expiry] of this.accepted) if (expiry <= now) this.accepted.delete(key);
    if (expiresAt.getTime() <= now) return { accepted: 0, failed: 0 };
    let accepted = 0; let failed = 0;
    const devices = await this.data.activeDevices(user);
    for (const device of devices) {
      const key = JSON.stringify([user, payload.profileId, payload.type, window, device.token]);
      if (this.accepted.has(key)) continue;
      const running = this.pending.get(key);
      if (running) { await running; continue; }
      const operation = (async () => {
        try {
          const outcome = await this.provider.send(device.token, payload);
          if (outcome === 'DEVICE_NOT_REGISTERED') { await this.data.deactivate(user, device.id); return false; }
          this.accepted.set(key, expiresAt.getTime()); return true;
        } catch { this.logger.warn('Falha no provedor push; envio não confirmado.'); return false; }
      })();
      this.pending.set(key, operation);
      try { if (await operation) accepted++; else failed++; } finally { this.pending.delete(key); }
    }
    return { accepted, failed };
  }
}
