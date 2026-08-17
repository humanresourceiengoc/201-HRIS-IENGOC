import React, { useState, useMemo } from 'react';
import { CompanyKey, DocumentRequirement, Employee, UserRole } from '../types';
import { calculate201Completeness, getProbationaryStatus, checkDocumentExpiries, checkMissingGovIds } from '../lib/hrUtils';
import { 
  Search, 
  Eye, 
  Edit3, 
  Trash2, 
  Printer, 
  FileCheck, 
  CreditCard, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  FileSpreadsheet, 
  Mail, 
  X, 
  RotateCcw,
  SlidersHorizontal,
  Building2,
  Briefcase
} from 'lucide-react';

interface EmployeesListProps {
  company: CompanyKey;
  userRole: UserRole;
  employees: Employee[];
  requirements: DocumentRequirement[];
  onViewEmployee: (id: string) => void;
  onEditEmployee: (id: string) => void;
  onDeleteEmployee: (id: string) => void;
  onPrintEmployee: (id: string) => void;
  onOpenIdCard?: (emp: Employee) => void;
  onOpenGoogleSheets?: () => void;
}

export const EmployeesList: React.FC<EmployeesListProps> = ({
  company,
  userRole,
  employees,
  requirements,
  onViewEmployee,
  onEditEmployee,
  onDeleteEmployee,
  onPrintEmployee,
  onOpenIdCard,
  onOpenGoogleSheets
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [completenessFilter, setCompletenessFilter] = useState<string>('all');
  const [expiryFilter, setExpiryFilter] = useState<boolean>(false);
  const [missingGovFilter, setMissingGovFilter] = useState<boolean>(false);

  const isSeb = company === 'seb';

  const departments = useMemo(() => {
    const set = new Set<string>();
    (employees || []).forEach(e => {
      if (e && e.department) set.add(e.department.trim());
    });
    return Array.from(set).filter(Boolean).sort();
  }, [employees]);

  const hasActiveFilters = Boolean(
    searchTerm || statusFilter || classFilter || deptFilter || completenessFilter !== 'all' || expiryFilter || missingGovFilter
  );

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setClassFilter('');
    setDeptFilter('');
    setCompletenessFilter('all');
    setExpiryFilter(false);
    setMissingGovFilter(false);
  };

  const filteredEmployees = useMemo(() => {
    return (employees || []).filter(emp => {
      if (!emp) return false;
      const q = searchTerm.trim().toLowerCase();

      if (q) {
        const fullName = `${emp.firstName || ''} ${emp.middleName || ''} ${emp.lastName || ''}`.toLowerCase();
        const reverseName = `${emp.lastName || ''} ${emp.firstName || ''}`.toLowerCase();
        const matchesSearch = [
          emp.empId,
          emp.firstName,
          emp.lastName,
          emp.middleName,
          emp.suffix,
          fullName,
          reverseName,
          emp.position,
          emp.department,
          emp.division,
          emp.locationBranch,
          emp.status,
          emp.classification,
          emp.mobileNumber,
          emp.personalEmail,
          emp.companyEmail,
          emp.email3,
          emp.bioId,
          emp.newBioId,
          emp.sss,
          emp.philhealth,
          emp.pagibig,
          emp.tin,
          emp.verifier,
          emp.bankAccountNumber
        ].some(field => (field || '').toString().toLowerCase().includes(q));

        if (!matchesSearch) return false;
      }

      if (statusFilter && emp.status !== statusFilter) return false;
      if (classFilter && emp.classification !== classFilter) return false;
      if (deptFilter && emp.department !== deptFilter) return false;

      // Completeness calculation
      const comp = calculate201Completeness(emp, requirements);
      if (completenessFilter === '100' && comp.percentage !== 100) return false;
      if (completenessFilter === '75-99' && (comp.percentage < 75 || comp.percentage >= 100)) return false;
      if (completenessFilter === '50-74' && (comp.percentage < 50 || comp.percentage >= 75)) return false;
      if (completenessFilter === 'under50' && comp.percentage >= 50) return false;

      // Expiry filter
      if (expiryFilter) {
        const empExpiries = checkDocumentExpiries([emp], requirements);
        if (empExpiries.length === 0) return false;
      }

      // Missing Government IDs filter
      if (missingGovFilter) {
        const missing = checkMissingGovIds(emp);
        if (missing.length === 0) return false;
      }

      return true;
    });
  }, [employees, requirements, searchTerm, statusFilter, classFilter, deptFilter, completenessFilter, expiryFilter, missingGovFilter]);

  const getDocProgress = (emp: Employee) => {
    const docs = emp.documents || {};
    const totalReqs = requirements.length || 6;
    const completed = Object.values(docs).filter(d => Boolean(d && (d.url || d.fileId || d.dataUrl))).length;
    const percent = totalReqs > 0 ? Math.round((completed / totalReqs) * 100) : 0;
    return { completed, total: totalReqs, percent };
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'EM';
  };

  const getAvatarBg = (str: string) => {
    const colors = isSeb
      ? ['bg-teal-600', 'bg-cyan-600', 'bg-emerald-600', 'bg-indigo-600', 'bg-purple-600']
      : ['bg-blue-600', 'bg-indigo-600', 'bg-sky-600', 'bg-purple-600', 'bg-violet-600'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Control Center Header & Search Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex flex-col gap-3.5">
        {/* Tier 1: Search Bar & Primary Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Main Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Name, Employee ID, Email, Position, Dept, Gov IDs, Bio ID..."
              className="w-full h-10 pl-10 pr-24 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none shadow-2xs"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-14 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {filteredEmployees.length} {filteredEmployees.length === 1 ? 'item' : 'items'}
              </span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="h-10 px-3.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Reset all active search and filter criteria"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            {onOpenGoogleSheets && (
              <button
                onClick={onOpenGoogleSheets}
                className="h-10 px-4 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 shadow-sm hover:shadow-md cursor-pointer shrink-0"
                title="Quick Google Sheet Sync & 23-Column Masterlist"
              >
                <FileSpreadsheet className="w-4 h-4 text-white" />
                <span>Google Sheet</span>
              </button>
            )}
          </div>
        </div>

        {/* Tier 2: Filter Grid */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-extrabold mr-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span>Filters:</span>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="RESIGNED">RESIGNED</option>
            <option value="SEPARATED">SEPARATED</option>
          </select>

          {/* Classification Filter */}
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="h-9 px-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
          >
            <option value="">All Classifications</option>
            <option value="Regular">Regular</option>
            <option value="Probationary">Probationary (6-mo)</option>
            <option value="Contractual">Contractual</option>
            <option value="Project-Based">Project-Based</option>
            <option value="Casual">Casual</option>
            <option value="Part-Time">Part-Time</option>
          </select>

          {/* Completeness Filter */}
          <select
            value={completenessFilter}
            onChange={(e) => setCompletenessFilter(e.target.value)}
            className="h-9 px-3 bg-white border border-teal-300 rounded-xl text-xs font-bold text-teal-800 bg-teal-50/50 outline-none focus:ring-1 focus:ring-teal-500 shadow-2xs"
            title="Advanced Filter by 201 File Completeness"
          >
            <option value="all">201 Completeness: All</option>
            <option value="100">🟢 Complete (100%)</option>
            <option value="75-99">🔵 High (75% - 99%)</option>
            <option value="50-74">🟡 Moderate (50% - 74%)</option>
            <option value="under50">🔴 Critical (&lt;50%)</option>
          </select>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="h-9 px-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Expiry Alerts Button Toggle */}
          <button
            onClick={() => setExpiryFilter(prev => !prev)}
            className={`h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border shadow-2xs ${
              expiryFilter
                ? 'bg-rose-600 text-white border-rose-700'
                : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50'
            }`}
            title="Filter employees with expired or expiring clearances"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{expiryFilter ? 'Showing Expiries' : 'Expiry Alerts'}</span>
          </button>

          {/* Missing Gov IDs Button Toggle */}
          <button
            onClick={() => setMissingGovFilter(prev => !prev)}
            className={`h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border shadow-2xs ${
              missingGovFilter
                ? 'bg-amber-600 text-white border-amber-700'
                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
            }`}
            title="Filter employees missing mandatory SSS, TIN, PhilHealth, or Pag-IBIG numbers"
          >
            <CreditCard className="w-3.5 h-3.5 shrink-0" />
            <span>{missingGovFilter ? 'Showing Missing IDs' : 'Missing Gov IDs'}</span>
          </button>
        </div>
      </div>

      {/* Symmetrical High-Precision Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4 w-28 text-left">EMP ID</th>
              <th className="py-3 px-3 w-14 text-center">PHOTO</th>
              <th className="py-3 px-4 min-w-[220px] text-left">EMPLOYEE NAME & CONTACT</th>
              <th className="py-3 px-4 min-w-[180px] text-left">POSITION & DEPT</th>
              <th className="py-3 px-4 w-32 text-center">STATUS</th>
              <th className="py-3 px-4 w-36 text-center">CLASSIFICATION</th>
              <th className="py-3 px-4 w-36 text-center">201 COMPLETION</th>
              <th className="py-3 px-4 w-44 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredEmployees.map(emp => {
              const { completed, total, percent } = getDocProgress(emp);
              const initials = getInitials(emp.firstName, emp.lastName);
              const bgClass = getAvatarBg(emp.lastName || 'emp');
              const missingGov = checkMissingGovIds(emp);
              const hasExpiries = checkDocumentExpiries([emp], requirements).length > 0;

              return (
                <tr
                  key={emp.id}
                  onClick={() => onViewEmployee(emp.id)}
                  className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                >
                  {/* EMP ID */}
                  <td className="py-3 px-4 font-mono font-bold text-blue-700 text-left align-middle">
                    {emp.empId || 'N/A'}
                  </td>

                  {/* Photo Avatar */}
                  <td className="py-3 px-3 text-center align-middle">
                    <div className="flex justify-center">
                      {emp.photoUrl ? (
                        <img
                          src={emp.photoUrl}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-2xs"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className={`w-8 h-8 rounded-full ${bgClass} text-white font-bold text-[10px] flex items-center justify-center shadow-2xs`}>
                          {initials}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Name & Contact */}
                  <td className="py-3 px-4 align-middle text-left">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                          {emp.lastName}, {emp.firstName} {emp.middleName ? `${emp.middleName[0]}.` : ''} {emp.suffix ? emp.suffix : ''}
                        </span>
                        {hasExpiries && (
                          <span className="p-0.5 bg-rose-100 text-rose-700 rounded-full" title="Expired or expiring document clearance alert!">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      {(emp.personalEmail || emp.companyEmail || emp.email3) && (
                        <span className="text-[11px] font-normal text-slate-500 flex items-center gap-1 font-mono">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[220px]" title={emp.personalEmail || emp.companyEmail || emp.email3}>
                            {emp.personalEmail || emp.companyEmail || emp.email3}
                          </span>
                        </span>
                      )}
                      {missingGov.length > 0 && (
                        <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300 w-fit mt-0.5" title={`Missing mandatory government IDs: ${missingGov.join(', ')}`}>
                          ⚠️ Missing {missingGov.join(', ')}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Position & Department */}
                  <td className="py-3 px-4 align-middle text-left">
                    <div className="flex flex-col gap-0.5">
                      <div className="font-semibold text-slate-800 flex items-center gap-1">
                        <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{emp.position || '—'}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{emp.department || '—'}</span>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4 align-middle text-center">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide inline-block ${
                        emp.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : emp.status === 'RESIGNED'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {emp.status || 'ACTIVE'}
                      </span>
                      {(emp.status === 'RESIGNED' || emp.status === 'SEPARATED' || Boolean(emp.separationDate)) && emp.lastPayAmount ? (
                        <span className="text-[9px] font-extrabold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                          ₱{Number(emp.lastPayAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      ) : null}
                    </div>
                  </td>

                  {/* Classification */}
                  <td className="py-3 px-4 align-middle text-center">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className={`px-2.5 py-0.5 rounded-md font-semibold text-[11px] inline-block ${
                        emp.classification === 'Probationary'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {emp.classification || 'Regular'}
                      </span>
                      {emp.classification === 'Probationary' && (() => {
                        const probStatus = getProbationaryStatus(emp);
                        if (!probStatus) return null;
                        const isOverdue = probStatus.daysRemaining <= 0;
                        const isUrgent = probStatus.daysRemaining <= 30;
                        return (
                          <span className={`text-[10px] font-mono font-bold flex items-center justify-center gap-1 ${
                            isOverdue ? 'text-rose-600' : isUrgent ? 'text-amber-600' : 'text-blue-600'
                          }`}>
                            <Clock className="w-3 h-3 shrink-0" />
                            {isOverdue ? '6-mo Overdue' : `${probStatus.daysRemaining}d left`}
                          </span>
                        );
                      })()}
                    </div>
                  </td>

                  {/* 201 Completion */}
                  <td className="py-3 px-4 align-middle text-center">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <div className="w-20 bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${percent === 100 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">
                        {completed}/{total} ({percent}%)
                      </span>
                    </div>
                  </td>

                  {/* Action Buttons */}
                  <td className="py-3 px-4 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onViewEmployee(emp.id)}
                        className="w-8 h-8 flex items-center justify-center text-blue-600 hover:bg-blue-100/70 rounded-lg transition-colors"
                        title="View Employee Profile"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          const permKey = `${company}_${emp.empId || emp.id}`;
                          const url = `${window.location.origin}${window.location.pathname}?verify=${encodeURIComponent(permKey)}`;
                          window.open(url, '_blank');
                        }}
                        className="w-8 h-8 flex items-center justify-center text-emerald-600 hover:bg-emerald-100/70 rounded-lg transition-colors"
                        title="Open Permanent Public Verification Portal"
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </button>

                      {onOpenIdCard && (
                        <button
                          onClick={() => onOpenIdCard(emp)}
                          className="w-8 h-8 flex items-center justify-center text-teal-600 hover:bg-teal-100/70 rounded-lg transition-colors"
                          title="View / Print Digital ID Badge"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => onPrintEmployee(emp.id)}
                        className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors"
                        title="Print 201 Record"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onEditEmployee(emp.id)}
                        className="w-8 h-8 flex items-center justify-center text-amber-600 hover:bg-amber-100/70 rounded-lg transition-colors"
                        title={userRole === 'admin' ? "Edit Employee" : "View / Edit Employee (Admin restricted)"}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onDeleteEmployee(emp.id)}
                        className="w-8 h-8 flex items-center justify-center text-rose-600 hover:bg-rose-100/70 rounded-lg transition-colors"
                        title={userRole === 'admin' ? "Delete Employee Record" : "Delete Employee Record (Admin required)"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredEmployees.length === 0 && (
          <div className="text-center p-12 text-slate-400">
            <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <h4 className="font-bold text-slate-700 text-sm mb-1">No employees match your search</h4>
            <p className="text-xs text-slate-500 mb-3">Try adjusting your keywords or clearing the active filters.</p>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer Summary Bar */}
      <div className="p-3.5 px-5 bg-slate-50/80 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <span>Showing <strong className="text-slate-800 font-bold">{filteredEmployees.length}</strong> of <strong className="text-slate-800 font-bold">{employees.length}</strong> employees</span>
          {hasActiveFilters && (
            <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-bold border border-blue-200">
              Filtered View
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleResetFilters}
            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
          >
            Reset to Show All
          </button>
        )}
      </div>
    </div>
  );
};

