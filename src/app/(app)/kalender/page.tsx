"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  leadId: number;
  title: string;
  ansprechpartner: string | null;
  date: string;
  type: "Termin" | "Folgetermin";
  phase: string;
}

type ViewMode = "month" | "week";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Montag = 0, Sonntag = 6
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  // Tage vom Vormonat
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isCurrentMonth: false });
  }

  // Tage des aktuellen Monats
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }

  // Tage des nächsten Monats (auffüllen auf volle Wochen)
  while (days.length % 7 !== 0) {
    const nextDay = new Date(year, month + 1, days.length - startOffset - lastDay.getDate() + 1);
    days.push({ date: nextDay, isCurrentMonth: false });
  }

  return days;
}

function getWeekDays(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Montag als Wochenstart
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day;
  });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export default function KalenderPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");

  useEffect(() => {
    fetch("/api/calendar")
      .then((r) => r.json())
      .then(setEvents)
      .catch(() => {});
  }, []);

  const today = new Date();

  const navigate = (direction: number) => {
    const d = new Date(currentDate);
    if (view === "month") {
      d.setMonth(d.getMonth() + direction);
    } else {
      d.setDate(d.getDate() + direction * 7);
    }
    setCurrentDate(d);
  };

  const goToToday = () => setCurrentDate(new Date());

  const getEventsForDay = (date: Date) =>
    events.filter((e) => {
      const eventDate = new Date(e.date);
      return isSameDay(eventDate, date);
    });

  const EventPill = ({ event }: { event: CalendarEvent }) => (
    <button
      onClick={() => router.push(`/pipeline/${event.leadId}`)}
      className={cn(
        "w-full text-left rounded px-1.5 py-0.5 text-xs font-medium truncate transition-opacity hover:opacity-80",
        event.type === "Folgetermin"
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-primary/10 text-primary dark:bg-primary/20"
      )}
    >
      {formatTime(event.date)} {event.title}
    </button>
  );

  // Monats-Ansicht
  const monthDays = getMonthDays(currentDate.getFullYear(), currentDate.getMonth());

  // Wochen-Ansicht
  const weekDays = getWeekDays(currentDate);

  return (
    <div className="flex flex-col h-full">
      <Header title="Kalender" />
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Heute
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold ml-2">
              {view === "month"
                ? formatMonthYear(currentDate)
                : `KW ${getWeekNumber(currentDate)} · ${formatMonthYear(currentDate)}`}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground mr-4">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Termin
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Cross-Selling
              </span>
            </div>
            <Button
              variant={view === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("month")}
            >
              <CalendarIcon className="h-4 w-4 mr-1" /> Monat
            </Button>
            <Button
              variant={view === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("week")}
            >
              <CalendarDays className="h-4 w-4 mr-1" /> Woche
            </Button>
          </div>
        </div>

        {/* Kalender */}
        {view === "month" ? (
          <Card className="overflow-hidden">
            {/* Wochentage Header */}
            <div className="grid grid-cols-7 border-b">
              {WEEKDAYS.map((day) => (
                <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            {/* Tage Grid */}
            <div className="grid grid-cols-7">
              {monthDays.map(({ date, isCurrentMonth }, i) => {
                const dayEvents = getEventsForDay(date);
                const isToday = isSameDay(date, today);
                return (
                  <div
                    key={i}
                    className={cn(
                      "min-h-[100px] border-b border-r p-1.5 transition-colors",
                      !isCurrentMonth && "bg-muted/30",
                      isToday && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={cn(
                          "text-xs font-medium h-6 w-6 flex items-center justify-center rounded-full",
                          isToday && "bg-primary text-primary-foreground",
                          !isCurrentMonth && "text-muted-foreground/40"
                        )}
                      >
                        {date.getDate()}
                      </span>
                      {dayEvents.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">
                          {dayEvents.length}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((event) => (
                        <EventPill key={event.id} event={event} />
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-[10px] text-muted-foreground px-1">
                          +{dayEvents.length - 3} weitere
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          /* Wochen-Ansicht */
          <Card className="overflow-hidden">
            <div className="grid grid-cols-7">
              {weekDays.map((date, i) => {
                const dayEvents = getEventsForDay(date);
                const isToday = isSameDay(date, today);
                return (
                  <div
                    key={i}
                    className={cn(
                      "min-h-[400px] border-r p-3",
                      isToday && "bg-primary/5"
                    )}
                  >
                    <div className="text-center mb-3">
                      <p className="text-xs text-muted-foreground">{WEEKDAYS[i]}</p>
                      <p
                        className={cn(
                          "text-lg font-semibold mt-0.5 h-9 w-9 mx-auto flex items-center justify-center rounded-full",
                          isToday && "bg-primary text-primary-foreground"
                        )}
                      >
                        {date.getDate()}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {date.toLocaleDateString("de-DE", { month: "short" })}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {dayEvents.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => router.push(`/pipeline/${event.leadId}`)}
                          className={cn(
                            "w-full text-left rounded-lg p-2 text-xs transition-all hover:shadow-sm",
                            event.type === "Folgetermin"
                              ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800"
                              : "bg-primary/5 border border-primary/20"
                          )}
                        >
                          <p className="font-medium truncate">{event.title}</p>
                          {event.ansprechpartner && (
                            <p className="text-muted-foreground truncate">{event.ansprechpartner}</p>
                          )}
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[10px] h-4",
                                event.type === "Folgetermin" ? "bg-emerald-100 text-emerald-700" : ""
                              )}
                            >
                              {event.type === "Folgetermin" ? "Cross-Selling" : event.phase}
                            </Badge>
                            {formatTime(event.date) && (
                              <span className="text-muted-foreground">{formatTime(event.date)}</span>
                            )}
                          </div>
                        </button>
                      ))}
                      {dayEvents.length === 0 && (
                        <p className="text-center text-[10px] text-muted-foreground/40 mt-4">
                          Keine Termine
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}
