import { Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../common/clock';
import { NotificationService } from './notification.service';
import { NotificationsRepository } from './notifications.repository';
import { detectTransactionReminders, rankTransactionReminders, reminderDay, ReminderCandidate, REMINDER_DAILY_LIMIT, REMINDER_HISTORY_DAYS } from './transaction-reminder-detector';

@Injectable()
export class SmartTransactionReminderService {
  private readonly logger = new Logger(SmartTransactionReminderService.name);
  constructor(private readonly data: NotificationsRepository, private readonly notifications: NotificationService, private readonly clock: Clock) {}

  private reserve(user: string, candidates: ReminderCandidate[], day: Date) {
    return this.data.reminderTransaction(async tx => {
      await this.data.lockReminderUser(user, tx);
      const remaining = REMINDER_DAILY_LIMIT - await this.data.reminderCount(user, day, tx);
      if (remaining <= 0) return [];
      const previous = new Set((await this.data.reminderEvents(user, candidates.map(c => c.eventKey), tx)).map(r => r.chaveEvento));
      const selected: ReminderCandidate[] = [];
      for (const candidate of rankTransactionReminders(candidates)) {
        if (previous.has(candidate.eventKey)) continue;
        if (!await this.data.reminderProfile(user, candidate.profileId, tx)) continue;
        await this.data.reserveReminder(user, candidate.profileId, candidate.eventKey, day, tx);
        previous.add(candidate.eventKey); selected.push(candidate);
        if (selected.length === remaining) break;
      }
      return selected;
    });
  }

  async run() {
    const now = this.clock.now(); const today = reminderDay(now); const yesterday = new Date(today.getTime() - 86400000);
    const historyStart = new Date(yesterday.getTime() - REMINDER_HISTORY_DAYS * 86400000);
    const byUser = new Map<string, ReminderCandidate[]>();
    for (const profile of await this.data.recipientProfiles()) {
      try {
        const rows = await this.data.reminderMovements(profile.id, historyStart, now);
        const candidates = [yesterday, today].flatMap(day => detectTransactionReminders(profile.id, rows, day, now));
        const existing = byUser.get(profile.usuarioId) ?? []; existing.push(...candidates); byUser.set(profile.usuarioId, existing);
      } catch { this.logger.warn('Histórico de um perfil indisponível; demais perfis continuam.'); }
    }
    let candidateCount = 0; let reserved = 0; let acceptedEvents = 0;
    for (const [user, candidates] of byUser) {
      candidateCount += candidates.length;
      if (!candidates.length) continue;
      try {
        const selected = await this.reserve(user, candidates, today); reserved += selected.length;
        for (const candidate of selected) {
          // Reserva durável antes do HTTP: não repetir após timeout, reinício ou falha parcial.
          const result = await this.notifications.notify(user, { type: 'TRANSACTION_REMINDER', profileId: candidate.profileId,
            categoriaId: candidate.categoriaId, referenceDate: candidate.referenceDate, title: 'Orca Finance',
            body: `Confira se falta registrar alguma movimentação em ${candidate.categoriaNome.slice(0, 60)}.` },
          candidate.eventKey, new Date(today.getTime() + 86400000));
          if (result.accepted > 0) acceptedEvents++;
        }
      } catch { this.logger.warn('Lembretes de um usuário não processados; detalhes internos omitidos.'); }
    }
    return { candidates: candidateCount, reserved, acceptedEvents };
  }
}
