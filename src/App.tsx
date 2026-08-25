import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Terminal,
  Bookmark,
} from "lucide-react";

interface WorkArea {
  id: string;
  code: string;
  description: string;
  percentage: number;
}

type DayType = "normal" | "helgdag" | "halvHelgdag";

const DAY_NAMES = ["Mån", "Tis", "Ons", "Tor", "Fre"];
const DAY_BASE_HOURS: Record<DayType, number> = { normal: 8, halvHelgdag: 4, helgdag: 0 };
// ── Date utilities ────────────────────────────────────────

function getISOWeekInfo(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

function getMondayForISOWeek(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  const dow = jan4.getDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - (dow - 1));
  const monday = new Date(week1Mon);
  monday.setDate(week1Mon.getDate() + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getISOWeeksInYear(year: number): number {
  const dec28 = new Date(year, 11, 28);
  return getISOWeekInfo(dec28).week;
}

function getWeekDays(monday: Date): Date[] {
  return [0, 1, 2, 3, 4].map((i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

function dateToKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// ── Swedish public holidays ───────────────────────────────

function getEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getSwedishHolidays(year: number): Record<string, string> {
  const holidays: Record<string, string> = {};
  const add = (date: Date, name: string) => {
    holidays[dateToKey(date)] = name;
  };

  // Fixed holidays
  add(new Date(year, 0, 1), "Nyårsdagen");
  add(new Date(year, 0, 6), "Trettondedag jul");
  add(new Date(year, 4, 1), "Första maj");
  add(new Date(year, 5, 6), "Nationaldagen");
  add(new Date(year, 11, 25), "Juldagen");
  add(new Date(year, 11, 26), "Annandag jul");

  // Easter-based
  const easter = getEaster(year);
  add(addDays(easter, -2), "Långfredag");
  add(easter, "Påskdagen");
  add(addDays(easter, 1), "Annandag påsk");
  add(addDays(easter, 39), "Kristi himmelsfärdsdag");
  add(addDays(easter, 49), "Pingstdagen");

  // Midsommardagen: first Saturday on/after Jun 20
  const midsommar = new Date(year, 5, 20);
  while (midsommar.getDay() !== 6) midsommar.setDate(midsommar.getDate() + 1);
  add(midsommar, "Midsommardagen");

  // Alla helgons dag: first Saturday on/after Oct 31
  const allaSaints = new Date(year, 10, 31);
  while (allaSaints.getDay() !== 6) allaSaints.setDate(allaSaints.getDate() + 1);
  add(allaSaints, "Alla helgons dag");

  return holidays;
}

function buildHolidayMap(days: Date[]): Record<string, string> {
  const years = [...new Set(days.map((d) => d.getFullYear()))];
  const map: Record<string, string> = {};
  years.forEach((y) => Object.assign(map, getSwedishHolidays(y)));
  return map;
}

function getInitialDayTypes(days: Date[]): DayType[] {
  const map = buildHolidayMap(days);
  return days.map((d) => (map[dateToKey(d)] ? "helgdag" : "normal"));
}

function getPreviousWeek(): { week: number; year: number } {
  const prev = new Date();
  prev.setDate(prev.getDate() - 7);
  return getISOWeekInfo(prev);
}

// ── Year range for dropdown ───────────────────────────────
const YEAR_RANGE = Array.from({ length: 11 }, (_, i) => 2020 + i);

// ── Unit4 console fill script ─────────────────────────────
// Generated with the week's data embedded (__DATA__) and pasted into the
// browser console (top context) on the Unit4 "Daglig tidregistrering" page.
// Each row edit is a WebForms postback that reloads the content frame, so the
// script runs from the top window and re-finds the grid after every reload.
const FILL_SCRIPT_TEMPLATE = String.raw`(async function () {
  var DATA = __DATA__;
  var TAG = "[Tidrapport] ";
  function log(m) { console.log(TAG + m); }
  function fail(m) {
    console.error(TAG + "FEL: " + m);
    alert("Tidrapport-exporten stoppades:\n\n" + m);
    throw new Error(TAG + m);
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function findCtx(win) {
    try {
      if (win.document && win.document.querySelector('th[data-fieldname="timecode"]')) {
        return { win: win, doc: win.document };
      }
    } catch (e) {}
    for (var i = 0; i < win.frames.length; i++) {
      var r = findCtx(win.frames[i]);
      if (r) return r;
    }
    return null;
  }
  async function waitFor(test, timeoutMs, what) {
    var t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      var r = null;
      try { r = test(); } catch (e) {}
      if (r) return r;
      await sleep(300);
    }
    fail("Tidsgräns nådd i väntan på: " + what);
  }
  function getGrid(doc) {
    var th = doc.querySelector('th[data-fieldname="timecode"]');
    return th ? th.closest("table") : null;
  }
  function colIndex(grid, field) {
    var th = grid.querySelector('th[data-fieldname="' + field + '"]');
    return th ? th.cellIndex : -1;
  }
  function findRow(grid, code) {
    var pi = colIndex(grid, "project");
    var rows = Array.prototype.slice.call(grid.querySelectorAll("tr"));
    for (var i = 0; i < rows.length; i++) {
      if (!/row\d+$/.test(rows[i].id)) continue;
      var td = rows[i].cells[pi];
      if (!td) continue;
      var text = (td.textContent || "").trim();
      var title = (td.getAttribute("title") || "").trim();
      if (text === code || title === code || title.endsWith("- " + code)) return rows[i];
    }
    return null;
  }

  // 1. Find the timesheet frame
  var ctx = findCtx(window);
  if (!ctx) fail('Hittar inte tidregistreringsgriden på den här sidan.\n- Är du på "Daglig tidregistrering" i Unit4?\n- Körs skriptet i konsolens "top"-kontext?');

  // 2. Verify the correct week is selected
  var dateInput = ctx.doc.querySelector('input[id$="date_in_period_i"]');
  if (!dateInput) fail("Hittar inte datumfältet (date_in_period) – sidan ser inte ut som väntat.");
  var pageMonday = (dateInput.value || "").trim();
  if (pageMonday !== DATA.monday) {
    dateInput.style.outline = "3px solid red";
    dateInput.scrollIntoView({ block: "center" });
    fail("FEL VECKA vald i Unit4!\nSidan visar veckan som börjar " + pageMonday +
      ", men exporten gäller " + DATA.weekLabel + " (måndag " + DATA.monday + ").\n" +
      "Byt vecka i Unit4 och kör skriptet igen. (Datumfältet är rödmarkerat.)");
  }

  // 3. Verify every row to fill is visible in the grid
  var grid = getGrid(ctx.doc);
  var missing = [];
  for (var i = 0; i < DATA.rows.length; i++) {
    if (!findRow(grid, DATA.rows[i].code)) missing.push(DATA.rows[i]);
  }
  if (missing.length) {
    grid.style.outline = "3px solid red";
    grid.scrollIntoView({ block: "center" });
    fail("Följande rader saknas (eller syns inte) i Unit4-griden:\n" +
      missing.map(function (r) { return "  - " + r.code + " (" + r.desc + ")"; }).join("\n") +
      "\n\nLägg till raderna i Unit4 och kör skriptet igen. (Griden är rödmarkerad.)");
  }

  log("Vecka OK (" + pageMonday + "), alla " + DATA.rows.length + " rader hittade. Börjar fylla i …");

  // 4. Fill row by row; each edit is a postback that reloads the frame
  for (var n = 0; n < DATA.rows.length; n++) {
    var rowData = DATA.rows[n];
    ctx = findCtx(window);
    if (!ctx) fail("Tappade kontakten med sidan efter omladdning.");
    grid = getGrid(ctx.doc);
    var tr = findRow(grid, rowData.code);
    if (!tr) fail("Raden " + rowData.code + " gick inte att hitta efter omladdning.");
    var uid = tr.id.replace(/_/g, "$");
    log("Rad " + (n + 1) + "/" + DATA.rows.length + ": öppnar " + rowData.code + " för redigering …");
    ctx.win.PostBack(uid + "$_edit", "reg_value1");
    ctx = await waitFor(function () {
      var c = findCtx(window);
      if (!c) return null;
      return c.doc.getElementsByName(uid + "$reg_value1$i")[0] ? c : null;
    }, 20000, "redigeringsläge för rad " + rowData.code);
    for (var d = 0; d < 5; d++) {
      var inp = ctx.doc.getElementsByName(uid + "$reg_value" + (d + 1) + "$i")[0];
      if (!inp) fail("Hittar inte inmatningsfältet för dag " + (d + 1) + " på raden " + rowData.code);
      inp.value = rowData.days[d];
      inp.dispatchEvent(new Event("change", { bubbles: true }));
      var dirty = ctx.doc.getElementsByName(uid + "$reg_value" + (d + 1) + "$IsDirty")[0];
      if (dirty) dirty.value = "true";
      inp.style.backgroundColor = "#fef9c3";
    }
    log("Rad " + rowData.code + " ifylld: " + rowData.days.join("  "));
    await sleep(300);
  }

  log("Klart!");
  alert("Klart! " + DATA.rows.length + " rader ifyllda för " + DATA.weekLabel + ".\n\n" +
    "Kontrollera värdena i griden och klicka sedan själv på Spara i Unit4.\n" +
    "(Sista raden står kvar i redigeringsläge – det är normalt.)");
})();`;

export default function App() {
  const defaultWeek = getPreviousWeek();

  const [selectedYear, setSelectedYear] = useState(defaultWeek.year);
  const [selectedWeek, setSelectedWeek] = useState(defaultWeek.week);
  const [workAreas, setWorkAreas] = useState<WorkArea[]>([
    { id: crypto.randomUUID(), code: "102653", description: "", percentage: 40 },
    { id: crypto.randomUUID(), code: "101124", description: "", percentage: 20 },
    { id: crypto.randomUUID(), code: "300292", description: "", percentage: 40 },
  ]);
  const [dayTypes, setDayTypes] = useState<DayType[]>(() => {
    const monday = getMondayForISOWeek(defaultWeek.year, defaultWeek.week);
    return getInitialDayTypes(getWeekDays(monday));
  });
  const [workedHours, setWorkedHours] = useState<number[]>(() => {
    const monday = getMondayForISOWeek(defaultWeek.year, defaultWeek.week);
    return getInitialDayTypes(getWeekDays(monday)).map((t) => DAY_BASE_HOURS[t]);
  });
  const [friskvard, setFriskvard] = useState<number[]>([0, 0, 0, 0, 0]);
  const [franvaro, setFranvaro] = useState<number[]>([0, 0, 0, 0, 0]);
  const [flexUt, setFlexUt] = useState<number[]>([0, 0, 0, 0, 0]);
  const [copied, setCopied] = useState<"" | "tsv" | "script" | "bookmarklet">("");

  const monday = getMondayForISOWeek(selectedYear, selectedWeek);
  const weekDays = getWeekDays(monday);
  const holidayMap = buildHolidayMap(weekDays);
  const holidayNames = weekDays.map((d) => holidayMap[dateToKey(d)] || null);
  const weeksInYear = getISOWeeksInYear(selectedYear);

  function changeWeek(year: number, week: number) {
    const newDays = getWeekDays(getMondayForISOWeek(year, week));
    const newTypes = getInitialDayTypes(newDays);
    setSelectedYear(year);
    setSelectedWeek(week);
    setDayTypes(newTypes);
    setWorkedHours(newTypes.map((t) => DAY_BASE_HOURS[t]));
    setFriskvard([0, 0, 0, 0, 0]);
    setFranvaro([0, 0, 0, 0, 0]);
    setFlexUt([0, 0, 0, 0, 0]);
  }

  function navigateWeek(delta: number) {
    let newWeek = selectedWeek + delta;
    let newYear = selectedYear;
    if (newWeek < 1) {
      newYear -= 1;
      newWeek = getISOWeeksInYear(newYear);
    } else if (newWeek > getISOWeeksInYear(newYear)) {
      newYear += 1;
      newWeek = 1;
    }
    changeWeek(newYear, newWeek);
  }

  function handleYearChange(year: number) {
    const maxWeek = getISOWeeksInYear(year);
    const week = Math.min(selectedWeek, maxWeek);
    changeWeek(year, week);
  }

  // ── Calculations ─────────────────────────────────────────

  const percentageSum = workAreas.reduce((s, a) => s + a.percentage, 0);
  const percentageValid = workAreas.length === 0 || percentageSum === 100;

  const friskvardTotal = friskvard.reduce(
    (s, v, i) => s + (dayTypes[i] === "helgdag" ? 0 : v),
    0
  );
  const franvaroTotal = franvaro.reduce(
    (s, v, i) => s + (dayTypes[i] === "helgdag" ? 0 : v),
    0
  );

  function calcDayHours(percentage: number, dayIdx: number): number {
    const available = Math.max(
      0,
      workedHours[dayIdx] - friskvard[dayIdx] - franvaro[dayIdx] - flexUt[dayIdx]
    );
    return available * (percentage / 100);
  }

  const flexTotal = flexUt.reduce(
    (s, v, i) => s + (dayTypes[i] === "helgdag" ? 0 : v),
    0
  );

  const workedTotal = workedHours.reduce(
    (s, v, i) => s + (dayTypes[i] === "helgdag" ? 0 : v),
    0
  );

  const dayTotals = [0, 1, 2, 3, 4].map((i) => {
    if (dayTypes[i] === "helgdag") return 0;
    return workAreas.reduce((s, wa) => s + calcDayHours(wa.percentage, i), 0) +
      friskvard[i] +
      franvaro[i] +
      flexUt[i];
  });
  const grandTotal = dayTotals.reduce((s, v) => s + v, 0);

  // ── Work area handlers ────────────────────────────────────

  function addWorkArea() {
    setWorkAreas((prev) => [
      ...prev,
      { id: crypto.randomUUID(), code: "", description: "", percentage: 100 },
    ]);
  }

  function removeWorkArea(id: string) {
    setWorkAreas((prev) => prev.filter((a) => a.id !== id));
  }

  function updateWorkArea(id: string, field: keyof WorkArea, value: string | number) {
    setWorkAreas((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  }

  function setDayType(idx: number, value: DayType) {
    setDayTypes((prev) => prev.map((t, i) => (i === idx ? value : t)));
    setWorkedHours((prev) =>
      prev.map((v, i) => (i === idx ? DAY_BASE_HOURS[value] : v))
    );
  }

  function updateWorkedHours(idx: number, value: number) {
    setWorkedHours((prev) => prev.map((v, i) => (i === idx ? value : v)));
  }

  function updateFriskvard(idx: number, value: number) {
    setFriskvard((prev) => prev.map((v, i) => (i === idx ? value : v)));
  }

  function updateFranvaro(idx: number, value: number) {
    setFranvaro((prev) => prev.map((v, i) => (i === idx ? value : v)));
  }

  function updateFlexUt(idx: number, value: number) {
    setFlexUt((prev) => prev.map((v, i) => (i === idx ? value : v)));
  }

  // ── Export to Unit4 ───────────────────────────────────────
  // Column order matches the Unit4 daily time registration grid:
  // Tidkod, Arbetsområde, Beskrivning, Mån–Sön (7 day columns).
  function buildExportRows(): Array<{ tidkod: string; code: string; desc: string; days: string[] }> {
    const fmt = (n: number) => n.toFixed(2).replace(".", ",");
    const dayValues = (vals: number[]) =>
      [0, 1, 2, 3, 4].map((i) => (dayTypes[i] === "helgdag" ? 0 : vals[i]));

    const rows: Array<{ tidkod: string; code: string; desc: string; days: string[] }> = [];
    const specialRows: Array<[string, string, number[]]> = [
      ["FRISKVAR", "Friskvård", friskvard],
      ["FRANVARO", "Frånvaro", franvaro],
      ["FLEXUT", "Flex uttag", flexUt],
    ];
    specialRows.forEach(([code, desc, vals]) => {
      const days = dayValues(vals);
      if (days.every((v) => v === 0)) return;
      rows.push({ tidkod: "0", code, desc, days: days.map(fmt) });
    });
    workAreas.forEach((area) => {
      const days = [0, 1, 2, 3, 4].map((i) => calcDayHours(area.percentage, i));
      if (days.every((v) => v === 0)) return;
      rows.push({ tidkod: "0", code: area.code, desc: area.description, days: days.map(fmt) });
    });
    return rows;
  }

  function buildUnit4Tsv(): string {
    return buildExportRows()
      .map((r) => [r.tidkod, r.code, r.desc, ...r.days, "0,00", "0,00"].join("\t"))
      .join("\n");
  }

  function buildFillScript(): string {
    const payload = {
      monday: dateToKey(monday),
      weekLabel: `vecka ${selectedWeek} ${selectedYear}`,
      rows: buildExportRows().map((r) => ({ code: r.code, desc: r.desc, days: r.days })),
    };
    return FILL_SCRIPT_TEMPLATE.replace("__DATA__", JSON.stringify(payload));
  }

  async function copyExport(kind: "tsv" | "script") {
    await navigator.clipboard.writeText(kind === "tsv" ? buildUnit4Tsv() : buildFillScript());
    setCopied(kind);
    setTimeout(() => setCopied(""), 2500);
  }

  // Bookmarklet: same fill script as a javascript: URL. Rendered via
  // setAttribute in a ref since React 19 blocks javascript: hrefs in JSX.
  const bookmarkletHref = "javascript:" + encodeURIComponent(buildFillScript());

  return (
    <div className="min-h-screen bg-background p-6 space-y-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold">Tidrapportering</h1>

      {/* ── Setup ─────────────────────────────────────────────── */}
      <div className="space-y-6">
        {/* Work areas */}
        <div>
          <h2 className="text-base font-semibold mb-2">Arbetsområden</h2>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Kod (6 siffror)</th>
                  <th className="text-left px-3 py-2 font-medium">Beskrivning</th>
                  <th className="text-left px-3 py-2 font-medium w-32">Procent (%)</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {workAreas.map((area) => (
                  <tr key={area.id} className="border-t">
                    <td className="px-3 py-1">
                      <Input
                        value={area.code}
                        maxLength={6}
                        onChange={(e) =>
                          updateWorkArea(area.id, "code", e.target.value.replace(/\D/g, ""))
                        }
                        className="h-8 w-28 font-mono"
                        placeholder="123456"
                      />
                    </td>
                    <td className="px-3 py-1">
                      <Input
                        value={area.description}
                        onChange={(e) =>
                          updateWorkArea(area.id, "description", e.target.value)
                        }
                        className="h-8"
                        placeholder="Beskrivning"
                      />
                    </td>
                    <td className="px-3 py-1">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={area.percentage}
                        onChange={(e) =>
                          updateWorkArea(area.id, "percentage", Number(e.target.value))
                        }
                        className="h-8 w-24"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeWorkArea(area.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {workAreas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground text-sm">
                      Inga arbetsområden tillagda
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={addWorkArea}>
              <Plus className="h-4 w-4 mr-1" />
              Lägg till arbetsområde
            </Button>
            {workAreas.length > 0 && (
              <span
                className={cn(
                  "text-sm",
                  percentageValid ? "text-muted-foreground" : "text-destructive font-semibold"
                )}
              >
                Summa: {percentageSum}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Result table ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h2 className="text-base font-semibold">Tidtransaktioner</h2>

          {/* Week navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => navigateWeek(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Week dropdown */}
            <Select
              value={String(selectedWeek)}
              onValueChange={(v) => changeWeek(selectedYear, Number(v))}
            >
              <SelectTrigger className="h-7 text-sm w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: weeksInYear }, (_, i) => i + 1).map((w) => (
                  <SelectItem key={w} value={String(w)}>
                    Vecka {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Year dropdown */}
            <Select
              value={String(selectedYear)}
              onValueChange={(v) => handleYearChange(Number(v))}
            >
              <SelectTrigger className="h-7 text-sm w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEAR_RANGE.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => navigateWeek(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => copyExport("tsv")}
              disabled={!percentageValid}
            >
              <ClipboardCopy className="h-4 w-4 mr-1" />
              {copied === "tsv" ? "Kopierat!" : "Kopiera till Unit4"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => copyExport("script")}
              disabled={!percentageValid}
            >
              <Terminal className="h-4 w-4 mr-1" />
              {copied === "script" ? "Kopierat!" : "Kopiera fyllnadsskript"}
            </Button>
            <a
              ref={(el) => {
                if (el) el.setAttribute("href", bookmarkletHref);
              }}
              onClick={async (e) => {
                e.preventDefault();
                await navigator.clipboard.writeText(bookmarkletHref);
                setCopied("bookmarklet");
                setTimeout(() => setCopied(""), 2500);
              }}
              draggable
              title="Dra mig till bokmärkesfältet (inte till sidan!) — eller klicka för att kopiera bokmärkes-URL:en"
              className="inline-flex items-center h-7 px-3 rounded-md border bg-background text-sm font-medium cursor-grab shadow-xs hover:bg-accent hover:text-accent-foreground whitespace-nowrap"
            >
              <Bookmark className="h-4 w-4 mr-1" />
              {copied === "bookmarklet"
                ? "Bokmärkes-URL kopierad!"
                : `Fyll i Unit4 v.${selectedWeek} ${selectedYear}`}
            </a>
          </div>
        </div>

        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              {/* Day type selector row */}
              <tr className="bg-muted/40 border-b">
                <td colSpan={3} className="px-3 py-1 text-xs text-muted-foreground">
                  Dagtyp
                </td>
                {weekDays.map((_, i) => (
                  <td key={i} className="px-1 py-1">
                    <Select
                      value={dayTypes[i]}
                      onValueChange={(v) => setDayType(i, v as DayType)}
                    >
                      <SelectTrigger className="h-7 text-xs w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="halvHelgdag">Halv helgdag</SelectItem>
                        <SelectItem value="helgdag">Helgdag</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                ))}
                <td />
              </tr>

              {/* Worked hours per day row */}
              <tr className="bg-muted/40 border-b">
                <td colSpan={3} className="px-3 py-1 text-xs text-muted-foreground">
                  Arbetade timmar/dag
                </td>
                {weekDays.map((_, i) => (
                  <td key={i} className="px-1 py-1">
                    {dayTypes[i] === "helgdag" ? (
                      <div className="text-right px-2 text-xs font-mono text-muted-foreground">
                        —
                      </div>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        max={24}
                        step={0.25}
                        value={workedHours[i]}
                        onChange={(e) => updateWorkedHours(i, Number(e.target.value))}
                        className="h-7 text-right w-full font-mono text-xs"
                      />
                    )}
                  </td>
                ))}
                <td className="px-3 py-1 text-right font-mono text-xs">
                  {workedTotal.toFixed(2).replace(".", ",")}
                </td>
              </tr>

              {/* Column header row */}
              <tr className="bg-muted border-b">
                <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Tidkod</th>
                <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Arbetsområde</th>
                <th className="text-left px-3 py-2 font-semibold">Beskrivning</th>
                {weekDays.map((d, i) => (
                  <th
                    key={i}
                    className={cn(
                      "text-right px-3 py-2 font-semibold whitespace-nowrap",
                      dayTypes[i] === "helgdag" && "text-red-600",
                      dayTypes[i] === "halvHelgdag" && "text-amber-600"
                    )}
                  >
                    {DAY_NAMES[i]}
                    <br />
                    <span className="font-normal text-xs">{formatDate(d)}</span>
                    {holidayNames[i] && (
                      <>
                        <br />
                        <span className="font-normal text-xs text-red-500 italic">
                          {holidayNames[i]}
                        </span>
                      </>
                    )}
                  </th>
                ))}
                <th className="text-right px-3 py-2 font-semibold">Sum</th>
              </tr>
            </thead>

            <tbody>
              {/* Friskvård */}
              <tr className="border-b">
                <td className="px-3 py-1 text-muted-foreground">0</td>
                <td className="px-3 py-1 font-mono text-xs">FRISKVAR</td>
                <td className="px-3 py-1">Friskvård</td>
                {friskvard.map((v, i) => (
                  <td
                    key={i}
                    className={cn(
                      "px-1 py-1",
                      dayTypes[i] === "helgdag" && "bg-green-500",
                      dayTypes[i] === "halvHelgdag" && "bg-amber-50"
                    )}
                  >
                    {dayTypes[i] === "helgdag" ? (
                      <div className="text-right px-2 text-sm font-mono text-white">0,00</div>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        step={0.25}
                        value={v}
                        onChange={(e) => updateFriskvard(i, Number(e.target.value))}
                        className="h-7 text-right w-full font-mono text-xs"
                      />
                    )}
                  </td>
                ))}
                <td className="px-3 py-1 text-right font-mono text-sm">
                  {friskvardTotal.toFixed(2).replace(".", ",")}
                </td>
              </tr>

              {/* Frånvaro */}
              <tr className="border-b">
                <td className="px-3 py-1 text-muted-foreground">0</td>
                <td className="px-3 py-1 font-mono text-xs">FRANVARO</td>
                <td className="px-3 py-1">Frånvaro</td>
                {franvaro.map((v, i) => (
                  <td
                    key={i}
                    className={cn(
                      "px-1 py-1",
                      dayTypes[i] === "helgdag" && "bg-green-500",
                      dayTypes[i] === "halvHelgdag" && "bg-amber-50"
                    )}
                  >
                    {dayTypes[i] === "helgdag" ? (
                      <div className="text-right px-2 text-sm font-mono text-white">0,00</div>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        step={0.25}
                        value={v}
                        onChange={(e) => updateFranvaro(i, Number(e.target.value))}
                        className="h-7 text-right w-full font-mono text-xs"
                      />
                    )}
                  </td>
                ))}
                <td className="px-3 py-1 text-right font-mono text-sm">
                  {franvaroTotal.toFixed(2).replace(".", ",")}
                </td>
              </tr>

              {/* Flex uttag */}
              <tr className="border-b">
                <td className="px-3 py-1 text-muted-foreground">0</td>
                <td className="px-3 py-1 font-mono text-xs">FLEXUT</td>
                <td className="px-3 py-1">Flex uttag</td>
                {flexUt.map((v, i) => (
                  <td
                    key={i}
                    className={cn(
                      "px-1 py-1",
                      dayTypes[i] === "helgdag" && "bg-green-500",
                      dayTypes[i] === "halvHelgdag" && "bg-amber-50"
                    )}
                  >
                    {dayTypes[i] === "helgdag" ? (
                      <div className="text-right px-2 text-sm font-mono text-white">0,00</div>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        step={0.25}
                        value={v}
                        onChange={(e) => updateFlexUt(i, Number(e.target.value))}
                        className="h-7 text-right w-full font-mono text-xs"
                      />
                    )}
                  </td>
                ))}
                <td className="px-3 py-1 text-right font-mono text-sm">
                  {flexTotal.toFixed(2).replace(".", ",")}
                </td>
              </tr>

              {/* Work area rows */}
              {workAreas.map((area) => {
                const dayHours = [0, 1, 2, 3, 4].map((i) => calcDayHours(area.percentage, i));
                const weekTotal = dayHours.reduce((s, v) => s + v, 0);
                return (
                  <tr key={area.id} className="border-b">
                    <td className="px-3 py-2 text-muted-foreground">0</td>
                    <td className="px-3 py-2 font-mono text-xs">{area.code || "—"}</td>
                    <td className="px-3 py-2">{area.description || "—"}</td>
                    {dayHours.map((h, i) => (
                      <td
                        key={i}
                        className={cn(
                          "px-3 py-2 text-right font-mono text-sm",
                          dayTypes[i] === "helgdag" && "bg-green-500 text-white",
                          dayTypes[i] === "halvHelgdag" && "bg-amber-50"
                        )}
                      >
                        {h.toFixed(2).replace(".", ",")}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-mono text-sm">
                      {weekTotal.toFixed(2).replace(".", ",")}
                    </td>
                  </tr>
                );
              })}

              {workAreas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-muted-foreground text-sm">
                    Lägg till arbetsområden ovan för att se beräknade timmar
                  </td>
                </tr>
              )}

              {/* Sum row */}
              <tr className="bg-muted border-t-2 font-semibold">
                <td className="px-3 py-2">Σ</td>
                <td colSpan={2} />
                {dayTotals.map((t, i) => (
                  <td key={i} className="px-3 py-2 text-right font-mono text-sm">
                    {t.toFixed(2).replace(".", ",")}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-mono text-sm">
                  {grandTotal.toFixed(2).replace(".", ",")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <p>
            <span className="font-semibold">Kopiera till Unit4:</span> klicka på knappen,
            öppna Daglig tidregistrering i Unit4, markera första cellen (Tidkod) på en tom
            rad i tidgriden och tryck Ctrl+V. Kolumnordning: Tidkod, Arbetsområde,
            Beskrivning, Mån–Sön. Rader utan timmar tas inte med.
          </p>
          <p>
            <span className="font-semibold">Kopiera fyllnadsskript:</span> klicka på
            knappen, öppna Daglig tidregistrering i Unit4 med rätt vecka vald och raderna
            synliga, tryck F12 och välj fliken Console (kontext "top"), klistra in
            skriptet och tryck Enter. Första gången kan webbläsaren kräva att du skriver{" "}
            <code className="font-mono">allow pasting</code> i konsolen innan inklistring
            tillåts. Skriptet kontrollerar att rätt vecka är vald och att alla rader finns
            — annars stoppar det med ett tydligt felmeddelande och rödmarkerar problemet.
            Därefter fylls Mån–Fre i rad för rad; granska resultatet och klicka själv på
            Spara i Unit4.
          </p>
          <p>
            <span className="font-semibold">Bokmärket "Fyll i Unit4":</span> visa
            bokmärkesfältet (Ctrl+Skift+B) och dra länken till{" "}
            <span className="font-semibold">själva bokmärkesfältet</span> — släpper du
            den på en webbsida eller flik försöker webbläsaren i stället öppna skriptet
            som en sida och blockerar det ("about:blank#blocked"). Fungerar inte
            dragningen: klicka på länken så kopieras bokmärkes-URL:en — högerklicka
            sedan på bokmärkesfältet, välj "Lägg till sida…", ge bokmärket ett namn och
            klistra in URL:en i webbadressfältet. Stå därefter på Daglig tidregistrering
            i Unit4 och klicka på bokmärket — samma fyllnadsskript körs, med samma
            vecko- och radkontroller. Bokmärket innehåller veckans siffror, så uppdatera
            det varje vecka (skriptet varnar om bokmärkets vecka inte matchar sidan).
          </p>
        </div>
      </div>
    </div>
  );
}
