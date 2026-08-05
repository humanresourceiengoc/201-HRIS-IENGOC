import React, { useState } from 'react';
import { Employee, GovLoanRecord, UserRole } from '../types';
import { Landmark, Search, Filter, Plus, DollarSign, User, ArrowUpRight, X, Calendar } from 'lucide-react';

interface GovLoansViewProps {
  employees: Employee[];
  userRole?: UserRole;
  onViewEmployee: (employee: Employee) => void;
  onUpdateEmployee: (updated: Employee) => void;
}

export const GovLoansView: React.FC<GovLoansViewProps> = ({
  employees,
  userRole = 'admin',
  onViewEmployee,
  onUpdateEmployee
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [showLoanModal, setShowLoanModal] = useState<boolean>(false);
  const [selectedEmpId, setSelectedEmpId] = useState<string>(employees[0]?.id || '');
  const [form, setForm] = useState<{
    type: string;
    referenceNo: string;
    loanAmount: string;
    monthlyDeduction: string;
    startDate: string;
    status: 'ACTIVE' | 'FULLY_PAID' | 'ON_HOLD';
    remarks: string;
  }>({
    type: 'SSS Salary Loan',
    referenceNo: '',
    loanAmount: '25000',
    monthlyDeduction: '1800',
    startDate: new Date().toISOString().split('T')[0],
    status: 'ACTIVE',
    remarks: 'Salary deduction setup'
  });

  // Flat list of all gov loans across all employees
  const allLoansWithEmployee = employees.flatMap(emp =>
    (emp.govLoans || []).map(loan => ({
      ...loan,
      employee: emp
    }))
  ).sort((a, b) => b.startDate.localeCompare(a.startDate));

  const filteredLoans = allLoansWithEmployee.filter(item => {
    const matchesSearch =
      `${item.employee.firstName} ${item.employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.referenceNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.employee.id.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (filterType !== 'ALL' && item.type !== filterType) return false;
    return true;
  });

  const activeLoans = allLoansWithEmployee.filter(l => l.status === 'ACTIVE');
  const totalMonthlyDeductions = activeLoans.reduce((sum, l) => sum + (Number(l.monthlyDeduction) || 0), 0);
  const totalLoanAmount = allLoansWithEmployee.reduce((sum, l) => sum + (Number(l.loanAmount) || 0), 0);

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === selectedEmpId);
    if (!emp) return;

    const loanAmountNum = parseFloat(form.loanAmount) || 0;
    const monthlyDedNum = parseFloat(form.monthlyDeduction) || 0;

    if (monthlyDedNum <= 0) return;

    const newLoan: GovLoanRecord = {
      id: `loan_${Date.now()}`,
      type: form.type,
      referenceNo: form.referenceNo || `REF-${Math.floor(1000 + Math.random() * 9000)}`,
      loanAmount: loanAmountNum,
      monthlyDeduction: monthlyDedNum,
      startDate: form.startDate,
      status: form.status,
      remarks: form.remarks || 'Custom monthly deduction'
    };

    const updatedLoans = [newLoan, ...(emp.govLoans || [])];
    const updatedEmployee: Employee = {
      ...emp,
      govLoans: updatedLoans
    };

    onUpdateEmployee(updatedEmployee);
    setShowLoanModal(false);
    setForm({
      type: 'SSS Salary Loan',
      referenceNo: '',
      loanAmount: '25000',
      monthlyDeduction: '1800',
      startDate: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
      remarks: 'Salary deduction setup'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center font-bold shrink-0">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-900 text-xl tracking-tight">
              Gov Mandated Loans & Monthly Deductions
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Manage SSS, Pag-IBIG, Calamity, and Company loans with custom editable monthly salary deductions.
            </p>
          </div>
        </div>

        {userRole === 'admin' && (
          <button
            type="button"
            onClick={() => setShowLoanModal(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Gov Loan & Deduction
          </button>
        )}
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Government Loans</p>
          <p className="text-2xl font-black text-indigo-700 mt-1">{activeLoans.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Monthly Deductions</p>
          <p className="text-2xl font-black text-amber-600 mt-1">
            ₱{totalMonthlyDeductions.toLocaleString()} / mo
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Principal Loan Amount</p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            ₱{totalLoanAmount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full sm:w-80 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search employee, reference, or loan type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
          >
            <option value="ALL">All Loan Types</option>
            <option value="SSS Salary Loan">SSS Salary Loan</option>
            <option value="SSS Calamity Loan">SSS Calamity Loan</option>
            <option value="Pag-IBIG Multi-Purpose Loan (MPL)">Pag-IBIG Multi-Purpose Loan (MPL)</option>
            <option value="Pag-IBIG Calamity Loan">Pag-IBIG Calamity Loan</option>
            <option value="Company Salary Loan">Company Salary Loan</option>
            <option value="Emergency Loan">Emergency Loan</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredLoans.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Landmark className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="font-bold text-sm">No government loan deductions found</p>
            <p className="text-xs text-slate-400 mt-0.5">Try adjusting your filter or add a new loan deduction.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Loan Type</th>
                  <th className="py-3 px-4">Reference No.</th>
                  <th className="py-3 px-4">Loan Amount</th>
                  <th className="py-3 px-4">Custom Monthly Deduction</th>
                  <th className="py-3 px-4">Start Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Remarks</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLoans.map((item) => (
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
                    <td className="py-3 px-4 font-bold text-slate-900">{item.type}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{item.referenceNo || '—'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      ₱{Number(item.loanAmount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                        ₱{Number(item.monthlyDeduction || 0).toLocaleString()} / mo
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{item.startDate}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        item.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : item.status === 'FULLY_PAID'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{item.remarks || '—'}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onViewEmployee(item.employee)}
                        className="px-3 py-1 bg-slate-100 hover:bg-indigo-100 hover:text-indigo-800 text-slate-700 font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1"
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

      {/* Add Loan Modal */}
      {showLoanModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-indigo-600" />
                Add Gov Mandated Loan & Custom Deduction
              </h3>
              <button
                type="button"
                onClick={() => setShowLoanModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLoan} className="space-y-3 text-xs">
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

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Loan Type *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-semibold"
                >
                  <option value="SSS Salary Loan">SSS Salary Loan</option>
                  <option value="SSS Calamity Loan">SSS Calamity Loan</option>
                  <option value="Pag-IBIG Multi-Purpose Loan (MPL)">Pag-IBIG Multi-Purpose Loan (MPL)</option>
                  <option value="Pag-IBIG Calamity Loan">Pag-IBIG Calamity Loan</option>
                  <option value="Company Salary Loan">Company Salary Loan</option>
                  <option value="Emergency Loan">Emergency Loan</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Reference No.</label>
                  <input
                    type="text"
                    placeholder="e.g. SSS-SL-2026-889"
                    value={form.referenceNo}
                    onChange={(e) => setForm(prev => ({ ...prev, referenceNo: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Total Loan Amount (₱)</label>
                  <input
                    type="number"
                    placeholder="e.g. 25000"
                    value={form.loanAmount}
                    onChange={(e) => setForm(prev => ({ ...prev, loanAmount: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-amber-700 uppercase mb-1">Custom Monthly Deduction (₱) *</label>
                  <input
                    type="number"
                    placeholder="e.g. 1800"
                    value={form.monthlyDeduction}
                    onChange={(e) => setForm(prev => ({ ...prev, monthlyDeduction: e.target.value }))}
                    className="w-full px-3 py-2 border-2 border-amber-300 bg-amber-50/40 rounded-xl outline-none font-bold text-slate-900"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Custom editable monthly salary deduction</p>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-semibold"
                >
                  <option value="ACTIVE">ACTIVE (Deducting Monthly)</option>
                  <option value="ON_HOLD">ON HOLD</option>
                  <option value="FULLY_PAID">FULLY PAID</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. 24-month amortization setup"
                  value={form.remarks}
                  onChange={(e) => setForm(prev => ({ ...prev, remarks: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowLoanModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-indigo-700"
                >
                  Save Gov Loan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
