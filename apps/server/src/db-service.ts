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
      const initialSeed: StoredCallRecord[] = [
        {
          id: 'CALL-9841',
          tenantId: 'real_estate',
          time: '11:42:19',
          timestampMs: Date.now() - 240000,
          caller: 'RAMESH KUMAR',
          phone: '+91 98450 12345',
          city: 'BALLARI',
          direction: 'INBOUND',
          source: 'Meta Ad Speed-to-Lead',
          duration: '01:18',
          durationSec: 78,
          costInr: 1.10,
          status: 'HOT_LEAD',
          intent: '30x40 EAST PLOT // 18L-22L BUDGET',
          budget: '₹18 TO ₹22 LAKHS',
          outcome: 'SUNDAY 11:00 AM FREE CAB VISIT',
          whatsappStatus: 'DELIVERED',
          transcript: [
            { speaker: 'SAHANA', time: '00:02', text: 'Namaskara sir! Ballari Residential Layout team inda mathadtha iddini. Namma bypass layout plots inquiry maadidri alva sir?' },
            { speaker: 'RAMESH', time: '00:09', text: 'Haudu madam, plots rate eshtu start aaguththe?' },
            { speaker: 'SAHANA', time: '00:15', text: 'Sir, 30x40 plots 18 Lakhs inda start aaguththe. SBI mathu HDFC bank inda 80% loan approval ide. Ee Sunday site visit arrange madla sir? Free cab pickup ide.' },
            { speaker: 'RAMESH', time: '00:26', text: 'Sari madam, Sunday beligge 11 o clock ge cab kalisi.' },
            { speaker: 'SAHANA', time: '00:32', text: 'Khanditha sir! Sunday 11 AM confirm aagide. Nimma WhatsApp ge location mathu driver details share maadthini. Dhanyavadagalu!' }
          ]
        },
        {
          id: 'CALL-9840',
          tenantId: 'real_estate',
          time: '11:28:04',
          timestampMs: Date.now() - 1080000,
          caller: 'DR. BASAVARAJ PATIL',
          phone: '+91 99801 88210',
          city: 'HUBLI',
          direction: 'INBOUND',
          source: 'Google Search Hotline',
          duration: '01:02',
          durationSec: 62,
          costInr: 0.90,
          status: 'HOT_LEAD',
          intent: '40x60 CORNER COMMERCIAL PLOT // 35L',
          budget: '₹35 TO ₹40 LAKHS',
          outcome: 'SATURDAY 04:00 PM MEETING BOOKED',
          whatsappStatus: 'DELIVERED',
          transcript: [
            { speaker: 'SAHANA', time: '00:03', text: 'Namaskara doctor sir! Namma Ballari highway layout plots bagge inquiry maadidri alva?' },
            { speaker: 'CALLER', time: '00:08', text: 'Haudu, 40x60 corner plot available idiya?' },
            { speaker: 'SAHANA', time: '00:14', text: 'Haudu sir, 40x60 corner plots just 2 units ide. 35 Lakhs budget ide. Saturday sanje 4 PM ge meeting arrange madla sir?' }
          ]
        },
        {
          id: 'CALL-4102',
          tenantId: 'hospital',
          time: '11:35:10',
          timestampMs: Date.now() - 660000,
          caller: 'SMT. SHAILAJA JOSHI',
          phone: '+91 98802 44101',
          city: 'BALLARI',
          direction: 'INBOUND',
          source: 'Apollo 24x7 Hotline',
          duration: '01:12',
          durationSec: 72,
          costInr: 1.05,
          status: 'HOT_LEAD',
          intent: 'CARDIOLOGY OPD CONSULTATION (DR. RAMESH)',
          budget: '₹750 OPD FEE CONFIRMED',
          outcome: 'TOMORROW 11:30 AM SLOT CONFIRMED',
          whatsappStatus: 'DELIVERED',
          transcript: [
            { speaker: 'SAHANA', time: '00:02', text: 'Namaskara! Apollo Specialty Clinic ge swagatha. Yaava doctor consultation bekitthu madam?' },
            { speaker: 'CALLER', time: '00:08', text: 'Dr. Ramesh Patil avara appointment bekitthu.' },
            { speaker: 'SAHANA', time: '00:14', text: 'Haudu madam, Dr. Ramesh avaru naale beligge 11:30 AM ge available iddare. OPD fee ₹750. Slot confirm madla?' }
          ]
        }
      ];
      this.writeRecords(initialSeed);
    }
  }

  public getAllCalls(tenantId?: string): StoredCallRecord[] {
    try {
      const raw = fs.readFileSync(this.dbFilePath, 'utf-8');
      const records: StoredCallRecord[] = JSON.parse(raw);
      if (tenantId) {
        return records.filter(r => r.tenantId === tenantId);
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
  }

  private writeRecords(records: StoredCallRecord[]): void {
    fs.writeFileSync(this.dbFilePath, JSON.stringify(records, null, 2), 'utf-8');
  }
}
