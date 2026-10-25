export interface Medication {
  id: string;
  name: string;
  dose: string;
  times: string[];
  note?: string;
  continuous?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface ImportantDate {
  label: string;
  date: string;
  time: string;
}

export type DoseRecordStatus = 'taken' | 'skipped' | 'snoozed';
export type DoseDisplayStatus = DoseRecordStatus | 'scheduled' | 'due' | 'overdue' | 'upcoming';

export interface DoseRecord {
  status: DoseRecordStatus;
  updatedAt?: string;
  snoozeUntil?: string;
  snoozeDate?: string;
}

export type DoseHistory = Record<string, DoseRecord>;

export interface DoseItem {
  med: Medication;
  time: string;
  status: DoseDisplayStatus;
}
