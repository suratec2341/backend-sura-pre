import { SessionProcessor } from './session.processor';

describe('SessionProcessor', () => {
  it('keeps client metrics, derives missing counters, and completes the session', async () => {
    const tx = {
      sessionMetric: { upsert: jest.fn().mockResolvedValue({}) },
      activitySession: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      activitySession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-1',
          status: 'processing',
          startedAt: new Date('2026-07-20T10:00:00.000Z'),
          endedAt: new Date('2026-07-20T10:05:00.000Z'),
          durationSec: 300,
          metrics: { steps: 100, distanceKm: null, calories: null },
          sensorSamples: [
            { recordedAt: new Date('2026-07-20T10:00:01.000Z'), payload: { liveData: { steps: 10, distance: 0.1 } } },
            { recordedAt: new Date('2026-07-20T10:04:59.000Z'), payload: { liveData: { steps: 95, distance: '0.5', calories: 20 } } },
          ],
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const processor = new SessionProcessor(prisma as any);

    await processor.process({ data: { sessionId: 'session-1' } } as any);

    expect(tx.sessionMetric.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { steps: 100, distanceKm: 0.5, calories: 20 },
    }));
    expect(tx.activitySession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: expect.objectContaining({ status: 'completed', durationSec: 300 }),
    });
  });
});
