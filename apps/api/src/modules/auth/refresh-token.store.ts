import { Injectable } from '@nestjs/common';

export type RevocationReason = 'rotated' | 'expired' | 'family_compromised' | 'device_revoked';

export interface RefreshTokenRecord {
  wid: string;
  device_id: string;
  family_id: string;
  jti: string;
  parent_jti: string | null;
  refresh_token_hash: string;
  revoked: boolean;
  revoked_reason: RevocationReason | null;
  expires_at: Date;
  created_at: Date;
}

export interface RefreshTokenStoreTx {
  listByWidDevice(wid: string, deviceId: string): RefreshTokenRecord[];
  insert(record: RefreshTokenRecord): void;
  revokeByJti(jti: string, reason: RevocationReason): void;
  revokeFamily(wid: string, deviceId: string, familyId: string, reason: RevocationReason): void;
  revokeDevice(wid: string, deviceId: string, reason: RevocationReason): void;
  isFamilyCompromised(wid: string, deviceId: string, familyId: string): boolean;
}

@Injectable()
export class InMemoryRefreshTokenStore {
  private records: RefreshTokenRecord[] = [];
  private failNextInsert = false;
  private txLock: Promise<void> = Promise.resolve();

  async withTransaction<T>(runner: (tx: RefreshTokenStoreTx) => T | Promise<T>): Promise<T> {
    const release = await this.acquireLock();
    try {
      const snapshot = this.records.map((record) => ({ ...record }));
      const txRecords = snapshot;

      const tx: RefreshTokenStoreTx = {
        listByWidDevice: (wid: string, deviceId: string) =>
          txRecords.filter((record) => record.wid === wid && record.device_id === deviceId),
        insert: (record: RefreshTokenRecord) => {
          if (this.failNextInsert) {
            this.failNextInsert = false;
            throw new Error('Simulated insert failure');
          }
          txRecords.push({ ...record });
        },
        revokeByJti: (jti: string, reason: RevocationReason) => {
          const record = txRecords.find((item) => item.jti === jti);
          if (record) {
            record.revoked = true;
            record.revoked_reason = reason;
          }
        },
        revokeFamily: (wid: string, deviceId: string, familyId: string, reason: RevocationReason) => {
          txRecords
            .filter(
              (record) =>
                record.wid === wid &&
                record.device_id === deviceId &&
                record.family_id === familyId &&
                !record.revoked
            )
            .forEach((record) => {
              record.revoked = true;
              record.revoked_reason = reason;
            });
        },
        revokeDevice: (wid: string, deviceId: string, reason: RevocationReason) => {
          txRecords
            .filter((record) => record.wid === wid && record.device_id === deviceId && !record.revoked)
            .forEach((record) => {
              record.revoked = true;
              record.revoked_reason = reason;
            });
        },
        isFamilyCompromised: (wid: string, deviceId: string, familyId: string) =>
          txRecords.some(
            (record) =>
              record.wid === wid &&
              record.device_id === deviceId &&
              record.family_id === familyId &&
              record.revoked_reason === 'family_compromised'
          )
      };

      const result = await runner(tx);
      this.records = txRecords;
      return result;
    } finally {
      release();
    }
  }

  simulateNextInsertFailure(): void {
    this.failNextInsert = true;
  }

  snapshotByWidDevice(wid: string, deviceId: string): RefreshTokenRecord[] {
    return this.records
      .filter((record) => record.wid === wid && record.device_id === deviceId)
      .map((record) => ({ ...record }));
  }

  async revokeDeviceFamilies(wid: string, deviceId: string): Promise<void> {
    await this.withTransaction(async (tx) => {
      tx.revokeDevice(wid, deviceId, 'device_revoked');
    });
  }

  private async acquireLock(): Promise<() => void> {
    let releaseCurrent: () => void = () => {};
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });

    const previous = this.txLock;
    this.txLock = current;
    await previous;

    let unlocked = false;
    return () => {
      if (!unlocked) {
        unlocked = true;
        releaseCurrent();
      }
    };
  }
}
