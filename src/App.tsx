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
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

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
      </div>
    </div>
  );
}
