import React, { useState, useMemo } from 'react';
import { CompanyKey, DocumentRequirement, Employee, UserRole } from '../types';
import { calculate201Completeness, getProbationaryStatus, checkDocumentExpiries, checkMissingGovIds } from '../lib/hrUtils';
import { Search, Eye, Edit3, Trash2, Printer, FileCheck, CreditCard, Clock, AlertTriangle, ShieldAlert, ShieldCheck, QrCode } from 'lucide-react';

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
  onOpenIdCard
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
      if (e && e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return (employees || []).filter(emp => {
      if (!emp) return false;
      const q = searchTerm.toLowerCase();
      const matchesSearch = !q || [
        emp.empId,
        emp.firstName,
        emp.lastName,
        emp.position,
        emp.department,
        emp.status,
        emp.classification,
        emp.mobileNumber
      ].some(field => (field || '').toLowerCase().includes(q));

      const matchesStatus = !statusFilter || emp.status === statusFilter;
      const matchesClass = !classFilter || emp.classification === classFilter;
      const matchesDept = !deptFilter || emp.department === deptFilter;

      // Completeness calculation
      const comp = calculate201Completeness(emp, requirements);
      let matchesCompleteness = true;
      if (completenessFilter === '100') {
        matchesCompleteness = comp.percentage === 100;
      } else if (completenessFilter === '75-99') {
        matchesCompleteness = comp.percentage >= 75 && comp.percentage < 100;
      } else if (completenessFilter === '50-74') {
        matchesCompleteness = comp.percentage >= 50 && comp.percentage < 75;
      } else if (completenessFilter === 'under50') {
        matchesCompleteness = comp.percentage < 50;
      }

      // Expiry filter
      let matchesExpiry = true;
      if (expiryFilter) {
        const empExpiries = checkDocumentExpiries([emp], requirements);
        matchesExpiry = empExpiries.length > 0;
      }

      // Missing Government IDs filter
      let matchesGov = true;
      if (missingGovFilter) {
        const missing = checkMissingGovIds(emp);
        matchesGov = missing.length > 0;
      }

      return matchesSearch && matchesStatus && matchesClass && matchesDept && matchesCompleteness && matchesExpiry && matchesGov;
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-50/50">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search name, ID, position, department..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="RESIGNED">RESIGNED</option>
            <option value="SEPARATED">SEPARATED</option>
          </select>

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="">All Classifications</option>
            <option value="Regular">Regular</option>
            <option value="Probationary">Probationary (6-Month Evaluation)</option>
            <option value="Contractual">Contractual</option>
            <option value="Project-Based">Project-Based</option>
            <option value="Casual">Casual</option>
            <option value="Part-Time">Part-Time</option>
          </select>

          <select
            value={completenessFilter}
            onChange={(e) => setCompletenessFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-teal-300 rounded-xl text-xs font-bold text-teal-800 bg-teal-50/50 outline-none"
            title="Advanced Filter by 201 File Completeness"
          >
            <option value="all">🔍 201 File Completeness: All</option>
            <option value="100">🟢 Complete 201 File (100%)</option>
            <option value="75-99">🔵 High Completeness (75% - 99%)</option>
            <option value="50-74">🟡 Moderate (50% - 74%)</option>
            <option value="under50">🔴 Missing Critical Docs (&lt;50%)</option>
          </select>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <button
            onClick={() => setExpiryFilter(prev => !prev)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border ${
              expiryFilter
                ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50'
            }`}
            title="Filter employees with expired or expiring clearances"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {expiryFilter ? 'Showing Expiry Alerts' : 'Filter Expiry Alerts'}
          </button>

          <button
            onClick={() => setMissingGovFilter(prev => !prev)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border ${
              missingGovFilter
                ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
            }`}
            title="Filter employees missing mandatory SSS, TIN, PhilHealth, or Pag-IBIG numbers"
          >
            <CreditCard className="w-3.5 h-3.5" />
            {missingGovFilter ? 'Showing Missing Gov IDs' : '⚠️ Missing Gov IDs'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3.5 px-4">EMP ID</th>
              <th className="py-3.5 px-4">PHOTO</th>
              <th className="py-3.5 px-4">NAME</th>
              <th className="py-3.5 px-4">POSITION</th>
              <th className="py-3.5 px-4">DEPARTMENT</th>
              <th className="py-3.5 px-4">STATUS</th>
              <th className="py-3.5 px-4">CLASS</th>
              <th className="py-3.5 px-4">DOCUMENTS</th>
              <th className="py-3.5 px-4 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredEmployees.map(emp => {
              const { completed, total, percent } = getDocProgress(emp);
              const initials = getInitials(emp.firstName, emp.lastName);
              const bgClass = getAvatarBg(emp.lastName || 'emp');
              const missingGov = checkMissingGovIds(emp);

              return (
                <tr
                  key={emp.id}
                  onClick={() => onViewEmployee(emp.id)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                >
                  <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{emp.empId || 'N/A'}</td>

                  <td className="py-3.5 px-4">
                    {emp.photoUrl ? (
                      <img
                        src={emp.photoUrl}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover border border-slate-200"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className={`w-8 h-8 rounded-full ${bgClass} text-white font-bold text-[10px] flex items-center justify-center`}>
                        {initials}
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-4 font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span>{emp.lastName}, {emp.firstName} {emp.middleName ? `${emp.middleName[0]}.` : ''} {emp.suffix ? emp.suffix : ''}</span>
                        {checkDocumentExpiries([emp], requirements).length > 0 && (
                          <span className="p-0.5 bg-rose-100 text-rose-700 rounded-full" title="Expired or expiring document clearance alert!">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      {missingGov.length > 0 && (
                        <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300 w-fit" title={`Missing mandatory government IDs: ${missingGov.join(', ')}`}>
                          ⚠️ Missing {missingGov.join(', ')}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-medium text-slate-700">{emp.position || '—'}</td>
                  <td className="py-3.5 px-4 text-slate-600">{emp.department || '—'}</td>

                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide w-fit ${
                        emp.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : emp.status === 'RESIGNED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {emp.status || 'ACTIVE'}
                      </span>
                      {(emp.status === 'RESIGNED' || emp.status === 'SEPARATED' || Boolean(emp.separationDate)) && emp.lastPayAmount ? (
                        <span className="text-[10px] font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 w-fit">
                          Last Pay: ₱{Number(emp.lastPayAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] w-fit ${
                        emp.classification === 'Probationary'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {emp.classification || 'Regular'}
                      </span>
                      {emp.classification === 'Probationary' && (() => {
                        const probStatus = getProbationaryStatus(emp);
                        if (!probStatus) return null;
                        const isOverdue = probStatus.daysRemaining <= 0;
                        const isUrgent = probStatus.daysRemaining <= 30;
                        return (
                          <span className={`text-[10px] font-mono font-bold flex items-center gap-1 ${
                            isOverdue ? 'text-rose-600' : isUrgent ? 'text-amber-600' : 'text-blue-600'
                          }`}>
                            <Clock className="w-3 h-3" />
                            {isOverdue ? '6-mo Overdue' : `${probStatus.daysRemaining}d to 6-mo`}
                          </span>
                        );
                      })()}
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
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

                  <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onViewEmployee(emp.id)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Open Permanent Public Verification Portal"
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </button>

                      {onOpenIdCard && (
                        <button
                          onClick={() => onOpenIdCard(emp)}
                          className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title="View / Print Digital ID Badge"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => onPrintEmployee(emp.id)}
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Print 201 Record"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onEditEmployee(emp.id)}
                        className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title={userRole === 'admin' ? "Edit Employee" : "View / Edit Employee (Admin restricted)"}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onDeleteEmployee(emp.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
            <h4 className="font-bold text-slate-700 text-sm mb-1">No employees found</h4>
            <p className="text-xs">Try clearing search filters or add a new employee.</p>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
        <span>Showing <strong>{filteredEmployees.length}</strong> of <strong>{employees.length}</strong> employees</span>
      </div>
    </div>
  );
};
