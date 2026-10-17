import { globalDb } from '@vanni/database';
/**
 * Layer 1 & 5: Persistent Storage Engine
 * Dhwani SI — File-Backed Call Session & Lead Dossier Database
 */

import fs from 'node:fs';
import path from 'node:path';

export interface StoredCallRecord {
  id: string;
  tenantId: string;
  time: string;
  timestampMs: number;
  caller: string;
  phone: string;
  city: string;
  direction: 'INBOUND' | 'OUTBOUND';
  source: string;
  duration: string;
  durationSec: number;
  costInr: number;
  status: 'HOT_LEAD' | 'WARM' | 'COLD' | 'DISQUALIFIED';
  intent: string;
  budget: string;
  outcome: string;
  audioRecordingUrl?: string;
  whatsappStatus: 'DELIVERED' | 'FAILED' | 'PENDING';
  transcript: Array<{ speaker: string; time: string; text: string }>;
}

export class CallDatabaseService {
  private dbFilePath: string;

  constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbFilePath = path.join(dataDir, 'calls.json');
    this.initSeedData();
  }

  private initSeedData(): void {
    if (!fs.existsSync(this.dbFilePath)) {
      this.writeRecords([]);
    }
  }

  public getAllCalls(tenantId?: string): StoredCallRecord[] {
    try {
      const raw = fs.readFileSync(this.dbFilePath, 'utf-8');
      const records: StoredCallRecord[] = JSON.parse(raw);
      if (tenantId) {
        const norm = (id: string) => {
          if (!id) return '';
          if (id === 'a0000000-0000-0000-0000-000000000001' || id === 'real_estate') return 'real_estate';
          if (id === 'a0000000-0000-0000-0000-000000000002' || id === 'hospital') return 'hospital';
          if (id === 'a0000000-0000-0000-0000-000000000003' || id === 't_dhwani_inception' || id === 'agency' || id === 'inception') return 'agency';
          return id;
        };
        const target = norm(tenantId);
        return records.filter(r => norm(r.tenantId) === target || r.tenantId === tenantId);
      }
      return records;
    } catch {
      return [];
    }
  }

  public saveCall(record: StoredCallRecord): void {
    const list = this.getAllCalls();
    const existingIdx = list.findIndex(r => r.id === record.id);
    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.unshift(record); // Prepend to top
    }
    this.writeRecords(list);

    // Sync to globalDb durable store
    globalDb.saveCall({
      id: record.id,
      tenantId: record.tenantId,
      caller: record.caller,
      phone: record.phone,
      direction: record.direction === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND',
      durationSeconds: record.durationSec,
      intent: record.intent,
      outcome: record.outcome,
      leadRating: record.status === 'HOT_LEAD' ? 'HOT' : (record.status === 'WARM' ? 'WARM' : (record.status === 'COLD' ? 'COLD' : 'UNQUALIFIED')),
      city: record.city,
      transcript: Array.isArray(record.transcript) ? record.transcript.map(t => ({
        speaker: t.speaker === 'AI' ? 'AI' : 'CUSTOMER',
        text: t.text,
        timestamp: t.time || new Date().toISOString(),
      })) : [],
      createdAt: record.time || new Date().toISOString(),
    }).catch(() => {});
  }

  private writeRecords(records: StoredCallRecord[]): void {
    const tempFile = `${this.dbFilePath}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`;
    try {
      fs.writeFileSync(tempFile, JSON.stringify(records, null, 2), 'utf-8');
      fs.renameSync(tempFile, this.dbFilePath);
    } catch (err) {
      if (fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch {}
      }
      // Fallback direct write if atomic rename is blocked across file systems
      fs.writeFileSync(this.dbFilePath, JSON.stringify(records, null, 2), 'utf-8');
    }
  }
}

