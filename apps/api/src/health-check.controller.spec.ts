import { HealthCheckController } from './health-check.controller';

describe('HealthCheckController', () => {
  it('returns an ok health payload', () => {
    const controller = new HealthCheckController();

    const result = controller.check();

    expect(result.status).toBe('ok');
    expect(Date.parse(result.timestamp)).not.toBeNaN();
  });
});
