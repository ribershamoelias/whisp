import { Injectable } from '@nestjs/common';

@Injectable()
export class BlockRegistryService {
  private readonly blockedPairs = new Set<string>();

  addBlock(blockerWid: string, blockedWid: string): void {
    this.blockedPairs.add(`${blockerWid}:${blockedWid}`);
  }

  removeBlock(blockerWid: string, blockedWid: string): void {
    this.blockedPairs.delete(`${blockerWid}:${blockedWid}`);
  }

  isBlocked(a: string, b: string): boolean {
    return this.blockedPairs.has(`${a}:${b}`) || this.blockedPairs.has(`${b}:${a}`);
  }
}
