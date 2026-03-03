import { RelayController } from './relay.controller';
import { RelayEchoInput, RelayEchoOutput, RelayMessageInput, RelayService } from './relay.service';

describe('RelayController', () => {
  const relayServiceMock: jest.Mocked<RelayService> = {
    enqueue: jest.fn(),
    listBySpace: jest.fn(),
    submitEcho: jest.fn(),
    getEcho: jest.fn(),
  } as unknown as jest.Mocked<RelayService>;

  const controller = new RelayController(relayServiceMock);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('delegates send to relay service', async () => {
    const body: RelayMessageInput = {
      space_id: 'space-1',
      sender_wid: 'wid-1',
      to_wid: 'wid-2',
      ciphertext_blob: 'cipher',
    };
    relayServiceMock.enqueue.mockResolvedValue({ message_id: 'msg-1' });

    await expect(controller.send(body)).resolves.toEqual({ message_id: 'msg-1' });
    expect(relayServiceMock.enqueue).toHaveBeenCalledWith(body);
  });

  it('delegates list by space to relay service', async () => {
    relayServiceMock.listBySpace.mockResolvedValue([
      {
        message_id: 'm1',
        space_id: 'space-1',
        sender_wid: 'wid-1',
        ciphertext_blob: 'cipher',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const result = await controller.list('space-1');
    expect(result).toHaveLength(1);
    expect(relayServiceMock.listBySpace).toHaveBeenCalledWith('space-1');
  });

  it('delegates echo submit to relay service', async () => {
    const body: RelayEchoInput = {
      wid: 'wid-1',
      device_id: 'device-1',
      message_id: 'msg-echo-1',
      ciphertext: 'Y2lwaGVy',
    };
    const output: RelayEchoOutput = {
      ...body,
      created_at: '2026-01-01T00:00:00.000Z',
    };
    relayServiceMock.submitEcho.mockResolvedValue(output);

    await expect(controller.echo(body)).resolves.toEqual(output);
    expect(relayServiceMock.submitEcho).toHaveBeenCalledWith(body);
  });

  it('delegates echo fetch to relay service', async () => {
    const output: RelayEchoOutput = {
      wid: 'wid-1',
      device_id: 'device-1',
      message_id: 'msg-echo-1',
      ciphertext: 'Y2lwaGVy',
      created_at: '2026-01-01T00:00:00.000Z',
    };
    relayServiceMock.getEcho.mockResolvedValue(output);

    await expect(controller.getEcho('msg-echo-1', 'wid-1', 'device-1')).resolves.toEqual(output);
    expect(relayServiceMock.getEcho).toHaveBeenCalledWith('wid-1', 'device-1', 'msg-echo-1');
  });
});
