import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'მოთხოვნის მეთოდი დაშვებული არ არის' });
  }

  const secret = process.env.CRON_SECRET || process.env.REMINDER_SECRET;
  const authHeader = req.headers.authorization || '';
  const headerSecret = req.headers['x-cron-secret'];
  const provided = headerSecret || (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '');
  if (!secret) {
    return res.status(500).json({ error: 'შეხსენებების წვდომა გამართული არ არის' });
  }
  if (provided !== secret) {
    return res.status(401).json({ error: 'წვდომა აკრძალულია' });
  }

  try {
    const { medicationName, dose, time, note } = req.body || {};
    if (typeof medicationName !== 'string' || !medicationName.trim() ||
        typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      return res.status(400).json({ error: 'მიუთითეთ წამლის დასახელება და სწორი დრო' });
    }

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

    await transporter.sendMail({
      from: `"წამლების აღრიცხვა" <${user}>`,
      to: toEmail,
      subject: `დროა წამლის მიღების: ${medicationName}`,
      text: [
        `წამალი: ${medicationName}`,
        `დოზა: ${dose || ''}`,
        `დრო: ${time}`,
        note ? `შენიშვნა: ${note}` : '',
        '',
        'ეს შეხსენებაა წამლების აღრიცხვის სისტემიდან.'
      ].filter(Boolean).join('\n')
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'შეხსენების გაგზავნა ვერ მოხერხდა' });
  }
}
