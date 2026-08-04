import React, { useState } from 'react';
import { Employee, AttendanceRecord, UserRole } from '../types';
import { Clock, AlertTriangle, CheckCircle2, Search, Filter, Plus, ShieldAlert, User, Calendar, FileText, ArrowUpRight, X } from 'lucide-react';

interface AttendanceTrackerViewProps {
  employees: Employee[];
  userRole?: UserRole;
  onViewEmployee: (employee: Employee) => void;
  onUpdateEmployee: (updated: Employee) => void;
}

export const AttendanceTrackerView: React.FC<AttendanceTrackerViewProps> = ({
  employees,
  userRole = 'admin',
  onViewEmployee,
  onUpdateEmployee
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [selectedEmpId, setSelectedEmpId] = useState<string>(employees[0]?.id || '');
  const [form, setForm] = useState<{
    date: string;
    timeIn: string;
    timeOut: string;
    status: string;
    minutesLate: string;
    notes: string;
  }>({
    date: new Date().toISOString().split('T')[0],
    timeIn: '08:30 AM',
    timeOut: '05:00 PM',
    status: 'LATE',
    minutesLate: '20',
    notes: ''
  });

  // Calculate consecutive executive days late for each employee
  const getConsecutiveLateDays = (emp: Employee): number => {
    const records = [...(emp.attendanceRecords || [])].sort((a, b) => b.date.localeCompare(a.date));
    let count = 0;
    for (const rec of records) {
      if (rec.status === 'LATE' || rec.status === 'EXECUTIVE_LATE' || (rec.minutesLate && rec.minutesLate > 0)) {
        count++;
      } else if (rec.status === 'PRESENT') {
        break;
      }
    }
    return count;
  };

  // Find employees with 3 or more consecutive executive days late
  const executiveLateWarningEmployees = employees.filter(emp => getConsecutiveLateDays(emp) >= 3);

  // All attendance records across all employees
  const allRecordsWithEmployee = employees.flatMap(emp =>
    (emp.attendanceRecords || []).map(record => ({
      ...record,
      employee: emp,
      consecutiveLateCount: getConsecutiveLateDays(emp)
    }))
  ).sort((a, b) => b.date.localeCompare(a.date));

  const filteredRecords = allRecordsWithEmployee.filter(item => {
    const matchesSearch =
      `${item.employee.firstName} ${item.employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.employee.id.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === '3_CONSECUTIVE_LATE') {
      return item.consecutiveLateCount >= 3;
    }
    if (filterStatus !== 'ALL') {
      return item.status === filterStatus;
    }
    return true;
  });

  const totalLateCount = allRecordsWithEmployee.filter(r => r.status === 'LATE' || r.status === 'EXECUTIVE_LATE').length;

  const handleSaveAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === selectedEmpId);
    if (!emp) return;

    const minLate = parseInt(form.minutesLate, 10) || 0;
    const newRecord: AttendanceRecord = {
      id: `att_${Date.now()}`,
      date: form.date,
      timeIn: form.timeIn || '08:00 AM',
      timeOut: form.timeOut || '05:00 PM',
      status: form.status,
      minutesLate: minLate,
      notes: form.notes || (minLate > 0 ? `${minLate} mins late` : 'On time')
    };

    const updatedRecords = [newRecord, ...(emp.attendanceRecords || [])].sort((a, b) => b.date.localeCompare(a.date));
    const updatedEmployee: Employee = {
      ...emp,
      attendanceRecords: updatedRecords
    };

    onUpdateEmployee(updatedEmployee);
    setShowLogModal(false);
    setForm({
      date: new Date().toISOString().split('T')[0],
      timeIn: '08:30 AM',
      timeOut: '05:00 PM',
      status: 'LATE',
      minutesLate: '20',
      notes: ''
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center font-bold shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-900 text-xl tracking-tight">
              Company Attendance Tracker
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Monitor daily attendance, tardiness logs, and automatic 3-Executive Days Late warnings.
            </p>
          </div>
        </div>

        {userRole === 'admin' && (
          <button
            type="button"
            onClick={() => setShowLogModal(true)}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Log Employee Attendance / Late
          </button>
        )}
      </div>

      {/* 3 Executive Days Late Alert Banner */}
      {executiveLateWarningEmployees.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0" />
            <div>
              <h3 className="font-black text-rose-900 text-sm uppercase tracking-wide">
                ⚠️ HR Warning: {executiveLateWarningEmployees.length} Employee(s) with 3+ Consecutive Executive Days Late!
              </h3>
              <p className="text-xs text-rose-800">
                The following employees have reached 3 or more consecutive executive days late and require immediate HR attention or a Notice to Explain (NTE).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {executiveLateWarningEmployees.map(emp => {
              const count = getConsecutiveLateDays(emp);
              return (
                <div key={emp.id} className="bg-white p-3.5 rounded-2xl border border-rose-200 shadow-xs flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 bg-rose-100 text-rose-700 rounded-xl font-bold text-xs flex items-center justify-center shrink-0">
                      {emp.firstName[0]}{emp.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-xs truncate">
                        {emp.firstName} {emp.lastName}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{emp.position} • {emp.department}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 bg-rose-600 text-white font-black text-[11px] rounded-lg animate-pulse">
                      {count} Days Late
                    </span>
                    <button
                      type="button"
                      onClick={() => onViewEmployee(emp)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="View Employee Record"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Attendance Logs</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{allRecordsWithEmployee.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tardiness / Late Incidents</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{totalLateCount}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">3+ Consecutive Days Late Warnings</p>
          <p className="text-2xl font-black text-rose-600 mt-1">{executiveLateWarningEmployees.length}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
          >
            <option value="ALL">All Records</option>
            <option value="LATE">Late Only</option>
            <option value="EXECUTIVE_LATE">Executive Late</option>
            <option value="3_CONSECUTIVE_LATE">3+ Consecutive Days Late</option>
            <option value="PRESENT">On Time / Present</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="font-bold text-sm">No attendance records found</p>
            <p className="text-xs text-slate-400 mt-0.5">Try adjusting your filter or log a new attendance incident.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Time In</th>
                  <th className="py-3 px-4">Time Out</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Minutes Late</th>
                  <th className="py-3 px-4">Consecutive Days Late</th>
                  <th className="py-3 px-4">Notes / Reason</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((item) => (
                  <tr key={`${item.id}_${item.employee.id}`} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-slate-100 text-slate-700 rounded-lg font-bold text-xs flex items-center justify-center shrink-0">
                          {item.employee.firstName[0]}{item.employee.lastName[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{item.employee.firstName} {item.employee.lastName}</p>
                          <p className="text-[10px] text-slate-400">{item.employee.id} • {item.employee.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{item.date}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">{item.timeIn || '—'}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{item.timeOut || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        item.status === 'PRESENT'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : item.status === 'LATE' || item.status === 'EXECUTIVE_LATE'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {item.minutesLate && item.minutesLate > 0 ? (
                        <span className="font-bold text-rose-600">{item.minutesLate} mins late</span>
                      ) : (
                        <span className="text-slate-400">On time</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {item.consecutiveLateCount >= 3 ? (
                        <span className="px-2.5 py-0.5 bg-rose-600 text-white font-black text-[10px] rounded-lg animate-pulse">
                          {item.consecutiveLateCount} Executive Days Late
                        </span>
                      ) : item.consecutiveLateCount > 0 ? (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold text-[10px] rounded-lg border border-amber-300">
                          {item.consecutiveLateCount} Day(s) Late
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{item.notes || '—'}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onViewEmployee(item.employee)}
                        className="px-3 py-1 bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-700 font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1"
                      >
                        Profile <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Attendance Modal */}
      {showLogModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider text-amber-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                Log Employee Attendance / Late
              </h3>
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAttendance} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Select Employee *</label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-bold"
                  required
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Status *</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-bold"
                  >
                    <option value="LATE">LATE (Late Arrival)</option>
                    <option value="EXECUTIVE_LATE">EXECUTIVE LATE (Executive Day Late)</option>
                    <option value="PRESENT">PRESENT (On Time)</option>
                    <option value="HALF_DAY">HALF DAY</option>
                    <option value="ABSENT">ABSENT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Time In</label>
                  <input
                    type="text"
                    placeholder="08:30 AM"
                    value={form.timeIn}
                    onChange={(e) => setForm(prev => ({ ...prev, timeIn: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Time Out</label>
                  <input
                    type="text"
                    placeholder="05:00 PM"
                    value={form.timeOut}
                    onChange={(e) => setForm(prev => ({ ...prev, timeOut: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-rose-700 uppercase mb-1">Minutes Late</label>
                <input
                  type="number"
                  placeholder="e.g. 20"
                  value={form.minutesLate}
                  onChange={(e) => setForm(prev => ({ ...prev, minutesLate: e.target.value }))}
                  className="w-full px-3 py-2 border-2 border-rose-200 rounded-xl outline-none font-bold"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">
                  3 consecutive executive days late triggers the HR Disciplinary Warning banner.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Notes / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Traffic along Commonwealth / Vehicle trouble"
                  value={form.notes}
                  onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-amber-700"
                >
                  Save Attendance Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
