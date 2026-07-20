import { SessionService } from './session.service';

describe('SessionService', () => {
  it('imports the frontend NDJSON batch and makes retries idempotent by sequence', async () => {
    const session = {
      id: 'session-1',
      userId: 'user-1',
      startedAt: new Date(),
      status: 'recording',
    };
    const prisma = {
      activitySession: {
        findFirst: jest.fn().mockResolvedValue(session),
        update: jest.fn().mockResolvedValue(session),
      },
      sessionSensorSample: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const service = new SessionService(prisma as any, { enqueue: jest.fn() } as any);
    const file = {
      buffer: Buffer.from([
        JSON.stringify({ sequence: 10, timestamp: '2026-07-20T10:00:00.000Z', pressure: 12 }),
        JSON.stringify({ sequence: 11, timestamp: '2026-07-20T10:00:00.100Z', pressure: 13 }),
      ].join('\n')),
      mimetype: 'application/x-ndjson',
      originalname: 'mobile-1.jsonl',
      size: 200,
    };

    await expect(service.syncBatch('user-1', {
      session_id: 'mobile-1',
      device_type: 'android',
    }, file)).resolves.toEqual({
      sessionId: 'session-1',
      clientSessionUuid: 'mobile-1',
      accepted: 2,
    });
    expect(prisma.sessionSensorSample.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ sessionId: 'session-1', sequence: 10, source: 'android' }),
        expect.objectContaining({ sessionId: 'session-1', sequence: 11, source: 'android' }),
      ],
      skipDuplicates: true,
    });
  });

  it('reports the exact line containing malformed NDJSON', async () => {
    const service = new SessionService({} as any, {} as any);
    await expect(service.syncBatch('user-1', { session_id: 'mobile-1' }, {
      buffer: Buffer.from('{"ok":true}\nnot-json'),
      mimetype: 'application/x-ndjson',
      originalname: 'bad.jsonl',
      size: 20,
    })).rejects.toThrow('Invalid JSON on line 2');
  });
});
