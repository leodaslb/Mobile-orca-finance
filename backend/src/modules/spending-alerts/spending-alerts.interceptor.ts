import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { mergeMap } from 'rxjs';
import { SpendingAlertsService } from './spending-alerts.service';

@Injectable()
export class SpendingAlertsInterceptor implements NestInterceptor {
  constructor(private readonly alerts: SpendingAlertsService) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<{ method: string; url: string; params: { profileId?: string }; user?: { id: string } }>();
    const path = request.url.split('?')[0];
    const financialWrite = /^(POST|PUT|PATCH|DELETE)$/.test(request.method) &&
      /^\/profiles\/[^/]+\/(?:transactions(?:\/[^/]+)?|spending-rules(?:\/[^/]+)?|recurrences(?:\/[^/]+)?|imports\/transactions\/confirm|reflection-items\/[^/]+\/transactions)$/.test(path);
    if (!financialWrite || !request.user || !request.params.profileId) return next.handle();
    return next.handle().pipe(mergeMap(async result => {
      await this.alerts.evaluate(request.user!.id, request.params.profileId!);
      return result as unknown;
    }));
  }
}
