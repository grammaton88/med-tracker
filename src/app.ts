import type {
  DoseDisplayStatus,
  DoseHistory,
  DoseItem,
  DoseRecord,
  DoseRecordStatus,
  ImportantDate,
  Medication
} from '../lib/models';

interface LastDoseChange {
  day: string;
  medicationId: string;
  time: string;
  previous: DoseRecord | null;
}

    let medications: Medication[] = [];
    let defaultMedications: Medication[] = [];
    let importantDates: ImportantDate[] = [];
    let currentDate = new Date();
    currentDate.setHours(12, 0, 0, 0);
    let dashboardCalendarMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 12);
    let doseHistory: DoseHistory = {};
    let editId: string | null = null;
    let modalTimes: string[] = [];
    let modalReturnFocus: HTMLElement | null = null;
    let resetConfirmationReturnFocus: HTMLElement | null = null;
    let clearDayConfirmationReturnFocus: HTMLElement | null = null;
    let calendarReturnFocus: HTMLElement | null = null;
    let calendarInput: HTMLInputElement | null = null;
    let calendarMonth = new Date();
    let timePickerReturnFocus: HTMLElement | null = null;
    let timePickerInput: HTMLInputElement | null = null;
    let lastDoseChange: LastDoseChange | null = null;

    function $<T extends HTMLElement = HTMLElement>(id: string): T {
      const element = document.getElementById(id);
      if (!element) throw new Error("გვერდზე საჭირო ელემენტი ვერ მოიძებნა.");
      return element as T;
    }
    const pad = (n: number): string => n < 10 ? "0" + n : String(n);
    const uid = () => "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const dateKey = (date: Date): string => date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
    const georgianMonths = ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"];
    const georgianWeekdays = ["ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვი"];
    function parseDateKey(value: string): Date | null {
      if (!isDateValue(value)) return null;
      const [year, month, day] = value.split("-").map(Number);
      return new Date(year, month - 1, day, 12);
    }
    function formatGeorgianDate(value: string): string {
      const date = parseDateKey(value);
      return date ? date.getDate() + " " + georgianMonths[date.getMonth()] + " " + date.getFullYear() : "";
    }
    function dateInputValue(id: string): string {
      return $<HTMLInputElement>(id).dataset.isoValue || "";
    }
    function setDateInputValue(input: HTMLInputElement, value: string): void {
      input.dataset.isoValue = value;
      input.value = formatGeorgianDate(value);
    }
    function closeGeorgianCalendar(): void {
      $("georgian-calendar").classList.remove("show");
      $("georgian-calendar").setAttribute("aria-hidden", "true");
      calendarInput?.setAttribute("aria-expanded", "false");
      calendarReturnFocus?.setAttribute("aria-expanded", "false");
      if (calendarReturnFocus) calendarReturnFocus.focus();
      calendarInput = null;
      calendarReturnFocus = null;
    }
    function renderCalendarGrid(gridId: string, year: number, month: number, selectedDate: string, onSelect: (key: string) => void): void {
      const grid = $(gridId);
      grid.replaceChildren();
      georgianWeekdays.forEach(day => {
        const heading = document.createElement("span");
        heading.className = "calendar-weekday";
        heading.setAttribute("role", "columnheader");
        heading.textContent = day;
        grid.appendChild(heading);
      });
      const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const today = dateKey(new Date());
      for (let index = 0; index < 42; index++) {
        const dayNumber = index - firstOffset + 1;
        if (dayNumber < 1 || dayNumber > daysInMonth) {
          const empty = document.createElement("span");
          empty.className = "calendar-empty";
          empty.setAttribute("aria-hidden", "true");
          grid.appendChild(empty);
          continue;
        }
        const key = year + "-" + pad(month + 1) + "-" + pad(dayNumber);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "calendar-day";
        button.textContent = String(dayNumber);
        button.setAttribute("role", "gridcell");
        button.setAttribute("aria-label", formatDate(new Date(year, month, dayNumber, 12)));
        if (key === today) button.classList.add("today");
        if (key === today) button.setAttribute("aria-current", "date");
        if (key === selectedDate) {
          button.classList.add("selected");
          button.setAttribute("aria-pressed", "true");
        } else button.setAttribute("aria-pressed", "false");
        button.onclick = () => onSelect(key);
        grid.appendChild(button);
      }
    }
    function renderGeorgianCalendar(): void {
      const month = calendarMonth.getMonth();
      const year = calendarMonth.getFullYear();
      $("calendar-month").textContent = georgianMonths[month] + " " + year;
      renderCalendarGrid("calendar-grid", year, month, calendarInput?.dataset.isoValue || "", key => {
        if (!calendarInput) return;
        setDateInputValue(calendarInput, key);
        calendarInput.dispatchEvent(new Event("change", { bubbles: true }));
        closeGeorgianCalendar();
      });
    }
    function renderDashboardCalendar(): void {
      const month = dashboardCalendarMonth.getMonth();
      const year = dashboardCalendarMonth.getFullYear();
      $("dashboard-calendar-month").textContent = georgianMonths[month] + " " + year;
      $("current-date-text").textContent = formatDate(currentDate);
      renderCalendarGrid("dashboard-calendar-grid", year, month, dateKey(currentDate), key => {
        const selected = parseDateKey(key);
        if (!selected) return;
        currentDate = selected;
        dashboardCalendarMonth = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
        setDateInputValue($<HTMLInputElement>("history-date"), dateKey(currentDate));
        renderDashboardCalendar();
        void loadHistory(dateKey(currentDate)).then(renderToday);
      });
    }
    function openGeorgianCalendar(input: HTMLInputElement, returnFocus: HTMLElement): void {
      calendarInput = input;
      calendarReturnFocus = returnFocus;
      const current = parseDateKey(input.dataset.isoValue || "") || new Date();
      calendarMonth = new Date(current.getFullYear(), current.getMonth(), 1, 12);
      input.setAttribute("aria-expanded", "true");
      returnFocus.setAttribute("aria-expanded", "true");
      renderGeorgianCalendar();
      $("georgian-calendar").classList.add("show");
      $("georgian-calendar").setAttribute("aria-hidden", "false");
      $("calendar-previous").focus();
    }
    function setupGeorgianDatePickers(): void {
      document.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach(input => {
        input.type = "text";
        input.readOnly = true;
        input.inputMode = "none";
        input.classList.add("georgian-date-input");
        input.setAttribute("aria-haspopup", "dialog");
        input.setAttribute("aria-expanded", "false");
        input.placeholder = "აირჩიეთ თარიღი";

        const label = Array.from(input.labels || []).map(item => item.textContent?.trim()).filter(Boolean).join(" ") || input.getAttribute("aria-label") || "თარიღის";
        const control = document.createElement("div");
        control.className = "date-picker-control";
        input.parentElement?.insertBefore(control, input);
        control.appendChild(input);

        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "icon-btn calendar-trigger";
        trigger.setAttribute("aria-label", label + " კალენდრის გახსნა");
        trigger.title = "კალენდრის გახსნა";
        trigger.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>';
        control.appendChild(trigger);
        input.onclick = () => openGeorgianCalendar(input, input);
        input.onkeydown = event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openGeorgianCalendar(input, input);
          }
        };
        trigger.onclick = () => openGeorgianCalendar(input, trigger);
      });
      $("dashboard-calendar-previous").onclick = () => {
        dashboardCalendarMonth = new Date(dashboardCalendarMonth.getFullYear(), dashboardCalendarMonth.getMonth() - 1, 1, 12);
        renderDashboardCalendar();
      };
      $("dashboard-calendar-next").onclick = () => {
        dashboardCalendarMonth = new Date(dashboardCalendarMonth.getFullYear(), dashboardCalendarMonth.getMonth() + 1, 1, 12);
        renderDashboardCalendar();
      };
      $("dashboard-today").onclick = () => {
        currentDate = new Date();
        currentDate.setHours(12, 0, 0, 0);
        dashboardCalendarMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 12);
        setDateInputValue($<HTMLInputElement>("history-date"), dateKey(currentDate));
        renderDashboardCalendar();
        void loadHistory(dateKey(currentDate)).then(renderToday);
      };
      $("calendar-previous").onclick = () => {
        calendarMonth.setMonth(calendarMonth.getMonth() - 1);
        renderGeorgianCalendar();
      };
      $("calendar-next").onclick = () => {
        calendarMonth.setMonth(calendarMonth.getMonth() + 1);
        renderGeorgianCalendar();
      };
      $("georgian-calendar").addEventListener("click", event => {
        if (event.target === $("georgian-calendar")) closeGeorgianCalendar();
      });
    }
    function timeInputValue(id: string): string {
      return $<HTMLInputElement>(id).dataset.timeValue || "";
    }
    function setTimeInputValue(input: HTMLInputElement, value: string): void {
      input.dataset.timeValue = value;
      input.value = value;
    }
    function closeTimePicker(): void {
      $("time-picker").classList.remove("show");
      $("time-picker").setAttribute("aria-hidden", "true");
      timePickerInput?.setAttribute("aria-expanded", "false");
      if (timePickerReturnFocus) timePickerReturnFocus.focus();
      timePickerInput = null;
      timePickerReturnFocus = null;
    }
    function openTimePicker(input: HTMLInputElement, returnFocus: HTMLElement): void {
      timePickerInput = input;
      timePickerReturnFocus = returnFocus;
      const current = input.dataset.timeValue || "08:00";
      const [hour, minute] = current.split(":");
      $<HTMLSelectElement>("time-hour").value = hour;
      $<HTMLSelectElement>("time-minute").value = minute;
      input.setAttribute("aria-expanded", "true");
      $("time-picker").classList.add("show");
      $("time-picker").setAttribute("aria-hidden", "false");
      $("time-hour").focus();
    }
    function setup24HourTimePickers(): void {
      const hourSelect = $<HTMLSelectElement>("time-hour");
      const minuteSelect = $<HTMLSelectElement>("time-minute");
      for (let hour = 0; hour < 24; hour++) {
        const option = document.createElement("option");
        option.value = pad(hour);
        option.textContent = pad(hour);
        hourSelect.appendChild(option);
      }
      for (let minute = 0; minute < 60; minute++) {
        const option = document.createElement("option");
        option.value = pad(minute);
        option.textContent = pad(minute);
        minuteSelect.appendChild(option);
      }
      document.querySelectorAll<HTMLInputElement>('input[aria-label*="დრო"], input[aria-label*="საათი"]').forEach(input => {
        const initialValue = input.value;
        input.readOnly = true;
        input.inputMode = "none";
        input.classList.add("time-input");
        input.setAttribute("aria-haspopup", "dialog");
        input.setAttribute("aria-expanded", "false");
        input.placeholder = "აირჩიეთ დრო (24 სთ)";
        setTimeInputValue(input, initialValue);

        const control = document.createElement("div");
        control.className = "time-picker-control";
        input.parentElement?.insertBefore(control, input);
        control.appendChild(input);
        const label = input.getAttribute("aria-label") || "დროის";
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "icon-btn time-trigger";
        trigger.setAttribute("aria-label", label + " არჩევა 24-საათიან ფორმატში");
        trigger.title = "დროის არჩევა (24 სთ)";
        trigger.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
        control.appendChild(trigger);
        input.onclick = () => openTimePicker(input, input);
        input.onkeydown = event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openTimePicker(input, input);
          }
        };
        trigger.onclick = () => openTimePicker(input, trigger);
      });
      $("cancel-time").onclick = closeTimePicker;
      $("confirm-time").onclick = () => {
        if (timePickerInput) {
          const value = $<HTMLSelectElement>("time-hour").value + ":" + $<HTMLSelectElement>("time-minute").value;
          setTimeInputValue(timePickerInput, value);
          timePickerInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
        closeTimePicker();
      };
      $("time-picker").addEventListener("click", event => {
        if (event.target === $("time-picker")) closeTimePicker();
      });
    }
    const timeToMin = (time: string): number => {
      const parts = String(time).split(":").map(Number);
      return parts[0] * 60 + parts[1];
    };
    function formatDate(date: Date): string {
      const days = ["კვირა", "ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი"];
      const months = ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"];
      return days[date.getDay()] + ", " + date.getDate() + " " + months[date.getMonth()] + " " + date.getFullYear();
    }
    function esc(value: unknown): string {
      const node = document.createElement("span");
      node.textContent = value == null ? "" : String(value);
      return node.innerHTML;
    }
    function errorMessage(error: unknown, fallback: string): string {
      return error instanceof Error ? error.message : fallback;
    }
    function isDateValue(value: unknown): value is string {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const date = new Date(value + "T00:00:00Z");
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }
    function validMedicationList(value: unknown): value is Medication[] {
      if (!Array.isArray(value)) return false;
      const ids = new Set<string>();
      return value.every((candidate: unknown) => {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
        const med = candidate as Record<string, unknown>;
        if (typeof med.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(med.id) || ids.has(med.id) ||
          typeof med.name !== "string" || !med.name.trim() || typeof med.dose !== "string" ||
          (med.note !== undefined && typeof med.note !== "string") ||
          (med.continuous !== undefined && typeof med.continuous !== "boolean") ||
          !Array.isArray(med.times) || !med.times.length) return false;
        const times = new Set<string>();
        if (!med.times.every((time: unknown) => {
          if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || times.has(time)) return false;
          times.add(time);
          return true;
        })) return false;
        if (med.startDate !== undefined && !isDateValue(med.startDate)) return false;
        if (med.endDate !== undefined && !isDateValue(med.endDate)) return false;
        if (typeof med.startDate === "string" && typeof med.endDate === "string" && med.startDate > med.endDate) return false;
        ids.add(med.id);
        return true;
      });
    }
    function validImportantDateList(value: unknown): value is ImportantDate[] {
      return Array.isArray(value) && value.every((candidate: unknown) => {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
        const item = candidate as Record<string, unknown>;
        return typeof item.label === "string" && Boolean(item.label.trim()) && isDateValue(item.date) &&
          (item.time === "" || (typeof item.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.time)));
      });
    }
    function readLocal<T>(key: string, fallback: T): T {
      let value: string | null = null;
      try {
        value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
      } catch {
        return key === "medNotes" && typeof value === "string" ? value as T : fallback;
      }
    }
    function setStatus(text: string): void { $("sync-status").textContent = text; }
    function isActiveOn(med: Medication, day: Date): boolean {
      const key = dateKey(day);
      return (!med.startDate || key >= med.startDate) && (!med.endDate || key <= med.endDate);
    }
    function getDoseStatus(med: Medication, time: string, history: DoseHistory, day: Date): DoseDisplayStatus {
      const record = history[med.id + "|" + time];
      if (record && record.status) return record.status;
      if (dateKey(day) !== dateKey(new Date())) return "scheduled";
      const diff = new Date().getHours() * 60 + new Date().getMinutes() - timeToMin(time);
      if (diff >= 0 && diff <= 45) return "due";
      if (diff > 45) return "overdue";
      if (diff >= -30) return "upcoming";
      return "scheduled";
    }
    async function request(url: string, options?: RequestInit): Promise<Response> {
      const response = await fetch(url, options || {});
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "მოთხოვნა ვერ შესრულდა");
      }
      return response;
    }

    async function initializeApp() {
      await loadFromServer();
      try {
        await migrateLocalHistory(dateKey(currentDate));
      } catch (error) {
        setStatus("ძველი ჩანაწერების მიგრაცია ვერ მოხერხდა: " + errorMessage(error, "უცნობი შეცდომა"));
      }
      await loadHistory(dateKey(currentDate));
      renderToday();
      updateClock();
    }

    async function loadFromServer() {
      setStatus("იტვირთება...");
      try {
        const response = await request("/api/meds", { cache: "no-store" });
        const data = await response.json();
        if (!validMedicationList(data.medications) || !validMedicationList(data.defaults) || !validImportantDateList(data.dates)) throw new Error("სერვერის მონაცემების ფორმატი არასწორია");
        medications = data.medications;
        defaultMedications = data.defaults;
        importantDates = data.dates;
        renderEdit();
        renderImportantDates();
        const pending = readLocal<boolean>("medDraftPending", false) === true;
        if (pending) {
          const draft = readLocal("medDraft", null);
          if (validMedicationList(draft)) {
            medications = draft;
            setStatus("ამ მოწყობილობაზე შენახული ცვლილებები ჯერ სერვერზე არ ატვირთულა.");
          } else setStatus("გრაფიკი სერვერიდან ჩაიტვირთა.");
        } else setStatus("გრაფიკი სერვერიდან ჩაიტვირთა.");
        renderEdit();
      } catch (error) {
        setStatus("გრაფიკის ჩატვირთვა ვერ მოხერხდა: " + errorMessage(error, "უცნობი შეცდომა"));
      }
    }
    function saveDraft() {
      try {
        localStorage.setItem("medDraft", JSON.stringify(medications));
        localStorage.setItem("medDraftPending", "true");
        setStatus("ცვლილებები ამ მოწყობილობაზეა. დააჭირეთ „გრაფიკის შენახვა“ სინქრონიზაციისთვის.");
        return true;
      } catch (error) {
        setStatus("ცვლილებების ამ მოწყობილობაზე შენახვა ვერ მოხერხდა.");
        return false;
      }
    }
    async function saveToServer() {
      setStatus("ინახება...");
      try {
        await request("/api/meds", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ medications, dates: importantDates })
        });
        localStorage.setItem("medDraft", JSON.stringify(medications));
        localStorage.setItem("medDraftPending", "false");
        setStatus("გრაფიკი და მნიშვნელოვანი თარიღები სერვერზე შეინახა · " + new Date().toLocaleTimeString("ka-GE", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }));
        renderToday();
      } catch (error) {
        setStatus("სერვერზე შენახვა ვერ მოხერხდა: " + errorMessage(error, "უცნობი შეცდომა"));
      }
    }

    async function loadHistory(day: string): Promise<void> {
      try {
        const response = await request("/api/history?date=" + encodeURIComponent(day), { cache: "no-store" });
        doseHistory = await response.json() as DoseHistory;
        renderToday();
      } catch (error) {
        doseHistory = {};
        setStatus("მიღების ისტორია ვერ ჩაიტვირთა: " + errorMessage(error, "უცნობი შეცდომა"));
      }
    }
    async function migrateLocalHistory(day: string): Promise<void> {
      const storedHistory = readLocal<unknown>("medTaken", {});
      const localHistory: Record<string, unknown> = storedHistory && typeof storedHistory === "object" && !Array.isArray(storedHistory)
        ? storedHistory as Record<string, unknown>
        : {};
      const migratedDays = readLocal<unknown>("medHistoryMigratedDays", []);
      const completed = new Set<string>(Array.isArray(migratedDays) ? migratedDays.filter((item): item is string => typeof item === "string") : []);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 400);
      if (completed.has(day) || day < dateKey(cutoff)) return;
      const oldRecords = localHistory[day];
      const oldSlots: Record<string, unknown> = oldRecords && typeof oldRecords === "object" && !Array.isArray(oldRecords)
        ? oldRecords as Record<string, unknown>
        : {};
      const entries: { medicationId: string; time: string; status: "taken" }[] = [];
      Object.entries(oldSlots).filter(([, value]) => value === true).forEach(([slot]) => {
          const [medicationId, time] = slot.split("|");
          if (/^[A-Za-z0-9_-]{1,80}$/.test(medicationId || "") && /^([01]\d|2[0-3]):[0-5]\d$/.test(time || "")) {
            entries.push({ medicationId, time, status: "taken" });
          }
        });
      if (entries.length) {
        const existingResponse = await request("/api/history?date=" + encodeURIComponent(day), { cache: "no-store" });
        const existing: DoseHistory = await existingResponse.json();
        const missing = entries.filter(entry => !existing[entry.medicationId + "|" + entry.time]);
        if (missing.length) {
          await request("/api/history", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: day, records: missing })
          });
          setStatus(missing.length + " ძველი მიღების ჩანაწერი სერვერზე გადაიტანა.");
        }
      }
      completed.add(day);
      localStorage.setItem("medHistoryMigratedDays", JSON.stringify(Array.from(completed)));
    }
    async function setDoseRecord(medicationId: string, time: string, status: DoseRecordStatus, snoozeUntil?: string, snoozeDate?: string) {
      const day = dateKey(currentDate);
      const slot = medicationId + "|" + time;
      const previous = doseHistory[slot] || null;
      try {
        const response = await request("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: day, medicationId, time, status, ...(snoozeUntil ? { snoozeUntil, snoozeDate } : {}) })
        });
        doseHistory = await response.json() as DoseHistory;
        lastDoseChange = { day, medicationId, time, previous };
        $("undo-dose").hidden = false;
        $("undo-dose").textContent = "გაუქმება";
        renderToday();
      } catch (error) {
        setStatus("დოზის სტატუსი ვერ შეინახა: " + errorMessage(error, "უცნობი შეცდომა"));
      }
    }
    async function clearDoseRecord(medicationId: string, time: string) {
      const day = dateKey(currentDate);
      const slot = medicationId + "|" + time;
      const previous = doseHistory[slot] || null;
      try {
        const response = await request("/api/history?date=" + encodeURIComponent(day) + "&medicationId=" + encodeURIComponent(medicationId) + "&time=" + encodeURIComponent(time), { method: "DELETE" });
        doseHistory = await response.json();
        lastDoseChange = { day, medicationId, time, previous };
        $("undo-dose").hidden = false;
        renderToday();
      } catch (error) {
        setStatus("დოზის სტატუსის აღდგენა ვერ მოხერხდა: " + errorMessage(error, "უცნობი შეცდომა"));
      }
    }
    $("undo-dose").onclick = async () => {
      if (!lastDoseChange) return;
      const { day, medicationId, time, previous } = lastDoseChange;
      const slot = medicationId + "|" + time;
      try {
        if (previous) {
          const response = await request("/api/history", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: day, medicationId, time, status: previous.status, ...(previous.snoozeUntil ? { snoozeUntil: previous.snoozeUntil, snoozeDate: previous.snoozeDate } : {}) })
          });
          if (day === dateKey(currentDate)) doseHistory = await response.json() as DoseHistory;
        } else {
          const response = await request("/api/history?date=" + encodeURIComponent(day) + "&medicationId=" + encodeURIComponent(medicationId) + "&time=" + encodeURIComponent(time), { method: "DELETE" });
          if (day === dateKey(currentDate)) delete doseHistory[slot];
        }
        lastDoseChange = null;
        $("undo-dose").hidden = true;
        renderToday();
        setStatus("ბოლო ცვლილება გაუქმდა.");
      } catch (error) {
        setStatus("ცვლილების გაუქმება ვერ მოხერხდა: " + errorMessage(error, "უცნობი შეცდომა"));
      }
    };

    function renderToday(): void {
      dashboardCalendarMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 12);
      renderDashboardCalendar();
      $("today-list").innerHTML = "";
      const items: DoseItem[] = [];
      medications.filter(med => isActiveOn(med, currentDate)).forEach(med => {
        med.times.forEach(time => items.push({ med, time, status: "scheduled" }));
      });
      items.sort((a, b) => timeToMin(a.time) - timeToMin(b.time));
      let taken = 0;
      let skipped = 0;
      items.forEach(item => {
        item.status = getDoseStatus(item.med, item.time, doseHistory, currentDate);
        if (item.status === "taken") taken++;
        if (item.status === "skipped") skipped++;
      });
      const nextItem: DoseItem | null = items.find(item =>
        item.status !== "taken" && item.status !== "skipped" && item.status !== "overdue"
      ) || null;
      $("next-dose").hidden = !nextItem;
      if (nextItem) {
        const nextRecord = doseHistory[nextItem.med.id + "|" + nextItem.time];
        const doseTime = nextItem.status === "snoozed"
          ? (nextRecord.snoozeDate && nextRecord.snoozeDate !== dateKey(currentDate) ? nextRecord.snoozeDate + " · " : "") + (nextRecord.snoozeUntil || nextItem.time)
          : nextItem.time;
        $("next-dose").innerHTML = '<div class="next-dose-icon">→</div><div><p class="next-dose-label">შემდეგი დოზა</p><p class="next-dose-name">' + esc(nextItem.med.name) + '</p><p class="next-dose-detail">' + doseTime + ' · ' + esc(nextItem.med.dose) + '</p></div>';
      }
      if (!items.length) $("today-list").innerHTML = '<div class="empty">ამ დღისთვის აქტიური დოზები არ არის. შეამოწმეთ მედიკამენტების კურსის თარიღები.</div>';
      let lastTime: string | null = null;
      items.forEach(item => {
        if (item.time !== lastTime) {
          const heading = document.createElement("h3");
          heading.className = "time-heading";
          heading.textContent = item.time;
          $("today-list").appendChild(heading);
          lastTime = item.time;
        }
        const record = doseHistory[item.med.id + "|" + item.time];
        const card = document.createElement("article");
        card.className = "med-card";
        card.dataset.status = item.status;
        let statusText = item.status === "taken" ? "მიღებულია" :
          item.status === "skipped" ? "გამოტოვებულია" :
          item.status === "snoozed" ? "შეყოვნებულია · " + (record.snoozeUntil || "") + (record.snoozeDate && record.snoozeDate !== dateKey(currentDate) ? " · " + record.snoozeDate : "") :
          item.status === "overdue" ? "დაგვიანებულია" :
          item.status === "due" ? "ახლა" :
          item.status === "upcoming" ? "მალე" : "დაგეგმილი";
        let actionMarkup = "";
        if (item.status === "taken" || item.status === "skipped") {
          actionMarkup = '<button class="btn btn-secondary btn-small undo-item" type="button" data-id="' + esc(item.med.id) + '" data-time="' + item.time + '">აღდგენა</button>';
        } else {
          actionMarkup = '<button class="btn btn-primary btn-small take-dose-action" type="button" data-id="' + esc(item.med.id) + '" data-time="' + item.time + '" aria-label="დოზის მიღებულად მონიშვნა">მივიღე</button>' +
            '<button class="btn btn-secondary btn-small skip-dose-action" type="button" data-id="' + esc(item.med.id) + '" data-time="' + item.time + '" aria-label="დოზის გამოტოვებულად მონიშვნა" title="დოზის გამოტოვებულად მონიშვნა">გამოტოვება</button>' +
            (dateKey(currentDate) === dateKey(new Date()) ? '<button class="btn btn-secondary btn-small snooze-action" type="button" data-id="' + esc(item.med.id) + '" data-time="' + item.time + '" aria-label="შეხსენების 10 წუთით გადადება" title="შეხსენების 10 წუთით გადადება">გადადება 10 წთ</button>' : '');
        }
        card.innerHTML = '<div class="med-header"><div class="next-dose-icon" aria-hidden="true">' + (item.status === "taken" ? "✓" : "•") + '</div><div class="med-info"><div class="med-name">' + esc(item.med.name) + '</div><div class="med-dose">' + esc(item.med.dose) + '</div>' +
          (item.med.note ? '<div class="med-note">' + esc(item.med.note) + '</div>' : '') +
          (item.med.continuous === false && !item.med.endDate ? '<div class="med-extra">კურსის დასრულების თარიღი მითითებული არ არის</div>' : '') +
          '<div class="med-extra"><span class="dose-time">' + item.time + '</span>' + (item.med.endDate ? ' · კურსი სრულდება ' + esc(item.med.endDate) : '') + '</div>' +
          '<span class="status-tag ' + esc(item.status) + '">' + esc(statusText) + '</span></div></div><div class="dose-actions">' + actionMarkup + '</div>';
        $("today-list").appendChild(card);
      });
      const total = items.length;
      $("progress-text").textContent = taken + " / " + total;
      $("progress-detail").textContent = "მიღებულია " + taken + " · გამოტოვებულია " + skipped;
      $("progress-fill").style.width = total ? Math.round(taken / total * 100) + "%" : "0%";
      const bar = document.querySelector<HTMLElement>(".progress-bar");
      if (bar) {
        bar.setAttribute("aria-valuemax", String(total));
        bar.setAttribute("aria-valuenow", String(taken));
      }
      $("today-list").querySelectorAll<HTMLButtonElement>(".take-dose-action").forEach(button => {
        button.onclick = () => setDoseRecord(button.dataset.id || "", button.dataset.time || "", "taken");
      });
      $("today-list").querySelectorAll<HTMLButtonElement>(".skip-dose-action").forEach(button => {
        button.onclick = () => setDoseRecord(button.dataset.id || "", button.dataset.time || "", "skipped");
      });
      $("today-list").querySelectorAll<HTMLButtonElement>(".snooze-action").forEach(button => {
        button.onclick = () => {
          const now = new Date();
          now.setMinutes(now.getMinutes() + 10);
          setDoseRecord(button.dataset.id || "", button.dataset.time || "", "snoozed", pad(now.getHours()) + ":" + pad(now.getMinutes()), dateKey(now));
        };
      });
      $("today-list").querySelectorAll<HTMLButtonElement>(".undo-item").forEach(button => button.onclick = () => clearDoseRecord(button.dataset.id || "", button.dataset.time || ""));
    }

    function renderEdit(): void {
      $("edit-list").innerHTML = "";
      if (!medications.length) {
        $("edit-list").innerHTML = '<div class="empty">გრაფიკი ცარიელია. დასაწყებად დაამატეთ წამალი.</div>';
        return;
      }
      medications.forEach((med, index) => {
        const card = document.createElement("article");
        card.className = "edit-card";
        card.draggable = true;
        card.innerHTML = '<div style="display:flex;align-items:flex-start;gap:12px"><div class="med-info"><div class="med-name">' + esc(med.name) +
          '</div><div class="med-dose">' + esc(med.dose) + ' · ' + med.times.join(" / ") + '</div><div class="med-note">' +
          (med.continuous ? "უწყვეტი" : "დროებითი კურსი") + (med.startDate ? " · " + esc(med.startDate) + " - " : "") + (med.endDate ? esc(med.endDate) : "") +
          (med.note ? " · " + esc(med.note) : "") + '</div></div><div class="edit-actions"><button class="icon-btn edit-icon-btn edit-btn" type="button" data-id="' + esc(med.id) + '" aria-label="რედაქტირება: ' + esc(med.name) + '" title="რედაქტირება"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button>' +
          '<button class="icon-btn move-btn" type="button" data-index="' + index + '" data-direction="-1" aria-label="ზემოთ გადაადგილება"' + (index === 0 ? " disabled" : "") + '>↑</button>' +
          '<button class="icon-btn move-btn" type="button" data-index="' + index + '" data-direction="1" aria-label="ქვემოთ გადაადგილება"' + (index === medications.length - 1 ? " disabled" : "") + '>↓</button></div></div>';
        $("edit-list").appendChild(card);
        card.addEventListener("dragstart", event => {
          if (!event.dataTransfer) return;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", String(index));
          card.classList.add("dragging");
        });
        card.addEventListener("dragend", () => card.classList.remove("dragging"));
        card.addEventListener("dragover", event => { event.preventDefault(); card.classList.add("drag-over"); });
        card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
        card.addEventListener("drop", event => {
          event.preventDefault();
          if (!event.dataTransfer) return;
          const from = Number(event.dataTransfer.getData("text/plain"));
          if (!Number.isInteger(from) || from < 0 || from >= medications.length || from === index) return;
          const moved = medications.splice(from, 1)[0];
          medications.splice(index, 0, moved);
          saveDraft(); renderEdit(); renderToday();
        });
      });
      $("edit-list").querySelectorAll<HTMLButtonElement>(".edit-btn").forEach(button => button.onclick = () => openModal(button.dataset.id || null));
      $("edit-list").querySelectorAll<HTMLButtonElement>(".move-btn").forEach(button => button.onclick = () => {
        const from = Number(button.dataset.index);
        const to = from + Number(button.dataset.direction);
        if (to < 0 || to >= medications.length) return;
        medications.splice(to, 0, medications.splice(from, 1)[0]);
        saveDraft(); renderEdit(); renderToday();
      });
    }
    function renderImportantDates(): void {
      $("important-dates").innerHTML = importantDates.length ? importantDates.map((item, index) =>
        '<div class="important-date" style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><strong>' + esc(item.label) + '</strong><span>' + esc(item.date) + (item.time ? ' · ' + esc(item.time) : '') + '</span></div><button class="btn btn-danger btn-small remove-date" type="button" data-index="' + index + '">წაშლა</button></div>'
      ).join("") : '<div class="empty">მნიშვნელოვანი თარიღები დამატებული არ არის.</div>';
      $("important-dates").querySelectorAll<HTMLButtonElement>(".remove-date").forEach(button => button.onclick = () => {
        importantDates.splice(Number(button.dataset.index), 1);
        renderImportantDates();
        setStatus("თარიღის წაშლა ჯერ არ არის სერვერზე შენახული.");
      });
    }
    async function renderHistory(): Promise<void> {
      const date = dateInputValue("history-date") || dateKey(currentDate);
      $("history-list").innerHTML = '<p class="history-summary">ისტორია იტვირთება...</p>';
      try {
        await migrateLocalHistory(date);
        const response = await request("/api/history?date=" + encodeURIComponent(date), { cache: "no-store" });
        const records: DoseHistory = await response.json();
        const entries = Object.entries(records);
        if (!entries.length) {
          $("history-list").innerHTML = '<p class="history-summary">ამ დღისთვის მონიშნული დოზები არ არის.</p>';
          return;
        }
        const medsById = new Map(medications.map(med => [med.id, med]));
        const count = (status: DoseRecordStatus): number => entries.filter(([, record]) => record.status === status).length;
        $("history-list").innerHTML = '<p class="history-summary">მიღებულია ' + count("taken") + ' · გამოტოვებულია ' + count("skipped") + ' · შეყოვნებულია ' + count("snoozed") + '</p>' +
          entries.sort((a, b) => a[0].split("|")[1].localeCompare(b[0].split("|")[1])).map(([key, record]) => {
            const [id, time] = key.split("|");
            const med = medsById.get(id);
            const label = record.status === "taken" ? "მიღებულია" : record.status === "skipped" ? "გამოტოვებულია" : "შეყოვნებულია";
            const recordedAt = record.updatedAt ? new Date(record.updatedAt).toLocaleTimeString("ka-GE", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "";
            return '<div class="history-item"><span><strong>' + esc(time) + '</strong> · ' + esc(med ? med.name : "წაშლილი წამალი") +
              '<br><span class="muted">' + esc(med ? med.dose : "") + (recordedAt ? ' · მონიშნულია ' + esc(recordedAt) : "") + '</span></span><span>' + esc(label) + (record.snoozeUntil ? '<br><span class="muted">შეხსენება: ' + esc(record.snoozeDate || date) + ' ' + esc(record.snoozeUntil) + '</span>' : '') + '</span></div>';
          }).join("");
      } catch (error) {
        $("history-list").innerHTML = '<p class="history-summary">' + esc(errorMessage(error, "ისტორიის ჩატვირთვა ვერ მოხერხდა.")) + '</p>';
      }
    }

    function openModal(id: string | null): void {
      editId = id || null;
      modalTimes = [];
      modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      $("modal-title").textContent = id ? "წამლის რედაქტირება" : "ახალი წამალი";
      $("m-delete").hidden = !id;
      const med = id ? medications.find(item => item.id === id) : null;
      $<HTMLInputElement>("m-name").value = med ? med.name : "";
      $<HTMLInputElement>("m-dose").value = med ? med.dose : "";
      $<HTMLInputElement>("m-note").value = med ? med.note || "" : "";
      $<HTMLSelectElement>("m-cont").value = med && med.continuous === false ? "0" : "1";
      setDateInputValue($<HTMLInputElement>("m-start"), med ? med.startDate || "" : "");
      setDateInputValue($<HTMLInputElement>("m-end"), med ? med.endDate || "" : "");
      modalTimes = med ? med.times.slice() : ["08:00"];
      renderModalTimes();
      $("modal").classList.add("show");
      $("modal").setAttribute("aria-hidden", "false");
      $("m-name").focus();
    }
    function renderModalTimes(): void {
      $("m-times").innerHTML = "";
      modalTimes.sort((a, b) => timeToMin(a) - timeToMin(b));
      modalTimes.forEach((time, index) => {
        const chip = document.createElement("div");
        chip.className = "time-chip";
        chip.innerHTML = esc(time) + ' <button type="button" aria-label="' + esc(time) + ' საათის წაშლა" data-index="' + index + '">×</button>';
        $("m-times").appendChild(chip);
      });
      $("m-times").querySelectorAll<HTMLButtonElement>("button").forEach(button => button.onclick = () => {
        modalTimes.splice(Number(button.dataset.index), 1);
        renderModalTimes();
      });
    }
    function closeModal(): void {
      $("modal").classList.remove("show");
      $("modal").setAttribute("aria-hidden", "true");
      editId = null;
      if (modalReturnFocus && typeof modalReturnFocus.focus === "function") modalReturnFocus.focus();
    }
    $("m-add-time").onclick = () => {
      const time = timeInputValue("m-new-time");
      if (time && !modalTimes.includes(time)) { modalTimes.push(time); renderModalTimes(); }
    };
    $("m-save").onclick = () => {
      const name = $<HTMLInputElement>("m-name").value.trim();
      const startDate = dateInputValue("m-start");
      const endDate = dateInputValue("m-end");
      $("m-name-error").hidden = Boolean(name);
      $("m-name").setAttribute("aria-invalid", name ? "false" : "true");
      if (!name) { $("m-name").focus(); return; }
      if (!modalTimes.length) { setStatus("მიუთითეთ სულ მცირე ერთი მიღების საათი."); $("m-new-time").focus(); return; }
      if (startDate && endDate && startDate > endDate) { setStatus("კურსის დასრულების თარიღი დაწყების თარიღზე ადრეა."); $("m-end").focus(); return; }
      const updated = {
        id: editId || uid(), name, dose: $<HTMLInputElement>("m-dose").value.trim(), note: $<HTMLInputElement>("m-note").value.trim(),
        continuous: $<HTMLSelectElement>("m-cont").value === "1", times: modalTimes.slice(),
        ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {})
      };
      const index = medications.findIndex(item => item.id === editId);
      if (index >= 0) medications[index] = updated;
      else medications.push(updated);
      saveDraft(); closeModal(); renderEdit(); renderToday();
    };
    $("m-delete").onclick = () => {
      if (!editId || !confirm("გსურთ ამ წამლის წაშლა?")) return;
      medications = medications.filter(item => item.id !== editId);
      saveDraft(); closeModal(); renderEdit(); renderToday();
    };
    $("m-cancel").onclick = $("modal-close").onclick = closeModal;
    $("modal").addEventListener("click", event => { if (event.target === $("modal")) closeModal(); });
    document.addEventListener("keydown", event => {
      if ($("modal").classList.contains("show") && event.key === "Escape") closeModal();
      if ($("reset-confirmation").classList.contains("show") && event.key === "Escape") closeResetConfirmation();
      if ($("clear-day-confirmation").classList.contains("show") && event.key === "Escape") closeClearDayConfirmation();
      if ($("georgian-calendar").classList.contains("show") && event.key === "Escape") closeGeorgianCalendar();
      if ($("time-picker").classList.contains("show") && event.key === "Escape") closeTimePicker();
    });

    document.querySelectorAll<HTMLButtonElement>(".tab").forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll<HTMLButtonElement>(".tab").forEach(item => {
          item.classList.toggle("active", item === tab);
          item.setAttribute("aria-selected", String(item === tab));
        });
        document.querySelectorAll<HTMLElement>('[role="tabpanel"]').forEach(panel => { panel.hidden = panel.id !== tab.getAttribute("aria-controls"); });
        const view = tab.dataset.tab;
        $("today-actions").classList.toggle("hidden", view !== "today");
        if (view === "meds") renderEdit();
        if (view === "history") renderHistory();
      };
      tab.onkeydown = event => {
        const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab"));
        let index = tabs.indexOf(tab);
        if (event.key === "ArrowRight") index = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") index = (index - 1 + tabs.length) % tabs.length;
        else return;
        event.preventDefault(); tabs[index].focus(); tabs[index].click();
      };
    });
    setup24HourTimePickers();
    $("load-history").onclick = renderHistory;
    setupGeorgianDatePickers();
    setDateInputValue($<HTMLInputElement>("history-date"), dateKey(currentDate));
    $("history-date").onchange = renderHistory;
    $("add-med-btn").onclick = () => openModal(null);
    $("save-server").onclick = saveToServer;
    $("add-date").onclick = () => {
      const label = $<HTMLInputElement>("date-label").value.trim();
      const date = dateInputValue("date-value");
      if (!label || !date) { setStatus("მიუთითეთ თარიღის დასახელება და თარიღი."); return; }
      importantDates.push({ label, date, time: timeInputValue("date-time") });
      $<HTMLInputElement>("date-label").value = "";
      setDateInputValue($<HTMLInputElement>("date-value"), "");
      setTimeInputValue($<HTMLInputElement>("date-time"), "");
      renderImportantDates();
      setStatus("თარიღი დაემატა. ცვლილების დასამახსოვრებლად დააჭირეთ „თარიღების შენახვა“.");
    };
    $("save-dates").onclick = saveToServer;
    function closeResetConfirmation(): void {
      $("reset-confirmation").classList.remove("show");
      $("reset-confirmation").setAttribute("aria-hidden", "true");
      if (resetConfirmationReturnFocus) resetConfirmationReturnFocus.focus();
      resetConfirmationReturnFocus = null;
    }
    $("reset-defaults").onclick = () => {
      resetConfirmationReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      $("reset-confirmation").classList.add("show");
      $("reset-confirmation").setAttribute("aria-hidden", "false");
      $("cancel-reset-defaults").focus();
    };
    $("cancel-reset-defaults").onclick = closeResetConfirmation;
    $("confirm-reset-defaults").onclick = () => {
      medications = JSON.parse(JSON.stringify(defaultMedications));
      saveDraft(); renderEdit(); renderToday();
      closeResetConfirmation();
    };
    $("reset-confirmation").addEventListener("click", event => {
      if (event.target === $("reset-confirmation")) closeResetConfirmation();
    });
    function closeClearDayConfirmation(): void {
      $("clear-day-confirmation").classList.remove("show");
      $("clear-day-confirmation").setAttribute("aria-hidden", "true");
      if (clearDayConfirmationReturnFocus) clearDayConfirmationReturnFocus.focus();
      clearDayConfirmationReturnFocus = null;
    }
    $("reset-day").onclick = () => {
      clearDayConfirmationReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      $("clear-day-confirmation").classList.add("show");
      $("clear-day-confirmation").setAttribute("aria-hidden", "false");
      $("cancel-clear-day").focus();
    };
    $("cancel-clear-day").onclick = closeClearDayConfirmation;
    $("confirm-clear-day").onclick = async () => {
      closeClearDayConfirmation();
      try {
        await request("/api/history?date=" + encodeURIComponent(dateKey(currentDate)), { method: "DELETE" });
        doseHistory = {};
        lastDoseChange = null;
        $("undo-dose").hidden = true;
        renderToday();
        setStatus("არჩეული დღის ისტორია წაიშალა.");
      } catch (error) { setStatus("ისტორიის წაშლა ვერ მოხერხდა: " + errorMessage(error, "უცნობი შეცდომა")); }
    };
    $("clear-day-confirmation").addEventListener("click", event => {
      if (event.target === $("clear-day-confirmation")) closeClearDayConfirmation();
    });
    $("export-data").onclick = () => {
      const data = { medications, importantDates, exportedAt: new Date().toISOString() };
      const link = document.createElement("a");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      link.href = url;
      link.download = "medication-schedule.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const notesEl = $<HTMLTextAreaElement>("notes-text");
    notesEl.value = readLocal("medNotes", "");
    notesEl.oninput = () => {
      try { localStorage.setItem("medNotes", JSON.stringify(notesEl.value)); }
      catch (error) { setStatus("შენიშვნები ამ მოწყობილობაზე ვერ შეინახა."); }
    };
    function updateClock() {
      const now = new Date();
      $("live-clock").textContent = "ახლა " + pad(now.getHours()) + ":" + pad(now.getMinutes());
    }
    void initializeApp();
    setInterval(() => {
      updateClock();
      if (dateKey(currentDate) === dateKey(new Date())) renderToday();
    }, 30000);
  