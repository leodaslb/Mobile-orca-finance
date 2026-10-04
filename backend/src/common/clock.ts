import { Injectable, Module } from '@nestjs/common';

@Injectable()
export class Clock {
  now() { return new Date(); }
}

@Module({ providers: [Clock], exports: [Clock] })
export class ClockModule {}
