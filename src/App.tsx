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
const DAY_WEIGHTS: Record<DayType, number> = {
  normal: 1,
  halvHelgdag: 0.5,
  helgdag: 0,
};

function getWeekMonday(weekOffset: number): Date {
  const today = new Date();
  const dow = today.getDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMon + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
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

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export default function App() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [totalHours, setTotalHours] = useState(40);
  const [workAreas, setWorkAreas] = useState<WorkArea[]>([]);
  const [dayTypes, setDayTypes] = useState<DayType[]>([
    "normal", "normal", "normal", "normal", "normal",
  ]);
  const [friskvard, setFriskvard] = useState<number[]>([0, 0, 0, 0, 0]);
  const [franvaro, setFranvaro] = useState<number[]>([0, 0, 0, 0, 0]);

  const monday = getWeekMonday(weekOffset);
  const weekDays = getWeekDays(monday);

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
  const availableHours = Math.max(0, totalHours - friskvardTotal - franvaroTotal);

  const dayWeights = dayTypes.map((t) => DAY_WEIGHTS[t]);
  const totalWeight = dayWeights.reduce((s, w) => s + w, 0);

  function calcDayHours(percentage: number, dayIdx: number): number {
    if (totalWeight === 0) return 0;
    const weeklyHours = availableHours * (percentage / 100);
    return (weeklyHours * dayWeights[dayIdx]) / totalWeight;
  }

  const dayTotals = [0, 1, 2, 3, 4].map((i) => {
    if (dayTypes[i] === "helgdag") return 0;
    const waHours = workAreas.reduce((s, wa) => s + calcDayHours(wa.percentage, i), 0);
    return waHours + friskvard[i] + franvaro[i];
  });
  const grandTotal = dayTotals.reduce((s, v) => s + v, 0);

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
  }

  function updateFriskvard(idx: number, value: number) {
    setFriskvard((prev) => prev.map((v, i) => (i === idx ? value : v)));
  }

  function updateFranvaro(idx: number, value: number) {
    setFranvaro((prev) => prev.map((v, i) => (i === idx ? value : v)));
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold">Tidrapportering</h1>

      {/* ── Setup ─────────────────────────────────────────────── */}
      <div className="space-y-6">
        {/* Total hours */}
        <div className="flex items-center gap-3">
          <Label htmlFor="totalHours" className="text-sm font-medium whitespace-nowrap">
            Totalt antal timmar per vecka
          </Label>
          <Input
            id="totalHours"
            type="number"
            min={0}
            max={40}
            value={totalHours}
            onChange={(e) => setTotalHours(Math.min(40, Math.max(0, Number(e.target.value))))}
            className="w-24"
          />
        </div>

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
                    <td
                      colSpan={4}
                      className="px-3 py-4 text-center text-muted-foreground text-sm"
                    >
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
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-base font-semibold">Tidtransaktioner</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setWeekOffset((w) => w - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2 min-w-24 text-center">
              v.{getWeekNumber(monday)} {monday.getFullYear()}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setWeekOffset((w) => w + 1)}
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
                <td
                  colSpan={3}
                  className="px-3 py-1 text-xs text-muted-foreground"
                >
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

              {/* Column header row */}
              <tr className="bg-muted border-b">
                <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">
                  Tidkod
                </th>
                <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">
                  Arbetsområde
                </th>
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
                      dayTypes[i] === "helgdag" && "bg-green-400",
                      dayTypes[i] === "halvHelgdag" && "bg-green-100"
                    )}
                  >
                    {dayTypes[i] === "helgdag" ? (
                      <div className="text-right px-2 text-sm font-mono">0,00</div>
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
                      dayTypes[i] === "helgdag" && "bg-green-400",
                      dayTypes[i] === "halvHelgdag" && "bg-green-100"
                    )}
                  >
                    {dayTypes[i] === "helgdag" ? (
                      <div className="text-right px-2 text-sm font-mono">0,00</div>
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

              {/* Work area rows */}
              {workAreas.map((area) => {
                const dayHours = [0, 1, 2, 3, 4].map((i) =>
                  calcDayHours(area.percentage, i)
                );
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
                          dayTypes[i] === "helgdag" && "bg-green-400",
                          dayTypes[i] === "halvHelgdag" && "bg-green-100"
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
                  <td
                    colSpan={9}
                    className="px-3 py-4 text-center text-muted-foreground text-sm"
                  >
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
