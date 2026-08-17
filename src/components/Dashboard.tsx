import React, { useState } from 'react';
import { CompanyKey, DocumentRequirement, Employee } from '../types';
import { DEFAULT_REQUIREMENTS } from '../lib/db';
import { getProbationaryStatus, checkDocumentExpiries, calculate201Completeness, checkMissingGovIds } from '../lib/hrUtils';
import { Users, UserCheck, Briefcase, TrendingUp, Calendar, AlertTriangle, UserX, User, Cake, Award, ChevronDown, ChevronUp, Clock, AlertCircle, FileCheck, DollarSign, CheckCircle2, CreditCard } from 'lucide-react';

interface DashboardProps {
  company: CompanyKey;
  employees: Employee[];
  requirements?: DocumentRequirement[];
  onViewEmployee: (id: string) => void;
  onRefreshData?: () => void;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  company,
  employees,
  requirements = DEFAULT_REQUIREMENTS,
  onViewEmployee,
  onRefreshData = () => {},
  onToast = () => {}
}) => {
  const [bdayMonth, setBdayMonth] = useState<number>(new Date().getMonth());
  const [annivMonth, setAnnivMonth] = useState<number>(new Date().getMonth());
  const [selectedRetentionMonth, setSelectedRetentionMonth] = useState<number>(new Date().getMonth());
  const [openGroup, setOpenGroup] = useState<string | null>('g1');
  const [metricPeriod, setMetricPeriod] = useState<'monthly' | 'semi-annual' | 'annual'>('monthly');
  const [showSeparatedModal, setShowSeparatedModal] = useState<boolean>(false);

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const isSeb = company === 'seb';
  const empList = Array.isArray(employees) ? employees : [];
  const active = empList.filter(e =>
    e &&
    (e.status === 'ACTIVE' || !e.status) &&
    !e.separationDate &&
    !e.resignationDate
  );
  const resignedList = empList.filter(e =>
    e && (
      e.status === 'RESIGNED' ||
      e.status === 'SEPARATED' ||
      e.status === 'AWOL' ||
      Boolean(e.separationDate) ||
      Boolean(e.resignationDate)
    )
  );
  const total = empList.length;
  const regular = active.filter(e => (e.classification || '').toLowerCase().includes('regular')).length;
  const probationary = active.filter(e => (e.classification || '').toLowerCase().includes('probationary')).length;
  const contractual = active.filter(e => (e.classification || '').toLowerCase().includes('contractual')).length;
  const inactive = empList.filter(e => e.status !== 'ACTIVE').length;
  const male = active.filter(e => e.gender === 'MALE').length;
  const female = active.filter(e => e.gender === 'FEMALE').length;

  // Compute Retention & Attrition Rates (Monthly Jan-Dec, Semi-Annual, Annual)
  const currentYear = new Date().getFullYear();
  let periodStartDate: Date;
  let periodEndDate: Date = new Date();

  if (metricPeriod === 'monthly') {
    periodStartDate = new Date(currentYear, selectedRetentionMonth, 1);
    periodEndDate = new Date(currentYear, selectedRetentionMonth + 1, 0, 23, 59, 59);
  } else if (metricPeriod === 'semi-annual') {
    periodStartDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  } else {
    periodStartDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  }

  const daysInPeriod = metricPeriod === 'monthly' ? 30 : metricPeriod === 'semi-annual' ? 180 : 365;

  const separatedInPeriod = employees.filter(e => {
    if (e.status !== 'RESIGNED' && e.status !== 'SEPARATED' && e.status !== 'AWOL' && !e.separationDate) return false;
    if (!e.separationDate) return e.status === 'RESIGNED' || e.status === 'SEPARATED' || e.status === 'AWOL';
    const sDate = new Date(e.separationDate);
    return !isNaN(sDate.getTime()) && sDate >= periodStartDate && sDate <= periodEndDate;
  }).length;

  const hiredInPeriod = employees.filter(e => {
    if (!e.dateHired) return false;
    const hDate = new Date(e.dateHired);
    return !isNaN(hDate.getTime()) && hDate >= periodStartDate && hDate <= periodEndDate;
  }).length;

  const currentActiveCount = active.length;
  const startHeadcount = Math.max(1, currentActiveCount + separatedInPeriod - hiredInPeriod);
  const avgHeadcount = Math.max(1, (startHeadcount + currentActiveCount) / 2);

  const turnoverRate = Math.min(100, Math.round((separatedInPeriod / avgHeadcount) * 1000) / 10);
  const retentionRate = Math.max(0, Math.min(100, Math.round(((startHeadcount - separatedInPeriod) / startHeadcount) * 1000) / 10));

  // 201 Completeness metrics
  const completenessList = active.map(e => calculate201Completeness(e, DEFAULT_REQUIREMENTS));
  const avgCompleteness = completenessList.length > 0
    ? Math.round(completenessList.reduce((acc, curr) => acc + curr.percentage, 0) / completenessList.length)
    : 100;
  const complete201Count = completenessList.filter(c => c.isComplete).length;
  const incomplete201Count = completenessList.length - complete201Count;

  // Probationary 6-Month Countdown & Performance Review List
  const probationaryList = active
    .filter(e => (e.classification || '').toLowerCase().includes('probationary'))
    .map(e => ({
      employee: e,
      status: getProbationaryStatus(e)
    }))
    .filter(x => x.status !== null)
    .sort((a, b) => a.status!.daysRemaining - b.status!.daysRemaining);

  // Document Expiry Alerts (NBI, Medical, Licenses)
  const expiryAlerts = checkDocumentExpiries(active, DEFAULT_REQUIREMENTS);

  // Missing Government IDs (SSS, TIN, PhilHealth, Pag-IBIG) Alerts
  const missingGovAlerts = active
    .map(e => ({
      employee: e,
      missing: checkMissingGovIds(e)
    }))
    .filter(x => x.missing.length > 0);

  // Department counts
  const deptCounts: Record<string, number> = {};
  (active || []).forEach(e => {
    if (!e) return;
    const d = e.department || 'Unassigned';
    deptCounts[d] = (deptCounts[d] || 0) + 1;
  });
  const sortedDepts = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxDeptCount = Math.max(...sortedDepts.map(x => x[1]), 1);

  // Birthdays for selected month
  const now = new Date();
  const birthdays = active
    .filter(e => e.birthdate && new Date(e.birthdate).getMonth() === bdayMonth)
    .map(e => {
      const b = new Date(e.birthdate!);
      return {
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        dateStr: `${monthAbbr[b.getMonth()]} ${b.getDate()}`,
        day: b.getDate(),
        age: now.getFullYear() - b.getFullYear(),
        position: e.position || 'N/A'
      };
    })
    .sort((a, b) => a.day - b.day);

  // Work Anniversaries for selected month
  const anniversaries = active
    .filter(e => {
      if (!e.dateHired) return false;
      const h = new Date(e.dateHired);
      const yrs = now.getFullYear() - h.getFullYear();
      return h.getMonth() === annivMonth && yrs >= 1;
    })
    .map(e => {
      const h = new Date(e.dateHired!);
      const yrs = now.getFullYear() - h.getFullYear();
      const thisYearAnniv = new Date(now.getFullYear(), h.getMonth(), h.getDate());
      const nextYearAnniv = new Date(now.getFullYear() + 1, h.getMonth(), h.getDate());
      const nextAnniv = now > thisYearAnniv ? nextYearAnniv : thisYearAnniv;
      const daysUntil = Math.ceil((nextAnniv.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        fullDate: `${monthAbbr[h.getMonth()]} ${h.getDate()}, ${h.getFullYear()}`,
        years: yrs,
        position: e.position || 'N/A',
        dept: e.department || 'N/A',
        daysUntil
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  // New employees grouping
  const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());

  const newHiresG1 = active.filter(e => e.dateHired && new Date(e.dateHired) >= oneMonthAgo);
  const newHiresG2 = active.filter(e => {
    if (!e.dateHired) return false;
    const d = new Date(e.dateHired);
    return d < oneMonthAgo && d >= threeMonthsAgo;
  });
  const newHiresG3 = active.filter(e => {
    if (!e.dateHired) return false;
    const d = new Date(e.dateHired);
    return d < threeMonthsAgo && d >= sixMonthsAgo;
  });

  // Hiring trend last 12 months
  const hiringMonths = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const count = employees.filter(e => {
      if (!e.dateHired) return false;
      const hiredDate = new Date(e.dateHired);
      return hiredDate.getFullYear() === d.getFullYear() && hiredDate.getMonth() === d.getMonth();
    }).length;
    hiringMonths.push({
      label: monthAbbr[d.getMonth()],
      year: d.getFullYear(),
      count
    });
  }
  const maxHiringCount = Math.max(...hiringMonths.map(m => m.count), 1);

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Staff</span>
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl"><Users className="w-5 h-5" /></div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{total}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active</span>
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl"><UserCheck className="w-5 h-5" /></div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{active.length}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Regular</span>
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl"><Briefcase className="w-5 h-5" /></div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{regular}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Probationary</span>
            <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl"><TrendingUp className="w-5 h-5" /></div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{probationary}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">201 Completeness</span>
            <div className="p-2.5 bg-teal-50 text-teal-700 rounded-xl"><FileCheck className="w-5 h-5" /></div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">{avgCompleteness}%</span>
            <span className="text-xs font-semibold text-slate-500">Avg ({complete201Count}/{total} Complete)</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Doc Expiry Alerts</span>
            <div className={`p-2.5 rounded-xl ${expiryAlerts.length > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{expiryAlerts.length}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Male</span>
            <div className="p-2.5 bg-cyan-50 text-cyan-700 rounded-xl"><User className="w-5 h-5" /></div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{male}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Female</span>
            <div className="p-2.5 bg-pink-50 text-pink-700 rounded-xl"><User className="w-5 h-5" /></div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{female}</div>
        </div>
      </div>

      {/* HR Retention & Attrition Rate Control Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" /> Retention & Attrition (Turnover) Analytics
            </h3>
            <p className="text-xs text-slate-500">
              Real-time calculation of employee retention and turnover rate across selected period.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setMetricPeriod('monthly')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  metricPeriod === 'monthly' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly (Jan - Dec)
              </button>
              <button
                onClick={() => setMetricPeriod('semi-annual')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  metricPeriod === 'semi-annual' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semi-Annual (6M)
              </button>
              <button
                onClick={() => setMetricPeriod('annual')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  metricPeriod === 'annual' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Annual (12M)
              </button>
            </div>
          </div>
        </div>

        {metricPeriod === 'monthly' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100 pt-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase shrink-0 mr-1">Select Month (Jan-Dec):</span>
            {months.map((mName, mIdx) => (
              <button
                key={mName}
                type="button"
                onClick={() => setSelectedRetentionMonth(mIdx)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedRetentionMonth === mIdx
                    ? 'bg-blue-600 text-white shadow-xs font-extrabold scale-105'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {monthAbbr[mIdx]}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
              Retention Rate ({metricPeriod === 'monthly' ? months[selectedRetentionMonth].toUpperCase() : metricPeriod.toUpperCase()})
            </span>
            <div className="text-3xl font-black text-emerald-900">{retentionRate}%</div>
            <p className="text-[11px] text-emerald-700 font-medium mt-1">
              {startHeadcount - separatedInPeriod} retained out of {startHeadcount} base headcount
            </p>
          </div>

          <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block mb-1">
              Attrition / Turnover Rate ({metricPeriod === 'monthly' ? months[selectedRetentionMonth].toUpperCase() : metricPeriod.toUpperCase()})
            </span>
            <div className="text-3xl font-black text-rose-900">{turnoverRate}%</div>
            <p className="text-[11px] text-rose-700 font-medium mt-1">
              {separatedInPeriod} separations in selected period
            </p>
          </div>

          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl">
            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-1">
              New Hires in Period
            </span>
            <div className="text-3xl font-black text-blue-900">+{hiredInPeriod}</div>
            <p className="text-[11px] text-blue-700 font-medium mt-1">
              Hired in {metricPeriod === 'monthly' ? months[selectedRetentionMonth] : `${daysInPeriod} days`}
            </p>
          </div>

          <div
            onClick={() => setShowSeparatedModal(true)}
            className="p-4 bg-amber-50/70 hover:bg-amber-100/80 border border-amber-300 rounded-xl cursor-pointer transition-all group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                Resigned & Separated
              </span>
              <span className="text-[9px] font-bold text-amber-700 bg-amber-200/80 px-1.5 py-0.5 rounded group-hover:bg-amber-300">
                View Final Pay ➔
              </span>
            </div>
            <div className="text-3xl font-black text-amber-900">{resignedList.length}</div>
            <p className="text-[11px] text-amber-700 font-medium mt-1">
              Click to view Final / Last Pay details & amounts
            </p>
          </div>
        </div>
      </div>

      {/* Probationary 6-Month Regularization Countdown & Performance Review Reminders Section */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-700">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-slate-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
                Probationary 6-Month Regularization & Performance Review Tracker
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-400 text-slate-950">
                  {probationaryList.length} Active Probationary
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Monitors employee 6-month regularization deadlines, 3rd month performance reviews, and 5th month evaluations.
              </p>
            </div>
          </div>
        </div>

        {probationaryList.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs bg-slate-800/50 rounded-xl border border-slate-700/50">
            No active probationary employees at this time. All employees are fully regularized or non-probationary.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {probationaryList.map(({ employee, status }) => {
              if (!status) return null;
              const isUrgent = status.daysRemaining <= 30;
              const isOverdue = status.daysRemaining <= 0;

              return (
                <div
                  key={employee.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isOverdue
                      ? 'bg-rose-950/60 border-rose-500/50 text-white'
                      : isUrgent
                      ? 'bg-amber-950/60 border-amber-500/50 text-white'
                      : 'bg-slate-800/80 border-slate-700 text-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h4 className="font-bold text-sm text-white flex items-center gap-2">
                        {employee.firstName} {employee.lastName}
                        <span className="text-[10px] font-mono font-semibold text-slate-400">
                          ({employee.empId})
                        </span>
                      </h4>
                      <p className="text-xs text-slate-300">{employee.position || 'Staff'} • {employee.department || 'Dept'}</p>
                    </div>

                    <button
                      onClick={() => onViewEmployee(employee.id)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors shrink-0"
                    >
                      View & Evaluate
                    </button>
                  </div>

                  {/* Regularization Countdown Bar */}
                  <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 font-medium">Hired: {employee.dateHired}</span>
                      <span className={`font-black font-mono ${isOverdue ? 'text-rose-400' : isUrgent ? 'text-amber-400' : 'text-blue-400'}`}>
                        {isOverdue ? '⚠️ OVERDUE' : `⏱️ ${status.daysRemaining} Days Left`}
                      </span>
                    </div>

                    {/* Visual Progress Bar (6-Month timeline) */}
                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          isOverdue ? 'bg-rose-500' : isUrgent ? 'bg-amber-400' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, ((180 - status.daysRemaining) / 180) * 100))}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                      <span>Target Regularization Date:</span>
                      <span className="font-bold text-white">{status.regularizationDate}</span>
                    </div>
                  </div>

                  {/* Performance Evaluation Checkpoints */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                    <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${
                      employee.perfReviews?.month3Done
                        ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300'
                        : 'bg-slate-900/40 border-slate-700 text-slate-400'
                    }`}>
                      <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${employee.perfReviews?.month3Done ? 'text-emerald-400' : 'text-slate-600'}`} />
                      <div>
                        <span className="font-bold block">3rd Month Review</span>
                        <span className="text-[9px] opacity-80">{employee.perfReviews?.month3Done ? 'Completed' : `Due: ${status.month3Due}`}</span>
                      </div>
                    </div>

                    <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${
                      employee.perfReviews?.month5Done
                        ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300'
                        : isUrgent
                        ? 'bg-amber-950/50 border-amber-600/50 text-amber-200'
                        : 'bg-slate-900/40 border-slate-700 text-slate-400'
                    }`}>
                      <Clock className={`w-3.5 h-3.5 shrink-0 ${employee.perfReviews?.month5Done ? 'text-emerald-400' : 'text-amber-400'}`} />
                      <div>
                        <span className="font-bold block">5th Month Final Eval</span>
                        <span className="text-[9px] opacity-80">{employee.perfReviews?.month5Done ? 'Completed' : `Due: ${status.month5Due}`}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Document Expiry & Clearance Alert System */}
      {expiryAlerts.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2.5 mb-3 text-rose-900">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <h3 className="font-bold text-sm uppercase tracking-wider">
              Document Expiry & Clearance Warning Alert System ({expiryAlerts.length})
            </h3>
          </div>
          <p className="text-xs text-rose-700 mb-4">
            The following employee 201 clearances or documents (NBI Clearance, Medical Fit-To-Work, Certifications) are expired or expiring within 30 days.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {expiryAlerts.map((alert, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl border flex flex-col justify-between gap-2 bg-white ${
                  alert.status === 'EXPIRED' ? 'border-rose-300 shadow-xs' : 'border-amber-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-xs text-slate-900">{alert.employeeName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                      alert.status === 'EXPIRED' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {alert.status === 'EXPIRED' ? 'Expired' : `${alert.daysLeft} days left`}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700">{alert.docName}</p>
                  <p className="text-[10px] text-slate-500">Expiry Date: <span className="font-mono font-bold text-slate-800">{alert.expiryDate}</span></p>
                </div>
                <button
                  onClick={() => onViewEmployee(alert.employeeId)}
                  className="w-full py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-center"
                >
                  Update Document & Clearance
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mandatory Government ID Warnings */}
      {missingGovAlerts.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 text-amber-950">
              <CreditCard className="w-5 h-5 text-amber-600 shrink-0" />
              <h3 className="font-bold text-sm uppercase tracking-wider">
                Mandatory Government ID Warnings ({missingGovAlerts.length} Employees Incomplete)
              </h3>
            </div>
            <span className="px-2.5 py-1 bg-amber-200 text-amber-900 rounded-full text-[10px] font-black uppercase">
              SSS • TIN • PhilHealth • Pag-IBIG
            </span>
          </div>
          <p className="text-xs text-amber-900 mb-4">
            The following active employees are missing mandatory Philippine government registration numbers required for statutory payroll contributions and 201 compliance.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {missingGovAlerts.map(({ employee, missing }, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-amber-200 bg-white flex flex-col justify-between gap-2 shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-xs text-slate-900">{employee.firstName} {employee.lastName}</span>
                    <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                      {employee.empId}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mb-1.5">{employee.position || 'Staff'} • {employee.department || 'Dept'}</p>
                  <div className="flex flex-wrap gap-1">
                    {missing.map(m => (
                      <span key={m} className="px-1.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded text-[9px] font-black">
                        Missing {m}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => onViewEmployee(employee.id)}
                  className="w-full py-1 text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors text-center cursor-pointer mt-1"
                >
                  Edit Employee & Fill IDs ➔
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Department Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
          <h3 className="font-bold text-slate-900 text-sm mb-5 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-600" /> Department Distribution
          </h3>
          <div className="space-y-3">
            {sortedDepts.map(([dept, count]) => (
              <div key={dept} className="flex items-center gap-3 text-xs">
                <span className="w-28 font-semibold text-slate-600 truncate">{dept}</span>
                <div className="flex-1 bg-slate-100 h-5 rounded-lg overflow-hidden relative">
                  <div
                    className={`h-full ${isSeb ? 'bg-teal-600' : 'bg-blue-600'} rounded-lg transition-all duration-500 flex items-center justify-end px-2 text-[10px] font-bold text-white`}
                    style={{ width: `${(count / maxDeptCount) * 100}%` }}
                  >
                    {count}
                  </div>
                </div>
              </div>
            ))}
            {sortedDepts.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">No employee department data available.</p>
            )}
          </div>
        </div>

        {/* Gender Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
          <h3 className="font-bold text-slate-900 text-sm mb-5 flex items-center gap-2">
            <Users className="w-4 h-4 text-pink-600" /> Gender Ratio
          </h3>
          <div className="flex items-center justify-around py-4">
            <div className="text-center">
              <div className="w-20 h-20 bg-cyan-100 text-cyan-800 rounded-2xl flex flex-col items-center justify-center mx-auto mb-2 font-bold">
                <span className="text-2xl">{male}</span>
                <span className="text-[10px] uppercase font-bold text-cyan-600">Male</span>
              </div>
              <span className="text-xs text-slate-500 font-semibold">{active.length ? Math.round((male / active.length) * 100) : 0}%</span>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-pink-100 text-pink-800 rounded-2xl flex flex-col items-center justify-center mx-auto mb-2 font-bold">
                <span className="text-2xl">{female}</span>
                <span className="text-[10px] uppercase font-bold text-pink-600">Female</span>
              </div>
              <span className="text-xs text-slate-500 font-semibold">{active.length ? Math.round((female / active.length) * 100) : 0}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: New Hires Accordion & Hiring Trend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* New Employees */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
          <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" /> New Employees (1-6 Months)
          </h3>

          <div className="space-y-3">
            {/* G1: 0-1 month */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenGroup(openGroup === 'g1' ? null : 'g1')}
                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left flex items-center justify-between font-bold text-xs text-slate-800"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>0 - 1 Month</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-slate-600">{newHiresG1.length}</span>
                  {openGroup === 'g1' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>
              {openGroup === 'g1' && (
                <div className="p-3 bg-white space-y-2 border-t border-slate-200">
                  {newHiresG1.map(e => (
                    <div key={e.id} onClick={() => onViewEmployee(e.id)} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{e.firstName} {e.lastName}</p>
                        <p className="text-[10px] text-slate-500">{e.position} • {e.department}</p>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400">{e.dateHired}</span>
                    </div>
                  ))}
                  {newHiresG1.length === 0 && <p className="text-[11px] text-slate-400 p-2 text-center">No new hires in 1 month.</p>}
                </div>
              )}
            </div>

            {/* G2: 1-3 months */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenGroup(openGroup === 'g2' ? null : 'g2')}
                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left flex items-center justify-between font-bold text-xs text-slate-800"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  <span>1 - 3 Months</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-slate-600">{newHiresG2.length}</span>
                  {openGroup === 'g2' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>
              {openGroup === 'g2' && (
                <div className="p-3 bg-white space-y-2 border-t border-slate-200">
                  {newHiresG2.map(e => (
                    <div key={e.id} onClick={() => onViewEmployee(e.id)} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{e.firstName} {e.lastName}</p>
                        <p className="text-[10px] text-slate-500">{e.position} • {e.department}</p>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400">{e.dateHired}</span>
                    </div>
                  ))}
                  {newHiresG2.length === 0 && <p className="text-[11px] text-slate-400 p-2 text-center">No hires in 1-3 months.</p>}
                </div>
              )}
            </div>

            {/* G3: 3-6 months */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenGroup(openGroup === 'g3' ? null : 'g3')}
                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left flex items-center justify-between font-bold text-xs text-slate-800"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span>3 - 6 Months</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-slate-600">{newHiresG3.length}</span>
                  {openGroup === 'g3' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>
              {openGroup === 'g3' && (
                <div className="p-3 bg-white space-y-2 border-t border-slate-200">
                  {newHiresG3.map(e => (
                    <div key={e.id} onClick={() => onViewEmployee(e.id)} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{e.firstName} {e.lastName}</p>
                        <p className="text-[10px] text-slate-500">{e.position} • {e.department}</p>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400">{e.dateHired}</span>
                    </div>
                  ))}
                  {newHiresG3.length === 0 && <p className="text-[11px] text-slate-400 p-2 text-center">No hires in 3-6 months.</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hiring Trend */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-600" /> Hiring Trend (Last 12 Months)
          </h3>
          <div className="flex items-end gap-1.5 h-44 pt-6 pb-2 border-b border-slate-100">
            {hiringMonths.map((m, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                <div
                  className={`w-full max-w-[28px] ${isSeb ? 'bg-teal-500 hover:bg-teal-600' : 'bg-blue-600 hover:bg-blue-700'} rounded-t-md transition-all relative flex justify-center`}
                  style={{ height: `${(m.count / maxHiringCount) * 100}%`, minHeight: '4px' }}
                >
                  {m.count > 0 && (
                    <span className="absolute -top-5 text-[10px] font-extrabold text-slate-800">{m.count}</span>
                  )}
                </div>
                <span className="text-[9px] font-semibold text-slate-400">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Birthdays & Anniversaries Trackers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Birthdays */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Cake className="w-4 h-4 text-pink-500" /> Employee Birthdays
            </h3>
            <select
              value={bdayMonth}
              onChange={(e) => setBdayMonth(Number(e.target.value))}
              className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
            >
              {months.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          </div>
          <div className="p-5 space-y-3 max-h-80 overflow-y-auto">
            {birthdays.map(b => (
              <div key={b.id} onClick={() => onViewEmployee(b.id)} className="flex items-center justify-between p-3 hover:bg-pink-50/50 rounded-xl cursor-pointer border border-slate-100 transition-colors">
                <div>
                  <p className="font-bold text-slate-800 text-xs">{b.name}</p>
                  <p className="text-[10px] text-slate-500">{b.position} • Turns {b.age}</p>
                </div>
                <span className="px-2.5 py-1 bg-pink-100 text-pink-700 rounded-lg text-xs font-bold">{b.dateStr}</span>
              </div>
            ))}
            {birthdays.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-8">No birthdays in {months[bdayMonth]}.</p>
            )}
          </div>
        </div>

        {/* Anniversaries */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" /> Work Anniversaries
            </h3>
            <select
              value={annivMonth}
              onChange={(e) => setAnnivMonth(Number(e.target.value))}
              className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
            >
              {months.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          </div>
          <div className="p-5 space-y-3 max-h-80 overflow-y-auto">
            {anniversaries.map(a => (
              <div key={a.id} onClick={() => onViewEmployee(a.id)} className="flex items-center justify-between p-3 hover:bg-amber-50/50 rounded-xl cursor-pointer border border-slate-100 transition-colors">
                <div>
                  <p className="font-bold text-slate-800 text-xs">{a.name}</p>
                  <p className="text-[10px] text-slate-500">{a.position} • {a.dept}</p>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold block">{a.years} Years</span>
                  <span className="text-[10px] text-slate-400 font-medium block mt-1">{a.fullDate}</span>
                </div>
              </div>
            ))}
            {anniversaries.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-8">No work anniversaries in {months[annivMonth]}.</p>
            )}
          </div>
        </div>
      </div>

      {/* Resigned & Separated Employees Final Pay Modal */}
      {showSeparatedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 bg-amber-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider flex items-center gap-2">
                  <UserX className="w-5 h-5 text-amber-300" /> Resigned & Separated Employees ({resignedList.length})
                </h3>
                <p className="text-xs text-amber-200">
                  30-Day Last Pay Schedule, Clearance Status & Final Pay Amounts
                </p>
              </div>
              <button
                onClick={() => setShowSeparatedModal(false)}
                className="w-8 h-8 rounded-full bg-amber-800 hover:bg-amber-700 flex items-center justify-center text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {resignedList.length === 0 ? (
                <p className="text-center text-xs font-semibold text-slate-400 py-10">
                  No resigned or separated employees on record.
                </p>
              ) : (
                resignedList.map(emp => {
                  const fullName = `${emp.lastName}, ${emp.firstName} ${emp.middleName ? emp.middleName[0] + '.' : ''} ${emp.suffix || ''}`;
                  const lastPaySched = emp.lastPayScheduleDate || (emp.separationDate ? new Date(new Date(emp.separationDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : 'N/A');

                  return (
                    <div
                      key={emp.id}
                      className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/60 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-slate-900">{fullName}</span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-800">
                            {emp.status || 'RESIGNED'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium">
                          {emp.position || 'N/A'} • {emp.department || 'General Staff'} ({emp.empId})
                        </p>
                        <p className="text-[11px] text-amber-900 font-bold">
                          Date Separated: {emp.separationDate || 'N/A'} • 30-Day Last Pay Schedule: {lastPaySched}
                        </p>
                      </div>

                      <div className="flex flex-col sm:items-end gap-1 shrink-0 w-full sm:w-auto">
                        <span className="text-xs font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-xl">
                          Final Pay: ₱{emp.lastPayAmount ? Number(emp.lastPayAmount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                        </span>
                        <span className="text-[10px] font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded uppercase">
                          Status: {emp.lastPayStatus || 'PENDING'}
                        </span>
                        <button
                          onClick={() => {
                            setShowSeparatedModal(false);
                            onViewEmployee(emp.id);
                          }}
                          className="mt-1 text-[11px] font-extrabold text-blue-700 hover:underline cursor-pointer"
                        >
                          View 201 File ➔
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowSeparatedModal(false)}
                className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
