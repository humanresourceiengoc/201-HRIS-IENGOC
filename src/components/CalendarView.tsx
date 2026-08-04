import React, { useState, useEffect } from 'react';
import { CompanyKey, CustomCalendarEvent, DocumentRequirement, Employee } from '../types';
import { getCustomEvents, saveCustomEvent, deleteCustomEvent } from '../lib/db';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Cake,
  Award,
  AlertTriangle,
  Clock,
  User,
  ExternalLink,
  Plus,
  Trash2,
  CalendarDays,
  FileText,
  Pin
} from 'lucide-react';

interface CalendarViewProps {
  company: CompanyKey;
  employees: Employee[];
  requirements: DocumentRequirement[];
  onViewEmployee: (id: string) => void;
}

export type EventType = 'birthday' | 'anniversary' | 'expiry' | 'probation' | 'custom';

export interface CalendarEvent {
  id: string;
  type: EventType;
  dateStr: string; // YYYY-MM-DD
  day: number;
  month: number; // 0-11
  year: number;
  title: string;
  subtitle?: string;
  description?: string;
  employee?: Employee;
  customEventId?: string;
  colorClass: string;
  badgeBg: string;
  badgeText: string;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  company,
  employees,
  requirements,
  onViewEmployee
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ dateStr: string; events: CalendarEvent[] } | null>(null);
  const [customEventsList, setCustomEventsList] = useState<CustomCalendarEvent[]>([]);

  // Add Custom Event Modal state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newEventForm, setNewEventForm] = useState<{
    title: string;
    dateStr: string;
    type: 'custom' | 'holiday' | 'meeting' | 'deadline' | 'event' | 'salary_increase';
    customCategory?: string;
    description: string;
  }>({
    title: '',
    dateStr: new Date().toISOString().split('T')[0],
    type: 'event',
    customCategory: '',
    description: ''
  });

  useEffect(() => {
    setCustomEventsList(getCustomEvents(company));
  }, [company]);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const reqMap = new Map(requirements.map(r => [r.id, r.name]));

  const handleCreateCustomEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventForm.title.trim() || !newEventForm.dateStr) return;

    const eventTitle = newEventForm.type === 'custom' && newEventForm.customCategory
      ? `[${newEventForm.customCategory.trim()}] ${newEventForm.title.trim()}`
      : newEventForm.title.trim();

    const updated = saveCustomEvent(company, {
      title: eventTitle,
      dateStr: newEventForm.dateStr,
      type: newEventForm.type === 'salary_increase' ? 'custom' : newEventForm.type,
      description: newEventForm.description.trim()
    });

    setCustomEventsList(updated);
    setShowAddModal(false);
    setNewEventForm({
      title: '',
      dateStr: new Date().toISOString().split('T')[0],
      type: 'event',
      customCategory: '',
      description: ''
    });
  };

  const handleDeleteCustomEvent = (id: string) => {
    const updated = deleteCustomEvent(company, id);
    setCustomEventsList(updated);
    setSelectedEvent(null);
  };

  // Build list of all events across employees + custom events
  const getAllEvents = (): CalendarEvent[] => {
    const events: CalendarEvent[] = [];

    // 1. Employee Events
    (employees || []).forEach(emp => {
      if (!emp) return;
      // Exclude resigned & separated & AWOL employees from standard calendar events (birthdays, anniversaries, etc.)
      const isSeparatedOrResigned = emp.status === 'RESIGNED' || emp.status === 'SEPARATED' || Boolean(emp.separationDate);
      if (isSeparatedOrResigned) {
        // Generate 30-Day Last Pay Schedule event for resigned/separated employees
        const lastPayDateStr = emp.lastPayScheduleDate || (emp.separationDate ? new Date(new Date(emp.separationDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null);
        if (lastPayDateStr) {
          const lpDate = new Date(lastPayDateStr);
          if (!isNaN(lpDate.getTime()) && lpDate.getFullYear() === currentYear) {
            const fullName = `${emp.firstName} ${emp.lastName}${emp.suffix ? ' ' + emp.suffix : ''}`;
            const amountText = emp.lastPayAmount ? ` • Final Pay: ₱${Number(emp.lastPayAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '';
            events.push({
              id: `last_pay_${emp.id}`,
              type: 'custom',
              dateStr: lastPayDateStr,
              day: lpDate.getDate(),
              month: lpDate.getMonth(),
              year: lpDate.getFullYear(),
              title: `🗓️ 30-Day Last Pay Schedule: ${fullName}`,
              subtitle: `Final Pay & Clearance Release (${emp.lastPayStatus || 'PENDING'})${amountText}`,
              employee: emp,
              colorClass: 'border-l-4 border-amber-500 bg-amber-50 text-amber-900',
              badgeBg: 'bg-amber-100 text-amber-800',
              badgeText: '30-Day Last Pay'
            });
          }
        }
        return; // STOP all birthday & anniversary counting for resigned and separated employees!
      }

      if (emp.status === 'AWOL') return; // Exclude AWOL employees from HR calendar counting

      // Birthdays
      if (emp.birthdate) {
        const bdate = new Date(emp.birthdate);
        if (!isNaN(bdate.getTime())) {
          const bMonth = bdate.getMonth();
          const bDay = bdate.getDate();
          const turningAge = currentYear - bdate.getFullYear();
          const eventDateStr = `${currentYear}-${String(bMonth + 1).padStart(2, '0')}-${String(bDay).padStart(2, '0')}`;

          events.push({
            id: `bday_${emp.id}_${currentYear}`,
            type: 'birthday',
            dateStr: eventDateStr,
            day: bDay,
            month: bMonth,
            year: currentYear,
            title: `🎂 Birthday: ${emp.firstName} ${emp.lastName}`,
            subtitle: turningAge > 0 ? `Turning ${turningAge} years old (${emp.department || 'N/A'})` : emp.position || '',
            employee: emp,
            colorClass: 'border-l-4 border-pink-500 bg-pink-50 text-pink-900',
            badgeBg: 'bg-pink-100 text-pink-700',
            badgeText: 'Birthday'
          });
        }
      }

      // Work Anniversaries / Date Hired
      if (emp.dateHired) {
        const hdate = new Date(emp.dateHired);
        if (!isNaN(hdate.getTime())) {
          const hMonth = hdate.getMonth();
          const hDay = hdate.getDate();
          const yearsServed = currentYear - hdate.getFullYear();
          const eventDateStr = `${currentYear}-${String(hMonth + 1).padStart(2, '0')}-${String(hDay).padStart(2, '0')}`;

          if (yearsServed >= 0) {
            events.push({
              id: `anniv_${emp.id}_${currentYear}`,
              type: 'anniversary',
              dateStr: eventDateStr,
              day: hDay,
              month: hMonth,
              year: currentYear,
              title: `🎉 ${yearsServed === 0 ? 'New Hire' : `${yearsServed}-Yr Anniversary`}: ${emp.firstName} ${emp.lastName}`,
              subtitle: `Hired: ${emp.dateHired} • ${emp.position || 'Employee'}`,
              employee: emp,
              colorClass: 'border-l-4 border-emerald-500 bg-emerald-50 text-emerald-900',
              badgeBg: 'bg-emerald-100 text-emerald-800',
              badgeText: yearsServed === 0 ? 'Date Hired' : `${yearsServed}y Anniversary`
            });
          }
        }
      }

      // Explicit Date of Regularization
      if (emp.dateOfRegularization) {
        const rdate = new Date(emp.dateOfRegularization);
        if (!isNaN(rdate.getTime())) {
          if (rdate.getFullYear() === currentYear) {
            events.push({
              id: `reg_date_${emp.id}`,
              type: 'probation',
              dateStr: emp.dateOfRegularization,
              day: rdate.getDate(),
              month: rdate.getMonth(),
              year: rdate.getFullYear(),
              title: `⭐ Regularization Date: ${emp.firstName} ${emp.lastName}`,
              subtitle: `Official Regularization Schedule (${emp.department || ''})`,
              employee: emp,
              colorClass: 'border-l-4 border-indigo-500 bg-indigo-50 text-indigo-900',
              badgeBg: 'bg-indigo-100 text-indigo-800',
              badgeText: 'Regularization'
            });
          }
        }
      }

      // Probationary Reviews (if classification is Probationary and employee is ACTIVE)
      if (
        emp.classification?.toLowerCase() === 'probationary' &&
        emp.dateHired &&
        (emp.status === 'ACTIVE' || !emp.status)
      ) {
        const hdate = new Date(emp.dateHired);
        if (!isNaN(hdate.getTime())) {
          // 3rd Month
          const m3 = new Date(hdate);
          m3.setMonth(m3.getMonth() + 3);
          if (m3.getFullYear() === currentYear) {
            const m3DateStr = m3.toISOString().split('T')[0];
            events.push({
              id: `prob_3m_${emp.id}`,
              type: 'probation',
              dateStr: m3DateStr,
              day: m3.getDate(),
              month: m3.getMonth(),
              year: m3.getFullYear(),
              title: `📋 3rd Month Review: ${emp.firstName} ${emp.lastName}`,
              subtitle: `Probationary Performance Evaluation (${emp.department || ''})`,
              employee: emp,
              colorClass: 'border-l-4 border-blue-500 bg-blue-50 text-blue-900',
              badgeBg: 'bg-blue-100 text-blue-800',
              badgeText: '3rd Month Review'
            });
          }

          // 5th Month Review
          const m5 = new Date(hdate);
          m5.setMonth(m5.getMonth() + 5);
          if (m5.getFullYear() === currentYear) {
            const m5DateStr = m5.toISOString().split('T')[0];
            events.push({
              id: `prob_5m_${emp.id}`,
              type: 'probation',
              dateStr: m5DateStr,
              day: m5.getDate(),
              month: m5.getMonth(),
              year: m5.getFullYear(),
              title: `📋 5th Month Pre-Reg Review: ${emp.firstName} ${emp.lastName}`,
              subtitle: `Critical evaluation before 6th month regularization`,
              employee: emp,
              colorClass: 'border-l-4 border-amber-500 bg-amber-50 text-amber-900',
              badgeBg: 'bg-amber-100 text-amber-800',
              badgeText: '5th Month Review'
            });
          }

          // 6th Month Regularization Due (if no explicit dateOfRegularization set)
          if (!emp.dateOfRegularization) {
            const m6 = new Date(hdate);
            m6.setMonth(m6.getMonth() + 6);
            if (m6.getFullYear() === currentYear) {
              const m6DateStr = m6.toISOString().split('T')[0];
              events.push({
                id: `prob_6m_${emp.id}`,
                type: 'probation',
                dateStr: m6DateStr,
                day: m6.getDate(),
                month: m6.getMonth(),
                year: m6.getFullYear(),
                title: `⭐ 6-Month Regularization Due: ${emp.firstName} ${emp.lastName}`,
                subtitle: `Final Regularization Decision Needed`,
                employee: emp,
                colorClass: 'border-l-4 border-purple-500 bg-purple-50 text-purple-900',
                badgeBg: 'bg-purple-100 text-purple-800',
                badgeText: 'Regularization Due'
              });
            }
          }
        }
      }

      // PAN / Salary Increase / Effective Date Reminder
      if (emp.salaryEffectiveDate) {
        const sDate = new Date(emp.salaryEffectiveDate);
        if (!isNaN(sDate.getTime()) && sDate.getFullYear() === currentYear) {
          events.push({
            id: `salary_eff_${emp.id}`,
            type: 'custom',
            dateStr: emp.salaryEffectiveDate,
            day: sDate.getDate(),
            month: sDate.getMonth(),
            year: sDate.getFullYear(),
            title: `💰 PAN / Salary Increase: ${emp.firstName} ${emp.lastName}`,
            subtitle: `Salary Adjustment Effective Date (${emp.monthlySalary ? `₱${Number(emp.monthlySalary).toLocaleString()}` : 'Salary Update'})`,
            employee: emp,
            colorClass: 'border-l-4 border-emerald-600 bg-emerald-50 text-emerald-950',
            badgeBg: 'bg-emerald-100 text-emerald-900',
            badgeText: 'PAN / Salary Increase'
          });
        }
      }

      // Salary History PAN Records
      if (Array.isArray(emp.salaryHistory)) {
        emp.salaryHistory.forEach((sh, idx) => {
          if (sh.effectiveDate) {
            const shDate = new Date(sh.effectiveDate);
            if (!isNaN(shDate.getTime()) && shDate.getFullYear() === currentYear) {
              events.push({
                id: `sal_hist_${emp.id}_${idx}`,
                type: 'custom',
                dateStr: sh.effectiveDate,
                day: shDate.getDate(),
                month: shDate.getMonth(),
                year: shDate.getFullYear(),
                title: `📈 PAN / Salary Adjustment: ${emp.firstName} ${emp.lastName}`,
                subtitle: `${sh.reason || 'Salary Adjustment'}: ${sh.previousSalary ? `₱${Number(sh.previousSalary).toLocaleString()} → ` : ''}₱${Number(sh.newSalary).toLocaleString()}`,
                employee: emp,
                colorClass: 'border-l-4 border-teal-600 bg-teal-50 text-teal-950',
                badgeBg: 'bg-teal-100 text-teal-900',
                badgeText: 'PAN / Increase'
              });
            }
          }
        });
      }

      // End of Contract Date
      if (emp.endOfContractDate) {
        const eocDate = new Date(emp.endOfContractDate);
        if (!isNaN(eocDate.getTime()) && eocDate.getFullYear() === currentYear) {
          events.push({
            id: `eoc_${emp.id}`,
            type: 'custom',
            dateStr: emp.endOfContractDate,
            day: eocDate.getDate(),
            month: eocDate.getMonth(),
            year: eocDate.getFullYear(),
            title: `📄 End of Contract: ${emp.firstName} ${emp.lastName}`,
            subtitle: `Contract End Date (${emp.position || ''})`,
            employee: emp,
            colorClass: 'border-l-4 border-amber-600 bg-amber-50 text-amber-950',
            badgeBg: 'bg-amber-100 text-amber-900',
            badgeText: 'End of Contract'
          });
        }
      }

      // Document Expiries
      if (emp.docExpiries) {
        Object.entries(emp.docExpiries).forEach(([reqId, val]) => {
          const expDateStr = String(val || '');
          if (!expDateStr) return;
          const expDate = new Date(expDateStr);
          if (isNaN(expDate.getTime())) return;

          if (expDate.getFullYear() === currentYear) {
            const docName = reqMap.get(reqId) || reqId.toUpperCase();
            events.push({
              id: `doc_exp_${emp.id}_${reqId}`,
              type: 'expiry',
              dateStr: expDateStr,
              day: expDate.getDate(),
              month: expDate.getMonth(),
              year: expDate.getFullYear(),
              title: `⚠️ ${docName} Expiry: ${emp.firstName} ${emp.lastName}`,
              subtitle: `Document "${docName}" expires on ${expDateStr}`,
              employee: emp,
              colorClass: 'border-l-4 border-rose-500 bg-rose-50 text-rose-900',
              badgeBg: 'bg-rose-100 text-rose-800',
              badgeText: `${docName} Expiry`
            });
          }
        });
      }
    });

    // 2. Custom Calendar Events
    (customEventsList || []).forEach(ce => {
      if (!ce) return;
      const edate = new Date(ce.dateStr);
      if (isNaN(edate.getTime())) return;

      if (edate.getFullYear() === currentYear) {
        const badgeStyle = ce.type === 'holiday'
          ? { bg: 'bg-rose-100 text-rose-800', color: 'border-l-4 border-rose-500 bg-rose-50 text-rose-900' }
          : ce.type === 'meeting'
          ? { bg: 'bg-sky-100 text-sky-800', color: 'border-l-4 border-sky-500 bg-sky-50 text-sky-900' }
          : ce.type === 'deadline'
          ? { bg: 'bg-amber-100 text-amber-800', color: 'border-l-4 border-amber-500 bg-amber-50 text-amber-900' }
          : { bg: 'bg-teal-100 text-teal-800', color: 'border-l-4 border-teal-500 bg-teal-50 text-teal-900' };

        events.push({
          id: `custom_${ce.id}`,
          type: 'custom',
          customEventId: ce.id,
          dateStr: ce.dateStr,
          day: edate.getDate(),
          month: edate.getMonth(),
          year: edate.getFullYear(),
          title: `📌 ${ce.title}`,
          subtitle: ce.description || 'Custom HR Event',
          description: ce.description,
          colorClass: badgeStyle.color,
          badgeBg: badgeStyle.bg,
          badgeText: ce.type.toUpperCase()
        });
      }
    });

    return events;
  };

  const allEvents = getAllEvents();

  // Filter events by selected category & month
  const monthEvents = allEvents.filter(ev => {
    if (ev.month !== currentMonth || ev.year !== currentYear) return false;
    if (selectedFilter !== 'all' && ev.type !== selectedFilter) return false;
    return true;
  });

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Calendar Header Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold shadow-xs">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              {monthNames[currentMonth]} {currentYear}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              HR Master Calendar ({monthEvents.length} events this month)
            </p>
          </div>
        </div>

        {/* Month Controls & Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add Custom Event Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all"
          >
            <Plus className="w-4 h-4" /> Add Event
          </button>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-white rounded-lg transition-all text-slate-700 hover:shadow-2xs"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1 hover:bg-white rounded-lg text-xs font-bold text-slate-800 transition-all hover:shadow-2xs"
            >
              Today
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white rounded-lg transition-all text-slate-700 hover:shadow-2xs"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                selectedFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({allEvents.filter(e => e.month === currentMonth && e.year === currentYear).length})
            </button>
            <button
              onClick={() => setSelectedFilter('birthday')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                selectedFilter === 'birthday' ? 'bg-pink-500 text-white shadow-2xs' : 'text-slate-600 hover:text-pink-600'
              }`}
            >
              <Cake className="w-3 h-3" /> Birthdays
            </button>
            <button
              onClick={() => setSelectedFilter('anniversary')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                selectedFilter === 'anniversary' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              <Award className="w-3 h-3" /> Anniversaries
            </button>
            <button
              onClick={() => setSelectedFilter('expiry')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                selectedFilter === 'expiry' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600 hover:text-rose-600'
              }`}
            >
              <AlertTriangle className="w-3 h-3" /> Expiries
            </button>
            <button
              onClick={() => setSelectedFilter('probation')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                selectedFilter === 'probation' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:text-purple-600'
              }`}
            >
              <Clock className="w-3 h-3" /> Reviews
            </button>
            <button
              onClick={() => setSelectedFilter('custom')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                selectedFilter === 'custom' ? 'bg-teal-600 text-white shadow-2xs' : 'text-slate-600 hover:text-teal-600'
              }`}
            >
              <Pin className="w-3 h-3" /> Custom
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid + Sidebar Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center font-extrabold text-xs text-slate-400 uppercase tracking-wider mb-2">
            <div className="py-2 text-rose-500">Sun</div>
            <div className="py-2">Mon</div>
            <div className="py-2">Tue</div>
            <div className="py-2">Wed</div>
            <div className="py-2">Thu</div>
            <div className="py-2">Fri</div>
            <div className="py-2 text-indigo-500">Sat</div>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* Empty slots before month start */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty_${i}`} className="h-28 bg-slate-50/50 rounded-xl border border-slate-100/50" />
            ))}

            {/* Actual Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayEvents = monthEvents.filter(e => e.day === dayNum);
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={`day_${dayNum}`}
                  onClick={() => {
                    if (dayEvents.length > 0) {
                      setSelectedDayEvents({ dateStr, events: dayEvents });
                    } else {
                      setNewEventForm(prev => ({ ...prev, dateStr }));
                      setShowAddModal(true);
                    }
                  }}
                  className={`h-28 p-2 rounded-xl border transition-all flex flex-col justify-between overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-xs ${
                    isToday
                      ? 'bg-blue-50/40 border-blue-500 ring-2 ring-blue-500/20'
                      : 'bg-white border-slate-200 hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black w-6 h-6 rounded-lg flex items-center justify-center ${
                      isToday ? 'bg-blue-600 text-white' : 'text-slate-800'
                    }`}>
                      {dayNum}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-slate-800 text-white">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Events list preview inside day cell */}
                  <div className="space-y-1 overflow-y-auto max-h-18 scrollbar-thin">
                    {dayEvents.slice(0, 2).map(ev => (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(ev);
                        }}
                        className={`text-[10px] font-bold p-1 rounded-md truncate transition-all hover:scale-102 ${ev.badgeBg}`}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[9px] font-bold text-slate-500 text-center">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Agenda / Upcoming Events sidebar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 flex flex-col h-full">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" /> Month Agenda & Events
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any event to view details.
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[500px] pr-1">
            {monthEvents.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <CalendarIcon className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-semibold">No events found for {monthNames[currentMonth]} {currentYear}</p>
              </div>
            ) : (
              monthEvents
                .sort((a, b) => a.day - b.day)
                .map(ev => (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className={`p-3 rounded-xl cursor-pointer transition-all hover:shadow-2xs ${ev.colorClass}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${ev.badgeBg}`}>
                        Day {ev.day} • {ev.badgeText}
                      </span>
                    </div>
                    <h4 className="font-bold text-xs">{ev.title}</h4>
                    {ev.subtitle && <p className="text-[11px] opacity-80 mt-0.5">{ev.subtitle}</p>}
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Selected Single Event Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${selectedEvent.badgeBg}`}>
                  {selectedEvent.badgeText}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-2">
                  {selectedEvent.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Date: <span className="font-bold text-slate-800">{selectedEvent.dateStr}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm p-1"
              >
                ✕
              </button>
            </div>

            {selectedEvent.employee ? (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center text-sm">
                    {selectedEvent.employee.firstName[0]}{selectedEvent.employee.lastName[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{selectedEvent.employee.firstName} {selectedEvent.employee.lastName}</h4>
                    <p className="text-slate-500">{selectedEvent.employee.position || 'No Position Specified'}</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Department:</span>
                    <span className="font-bold text-slate-700">{selectedEvent.employee.department || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Employee ID:</span>
                    <span className="font-bold text-slate-700">{selectedEvent.employee.empId}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Event Details</span>
                <p className="text-slate-700 font-medium">{selectedEvent.subtitle || 'No description added.'}</p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              {selectedEvent.employee && (
                <button
                  onClick={() => {
                    const empId = selectedEvent.employee!.id;
                    setSelectedEvent(null);
                    onViewEmployee(empId);
                  }}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" /> View Employee 201 File
                </button>
              )}

              {selectedEvent.customEventId && (
                <button
                  onClick={() => handleDeleteCustomEvent(selectedEvent.customEventId!)}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Trash2 className="w-4 h-4" /> Delete Event
                </button>
              )}

              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Day Events List Modal */}
      {selectedDayEvents && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Events on {selectedDayEvents.dateStr}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedDayEvents.events.length} event(s) scheduled
                </p>
              </div>
              <button
                onClick={() => setSelectedDayEvents(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {selectedDayEvents.events.map(ev => (
                <div key={ev.id} className={`p-3.5 rounded-xl border ${ev.colorClass} flex items-center justify-between`}>
                  <div>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${ev.badgeBg}`}>
                      {ev.badgeText}
                    </span>
                    <h4 className="font-bold text-xs mt-1">{ev.title}</h4>
                    {ev.subtitle && <p className="text-[11px] opacity-80 mt-0.5">{ev.subtitle}</p>}
                  </div>

                  {ev.employee && (
                    <button
                      onClick={() => {
                        const empId = ev.employee!.id;
                        setSelectedDayEvents(null);
                        onViewEmployee(empId);
                      }}
                      className="p-2 bg-white rounded-lg hover:bg-slate-100 text-slate-800 shadow-2xs font-bold text-xs flex items-center gap-1 shrink-0 ml-3"
                    >
                      <User className="w-3.5 h-3.5 text-blue-600" /> Profile
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setNewEventForm(prev => ({ ...prev, dateStr: selectedDayEvents.dateStr }));
                  setSelectedDayEvents(null);
                  setShowAddModal(true);
                }}
                className="px-3 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-xl flex items-center gap-1 hover:bg-blue-700"
              >
                <Plus className="w-3.5 h-3.5" /> Add Event on this Date
              </button>
              <button
                onClick={() => setSelectedDayEvents(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-600" /> Create Custom HR Calendar Event
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomEvent} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  value={newEventForm.title}
                  onChange={(e) => setNewEventForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Labor Day Holiday, HR Training Session..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Event Date *</label>
                  <input
                    type="date"
                    required
                    value={newEventForm.dateStr}
                    onChange={(e) => setNewEventForm(prev => ({ ...prev, dateStr: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Category / Type</label>
                  <select
                    value={newEventForm.type}
                    onChange={(e) => setNewEventForm(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold outline-none focus:border-blue-500"
                  >
                    <option value="event">General HR Event</option>
                    <option value="salary_increase">💰 PAN / Salary Increase</option>
                    <option value="holiday">Official Holiday</option>
                    <option value="meeting">Company Meeting</option>
                    <option value="deadline">Submission Deadline</option>
                    <option value="custom">✏️ Custom Category / Type...</option>
                  </select>

                  {newEventForm.type === 'custom' && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={newEventForm.customCategory || ''}
                        onChange={(e) => setNewEventForm(prev => ({ ...prev, customCategory: e.target.value }))}
                        placeholder="Enter custom category name (e.g. Audit, Outing)..."
                        className="w-full px-3 py-2 border border-blue-400 rounded-xl text-xs font-semibold bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Description / Notes</label>
                <textarea
                  rows={3}
                  value={newEventForm.description}
                  onChange={(e) => setNewEventForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Details, location, or agenda notes..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Save Calendar Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
