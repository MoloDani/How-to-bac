import { createObserveModule } from '@nestjs/observe';
import dotenv from 'dotenv';

// Whether telemetry is on must be known while AppModule is being defined,
// before ConfigModule has loaded .env — so load it here first.
dotenv.config({ quiet: true });

const appKey = process.env.OBSERVE_APP_KEY;
const appSecret = process.env.OBSERVE_APP_SECRET;

export const { ObserveModule, ObserveInstrument } = createObserveModule();

/**
 * Telemetry (https://observe.nestjs.com) runs only when both keys are set, so
 * local runs and tests without keys don't spam 401s.
 */
export const observeImports =
  appKey && appSecret
    ? [
        ObserveModule.forRoot({
          appKey,
          appSecret,
          serviceId: 'howtobac-backend',
        }),
      ]
    : [];

export const observeEnabled = observeImports.length > 0;
