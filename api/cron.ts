import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import nodemailer from 'nodemailer';

interface Medication {
  id: string;
  name: string;
  dose: string;
  times: string[];
  note?: string;
  startDate?: string;
  endDate?: string;
}
interface DoseRecord {
  status: string;
  snoozeUntil?: string;
  snoozeDate?: string;
}

function timeToMin(t: string): number {
  const p = String(t).split(':').map(Number);
  return p[0] * 60 + p[1];
}

function nowMinutes(): number {
  // Use Tbilisi time (UTC+4)
  const now = new Date();
  const tbilisi = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tbilisi' }));
  return tbilisi.getHours() * 60 + tbilisi.getMinutes();
}

function todayKey(): string {
  const now = new Date();
  const tbilisi = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tbilisi' }));
  const y = tbilisi.getFullYear();
  const m = String(tbilisi.getMonth() + 1).padStart(2, '0');
  const d = String(tbilisi.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function previousDayKey(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Protect with secret (for external cron or Vercel Cron)
  const secret = process.env.CRON_SECRET || process.env.REMINDER_SECRET;
  const authHeader = req.headers['authorization'] || '';
  const querySecret = req.query.secret;
  const headerSecret = req.headers['x-cron-secret'];

  if (!secret) {
    return res.status(500).json({ error: 'შეხსენებების წვდომა გამართული არ არის' });
  }
  const provided = headerSecret || (typeof querySecret === 'string' ? querySecret : '') || (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '');
  if (provided !== secret) {
    return res.status(401).json({ error: 'წვდომა აკრძალულია' });
  }

  try {
    let meds = await kv.get<Medication[]>('medications');
    if (!meds || !Array.isArray(meds)) {
      return res.status(200).json({ message: 'წამლების სია არ არის მითითებული', sent: 0 });
    }

    const nowMin = nowMinutes();
    const day = todayKey();
    const history = (await kv.get<Record<string, DoseRecord>>(`history:${day}`)) || {};
    const previousHistory = (await kv.get<Record<string, DoseRecord>>(`history:${previousDayKey(day)}`)) || {};
    let sentCount = 0;

    // Track what we already sent today: key = "sent:YYYY-MM-DD"
    const sentKey = `sent:${day}`;
    let alreadySent = (await kv.get<Record<string, boolean>>(sentKey)) || {};

    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_PASS;
    const toEmail = process.env.TO_EMAIL;

    if (!user || !pass || !toEmail) {
      return res.status(500).json({ error: 'ელფოსტის პარამეტრები გამართული არ არის' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });

    for (const med of meds) {
      if (!med.times || !Array.isArray(med.times)) continue;
      if ((med.startDate && day < med.startDate) || (med.endDate && day > med.endDate)) continue;

      for (const time of med.times) {
        const slotKey = `${med.id}|${time}`;
        const currentRecord = history[slotKey];
        if (currentRecord && (currentRecord.status === 'taken' || currentRecord.status === 'skipped')) continue;
        const previousRecord = previousHistory[slotKey];
        const crossDaySnooze = previousRecord && previousRecord.status === 'snoozed' &&
          previousRecord.snoozeDate === day;
        const record = crossDaySnooze ? previousRecord : currentRecord;
        const reminderTime = record && record.status === 'snoozed' ? record.snoozeUntil || time : time;
        const tMin = timeToMin(reminderTime);
        const diff = nowMin - tMin;

        if (diff >= 0 && diff <= 20) {
          const sentKeyForDose = record && record.status === 'snoozed'
            ? `${slotKey}|snooze:${record.snoozeDate || day}:${record.snoozeUntil}`
            : slotKey;
          if (alreadySent[sentKeyForDose]) continue;

          const subject = `დროა წამლის მიღების: ${med.name}`;
          const text = [
            `წამალი: ${med.name}`,
            `დოზა: ${med.dose || ''}`,
            `დრო: ${reminderTime}`,
            med.note ? `შენიშვნა: ${med.note}` : '',
            '',
            'ეს ავტომატური შეხსენებაა (სერვერიდან).'
          ].filter(Boolean).join('\n');

          await transporter.sendMail({
            from: `"წამლების აღრიცხვა" <${user}>`,
            to: toEmail,
            subject,
            text
          });

          alreadySent[sentKeyForDose] = true;
          sentCount++;
        }
      }
    }

    // Save what we sent today (expire after ~2 days)
    await kv.set(sentKey, alreadySent, { ex: 60 * 60 * 48 });

    return res.status(200).json({ ok: true, sent: sentCount, time: nowMin, day });
  } catch (err) {
    console.error('შეხსენებების დაგეგმილი ამოცანის შეცდომა:', err);
    return res.status(500).json({ error: 'შეხსენების გაგზავნა ვერ მოხერხდა' });
  }
}
