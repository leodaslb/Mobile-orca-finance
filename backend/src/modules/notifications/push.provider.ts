import { Injectable } from '@nestjs/common';

export type PushPayload = { type: 'TRANSACTION_REMINDER' | 'WEEKLY_SUMMARY' | 'SPENDING_LIMIT'; profileId: string; title: string; body: string; ruleId?: string;
  periodStart?: string; periodEnd?: string; categoriaId?: string; referenceDate?: string };
export abstract class PushProvider {
  abstract send(token: string, payload: PushPayload): Promise<'ACCEPTED' | 'DEVICE_NOT_REGISTERED'>;
}

// Integração isolada: https://docs.expo.dev/push-notifications/sending-notifications/
// ACCEPTED confirma ticket do provedor; não comprova entrega no aparelho.
@Injectable()
export class ExpoPushProvider extends PushProvider {
  async send(token: string, payload: PushPayload): Promise<'ACCEPTED' | 'DEVICE_NOT_REGISTERED'> {
    const { title, body, ...data } = payload;
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json',
        ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
      body: JSON.stringify({ to: token, title, body, data, sound: 'default' }), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Push provider request failed');
    const result = await response.json() as { data?: { status?: string; details?: { error?: string } }; errors?: unknown[] };
    if (result.data?.details?.error === 'DeviceNotRegistered') return 'DEVICE_NOT_REGISTERED';
    if (result.errors?.length || result.data?.status !== 'ok') throw new Error('Push provider rejected message');
    return 'ACCEPTED';
  }
}
