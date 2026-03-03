import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrekeyBundleService } from './prekey-bundle.service';

describe('PrekeyBundleService', () => {
  let service: PrekeyBundleService;

  beforeEach(() => {
    service = new PrekeyBundleService();
  });

  const bundle = {
    wid: 'wid-1',
    device_id: 'device-1',
    identity_key: 'identity-pub-1',
    signed_prekey: {
      signed_prekey_id: 1,
      signed_prekey_public: 'spk-pub-1',
      signature: 'sig-1'
    },
    one_time_prekeys: [
      { prekey_id: 10, public_key: 'opk-10' },
      { prekey_id: 11, public_key: 'opk-11' }
    ]
  };

  it('stores bundle and consumes prekeys in order', async () => {
    await service.uploadBundle(bundle);

    const first = await service.fetchBundleAndConsumeOneTimePrekey('wid-1', 'device-1');
    const second = await service.fetchBundleAndConsumeOneTimePrekey('wid-1', 'device-1');

    expect(first.one_time_prekey.prekey_id).toBe(10);
    expect(second.one_time_prekey.prekey_id).toBe(11);
  });

  it('rejects duplicate bundle uploads', async () => {
    await service.uploadBundle(bundle);
    await expect(service.uploadBundle(bundle)).rejects.toThrow(ConflictException);
  });

  it('rejects duplicate prekey ids inside upload payload', async () => {
    await expect(
      service.uploadBundle({
        ...bundle,
        one_time_prekeys: [
          { prekey_id: 10, public_key: 'opk-10' },
          { prekey_id: 10, public_key: 'opk-10b' }
        ]
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects missing signed_prekey and empty one_time_prekeys', async () => {
    await expect(
      service.uploadBundle({
        wid: 'wid-1',
        device_id: 'device-1',
        identity_key: 'identity-pub-1',
        one_time_prekeys: []
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects non-object payload and empty one-time prekey list', async () => {
    await expect(service.uploadBundle('invalid-payload')).rejects.toThrow(BadRequestException);

    await expect(
      service.uploadBundle({
        wid: 'wid-1',
        device_id: 'device-1',
        identity_key: 'identity-pub-1',
        signed_prekey: {
          signed_prekey_id: 1,
          signed_prekey_public: 'spk-pub-1',
          signature: 'sig-1'
        },
        one_time_prekeys: []
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid one_time_prekeys item shape', async () => {
    await expect(
      service.uploadBundle({
        ...bundle,
        one_time_prekeys: [null]
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects blank string and non-integer numeric fields', async () => {
    await expect(
      service.uploadBundle({
        ...bundle,
        identity_key: '  '
      })
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.uploadBundle({
        ...bundle,
        signed_prekey: {
          ...bundle.signed_prekey,
          signed_prekey_id: 0.5
        }
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects forbidden private field names', async () => {
    await expect(
      service.uploadBundle({
        ...bundle,
        private_key: 'forbidden'
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects fetch for missing bundle and depleted pool', async () => {
    await expect(service.fetchBundleAndConsumeOneTimePrekey('wid-x', 'device-x')).rejects.toThrow(
      BadRequestException
    );

    await service.uploadBundle({
      ...bundle,
      wid: 'wid-2',
      device_id: 'device-2',
      one_time_prekeys: [{ prekey_id: 99, public_key: 'opk-99' }]
    });

    await service.fetchBundleAndConsumeOneTimePrekey('wid-2', 'device-2');
    await expect(service.fetchBundleAndConsumeOneTimePrekey('wid-2', 'device-2')).rejects.toThrow(
      ConflictException
    );
  });

  it('requires wid and device_id on fetch', async () => {
    await expect(service.fetchBundleAndConsumeOneTimePrekey('', 'device-1')).rejects.toThrow(
      BadRequestException
    );
    await expect(service.fetchBundleAndConsumeOneTimePrekey('wid-1', '')).rejects.toThrow(
      BadRequestException
    );
  });
});
