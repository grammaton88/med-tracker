import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import type { ImportantDate, Medication } from '../lib/models';

const DEFAULT_MEDS: Medication[] = [
  { id: "profertil", name: "პროფერტილი (ქალის)", dose: "1 ამპულა + 1 კაფსულა", times: ["08:00"], note: "დღეში ერთხელ, უწყვეტად", continuous: true },
  { id: "vitd3", name: "ვიტამინი D3 2000 მგ", dose: "1 ტაბლეტი", times: ["08:00"], note: "დღეში ერთხელ, უწყვეტად", continuous: true },
  { id: "estrofem", name: "ესტროფემი 2 მგ", dose: "1 ტაბლეტი", times: ["08:00","12:00","18:00","22:00"], note: "დღეში ოთხჯერ, უწყვეტად", continuous: true },
  { id: "cardiomagnil", name: "კარდიომაგნილი 75 მგ", dose: "1 ტაბლეტი", times: ["08:00"], note: "დღეში ერთხელ, უწყვეტად", continuous: true },
  { id: "divigel", name: "დივიგელი 1.0", dose: "1 აპლიკაცია", times: ["08:00","20:00"], note: "მუცელზე, უწყვეტად", continuous: true },
  { id: "glucophage", name: "გლუკოფაგი 750 მგ", dose: "1 ტაბლეტი", times: ["19:00"], note: "საღილის დროს, უწყვეტად", continuous: true },
  { id: "sedigestan", name: "სედიგესტანი 200 მგ", dose: "1 კაფსულა", times: ["08:00","14:00","23:00"], note: "ვაგინალურად, უწყვეტად", continuous: true },
  { id: "progestan", name: "პროგესტანი 50 მგ", dose: "1 ამპულა (კუნთში)", times: ["09:00"], note: "კუნთში, უწყვეტად", continuous: true },
  { id: "medrol", name: "მეტიფრედი / მედროლი 4 მგ", dose: "1 ტაბლეტი", times: ["08:00"], note: "დღეში ერთხელ, უწყვეტად", continuous: true },
  { id: "provag", name: "პროვაგი", dose: "1 ამპულა", times: ["09:00"], note: "3 კვირა", continuous: false },
  { id: "lactobiz", name: "ლაქტობიზი CND", dose: "1 კაფსულა", times: ["08:00","20:00"], note: "10 დღე ორჯერ, შემდეგ 10 დღე ერთხელ", continuous: false },
  { id: "eublacenta", name: "ეუბლაცენტა", dose: "1 ამპულა", times: ["08:00","20:00"], note: "დღეში ორჯერ, 3 კვირა", continuous: false },
  { id: "enoxa", name: "ენოქსა 0.4", dose: "1 ინექცია", times: ["20:00"], note: "მუცელზე, საღამოს", continuous: false }
];

const DEFAULT_DATES: ImportantDate[] = [
  { label: 'ემბრიოტრანსფერი', date: '2026-10-23', time: '13:00' },
  { label: 'HCG კონტროლი', date: '2026-11-03', time: '' }
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      const storedMeds = await kv.get<unknown>('medications');
      let meds: Medication[];
      if (validMedicationList(storedMeds)) {
        meds = storedMeds;
      } else {
        meds = DEFAULT_MEDS;
        await kv.set('medications', meds);
      }
      const repairedMeds = repairQuestionMarkText(meds);
      if (repairedMeds !== meds) {
        meds = repairedMeds;
        await kv.set('medications', meds);
      }
      let dates = await kv.get<unknown>('important-dates');
      if (!validDates(dates)) {
        dates = DEFAULT_DATES;
        await kv.set('important-dates', dates);
      }
      return res.status(200).json({ medications: meds, dates, defaults: DEFAULT_MEDS });
    }

    if (req.method === 'POST') {
      const { medications, dates } = req.body || {};
      if (!Array.isArray(medications) || !Array.isArray(dates)) {
        res.status(400).json({ error: 'მიუთითეთ წამლებისა და თარიღების სიები' });
        return;
      }
      if (!validMedicationList(medications) || !validDates(dates)) {
        res.status(400).json({ error: 'წამლების ან თარიღების მონაცემები არასწორია' });
        return;
      }
      await kv.set('medications', medications);
      await kv.set('important-dates', dates);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'მოთხოვნის მეთოდი დაშვებული არ არის' });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'სერვერზე შეცდომა მოხდა' });
  }
}

function repairQuestionMarkText(medications: Medication[]): Medication[] {
  const defaults = new Map(DEFAULT_MEDS.map(medication => [medication.id, medication]));
  let repaired = false;
  const result = medications.map(medication => {
    const defaultMedication = defaults.get(medication.id);
    if (!defaultMedication) return medication;
    const repairedMedication = { ...medication };
    (['name', 'dose', 'note'] as const).forEach(field => {
      const value = repairedMedication[field];
      const defaultValue = defaultMedication[field];
      if (typeof value === 'string' && /\?{2,}/.test(value) && typeof defaultValue === 'string') {
        repairedMedication[field] = defaultValue;
        repaired = true;
      }
    });
    return repairedMedication;
  });
  return repaired ? result : medications;
}

function validMedicationList(value: unknown): value is Medication[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set();
  return value.every((candidate: unknown) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
    const med = candidate as Record<string, unknown>;
    if (typeof med.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(med.id) || ids.has(med.id)) return false;
    if (typeof med.name !== 'string' || !med.name.trim() || typeof med.dose !== 'string') return false;
    if (med.note !== undefined && typeof med.note !== 'string') return false;
    if (med.continuous !== undefined && typeof med.continuous !== 'boolean') return false;
    if (!Array.isArray(med.times) || med.times.length === 0) return false;
    const times = new Set();
    if (!med.times.every((time: unknown) => {
      if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || times.has(time)) return false;
      times.add(time);
      return true;
    })) return false;
    if (med.startDate !== undefined && !isDate(med.startDate)) return false;
    if (med.endDate !== undefined && !isDate(med.endDate)) return false;
    if (typeof med.startDate === 'string' && typeof med.endDate === 'string' && med.startDate > med.endDate) return false;
    ids.add(med.id);
    return true;
  });
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validDates(value: unknown): value is ImportantDate[] {
  return Array.isArray(value) && value.every((candidate: unknown) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
    const item = candidate as Record<string, unknown>;
    return typeof item.label === 'string' && Boolean(item.label.trim()) && isDate(item.date) &&
      (item.time === '' || (typeof item.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.time)));
  });
}
