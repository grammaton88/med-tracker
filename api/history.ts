import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import type { DoseHistory, DoseRecord, DoseRecordStatus } from '../lib/models';

interface DoseInput {
  medicationId: string;
  time: string;
  status: DoseRecordStatus;
  snoozeUntil?: string;
  snoozeDate?: string;
}

const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const VALID_ID = /^[A-Za-z0-9_-]{1,80}$/;

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !VALID_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      const date = req.query.date;
      if (!validDate(date)) {
        res.status(400).json({ error: 'მიუთითეთ სწორი თარიღი' });
        return;
      }
      return res.status(200).json((await kv.get(`history:${date}`)) || {});
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const date = body.date;
      const entries: unknown[] = Array.isArray(body.records) ? body.records : [body];
      if (!validDate(date) || !entries.length || entries.length > 100 || !entries.every(record => validRecord(record, date))) {
        res.status(400).json({ error: 'დოზის ჩანაწერის მონაცემები არასწორია' });
        return;
      }
      const key = `history:${date}`;
      const records: DoseHistory = (await kv.get<DoseHistory>(key)) || {};
      entries.forEach(entry => {
        if (!validRecord(entry, date)) return;
        const { medicationId, time, status, snoozeUntil, snoozeDate } = entry;
        records[`${medicationId}|${time}`] = {
          status,
          updatedAt: new Date().toISOString(),
          ...(status === 'snoozed' ? { snoozeUntil, snoozeDate: snoozeDate || date } : {})
        };
      });
      await kv.set(key, records, { ex: 60 * 60 * 24 * 400 });
      res.status(200).json(records);
      return;
    }

    if (req.method === 'DELETE') {
      const date = req.query.date;
      if (!validDate(date)) {
        res.status(400).json({ error: 'მიუთითეთ სწორი თარიღი' });
        return;
      }
      if (req.query.medicationId || req.query.time) {
        const { medicationId, time } = req.query;
        if (typeof medicationId !== 'string' || !VALID_ID.test(medicationId) ||
            typeof time !== 'string' || !VALID_TIME.test(time)) {
          res.status(400).json({ error: 'მიუთითეთ სწორი წამალი და მიღების დრო' });
          return;
        }
        const key = `history:${date}`;
        const records: DoseHistory = (await kv.get<DoseHistory>(key)) || {};
        delete records[`${medicationId}|${time}`];
        if (Object.keys(records).length) await kv.set(key, records, { ex: 60 * 60 * 24 * 400 });
        else await kv.del(key);
        res.status(200).json(records);
        return;
      }
      await kv.del(`history:${date}`);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'მოთხოვნის მეთოდი დაშვებული არ არის' });
    return;
  } catch (error) {
    console.error('მიღების ისტორიის API შეცდომა:', error);
    res.status(500).json({ error: 'მიღების ისტორიის განახლება ვერ მოხერხდა' });
  }
}

function validRecord(record: unknown, date: string): record is DoseInput {
  if (!record || typeof record !== 'object') return false;
  const value = record as Record<string, unknown>;
  if (typeof value.medicationId !== 'string' || !VALID_ID.test(value.medicationId) ||
      typeof value.time !== 'string' || !VALID_TIME.test(value.time)) return false;
  if (value.status === 'snoozed') {
    return typeof value.snoozeUntil === 'string' && VALID_TIME.test(value.snoozeUntil) &&
      (value.snoozeDate === undefined || validDate(value.snoozeDate)) &&
      (typeof value.snoozeDate !== 'string' || value.snoozeDate >= date);
  }
  return value.status === 'taken' || value.status === 'skipped';
}
