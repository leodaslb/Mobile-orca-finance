import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { CompoundInterestDto, OpportunityCostDto } from './calculation.dto';

@Injectable()
export class CalculationsService {
  private future(value: string, rate: number, periods: number) {
    const initial = new Prisma.Decimal(value);
    if (!initial.isFinite() || initial.lessThan(0) || !Number.isFinite(rate) || rate < -100 || !Number.isSafeInteger(periods) || periods < 0) {
      throw new BadRequestException('Parâmetros de cálculo inválidos.');
    }
    const result = initial.mul(new Prisma.Decimal(rate).div(100).plus(1).pow(periods));
    // Limite técnico de serialização; evita gerar respostas gigantes em potências extremas.
    if (!result.isFinite() || result.e > 1000) throw new BadRequestException('Resultado excede a representação suportada.');
    return { initial, result };
  }
  // RF32/51 → US31 → RN-CO-01: taxa e horizonte sempre informados.
  compound(dto: CompoundInterestDto) {
    const { initial, result } = this.future(dto.valorInicial, dto.taxaPercentual, dto.quantidadePeriodos);
    return { valorInicial: initial.toFixed(2), valorFuturo: result.toFixed(2), jurosAcumulados: result.minus(initial).toFixed(2),
      taxaPercentual: dto.taxaPercentual, quantidadePeriodos: dto.quantidadePeriodos };
  }
  opportunity(dto: OpportunityCostDto) {
    const { initial, result } = this.future(dto.valorGastoHipotetico, dto.taxaRetornoPercentual, dto.quantidadePeriodos);
    return { valorGastoHipotetico: initial.toFixed(2), valorFuturoHipotetico: result.toFixed(2), ganhoHipotetico: result.minus(initial).toFixed(2) };
  }
}
