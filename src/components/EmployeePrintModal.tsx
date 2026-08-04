import React from 'react';
import { CompanyKey, DocumentRequirement, Employee } from '../types';
import { IenLogo, SebLogo } from './CompanyLogos';
import { Printer, X, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';

interface EmployeePrintModalProps {
  isOpen: boolean;
  company: CompanyKey;
  employee: Employee | null;
  requirements: DocumentRequirement[];
  onClose: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const EmployeePrintModal: React.FC<EmployeePrintModalProps> = ({
  isOpen,
  company,
  employee,
  requirements,
  onClose,
  onToast
}) => {
  if (!isOpen || !employee) return null;

  const isSeb = company === 'seb';
  const companyFullName = isSeb ? 'SEB Equipment and Supply Corp' : 'Integrated and effective navigation Consultancy Corp';
  const companyAddress = '3 M. Vicente St. Brgy Malamig Mandaluyong City';
  const companyTin = isSeb ? '607 097 263 00000' : '601 157 401 00000';

  const docs = employee.documents || {};

  const handlePrintDocument = () => {
    try {
      window.print();
    } catch (err) {
      console.error('Print failed:', err);
      onToast('Error initiating print dialog. Please use standard Ctrl+P / Cmd+P shortcut.', 'error');
    }
  };

  const handleOpenPrintWindow = () => {
    const sheetEl = document.querySelector('.print-document-sheet');
    if (!sheetEl) return;
    const printWin = window.open('', '_blank', 'width=900,height=1000');
    if (!printWin) {
      onToast('Popup blocked! Please allow popups for this site or press Ctrl+P.', 'warning');
      return;
    }
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${employee.lastName}, ${employee.firstName} - 201 Record</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body class="bg-white p-8 font-sans text-slate-900">
          ${sheetEl.innerHTML}
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex justify-center p-4 print:p-0 print:bg-white print:block print:static print:z-auto">
      <div className="max-w-4xl w-full my-6 print:m-0 print:w-full print:max-w-none">
        {/* Screen-Only Toolbar Bar */}
        <div className="no-print bg-slate-800 text-white rounded-xl p-4 mb-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-lg">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base text-white">
                201 Employee Record Sheet — Print & PDF Preview
              </h2>
              <p className="text-xs text-slate-300">
                {employee.lastName}, {employee.firstName} ({employee.empId || 'N/A'}) • {companyFullName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintDocument}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all cursor-pointer"
              title="Print directly or save as PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPrintWindow}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              title="Open standalone print window (use if iframe blocks direct print)"
            >
              <span>Pop-out Window</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable 201 Document Sheet */}
        <div className="print-document-sheet bg-white text-slate-900 font-sans leading-relaxed p-8 rounded-2xl shadow-2xl border border-slate-200 print:border-none print:shadow-none print:rounded-none print:p-4 print:m-0">
          {/* Print Header */}
          <div className="text-center pb-4 mb-6 border-b-2 border-slate-900 relative">
            <div className="absolute left-0 top-0 w-12 h-12 flex items-center justify-center">
              {isSeb ? <SebLogo size={44} /> : <IenLogo size={44} />}
            </div>
            <h1 className="text-xl font-black uppercase tracking-wider pl-12">{companyFullName}</h1>
            <p className="text-xs font-semibold text-slate-700 mt-0.5 pl-12">
              {companyAddress} • TIN: {companyTin}
            </p>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              Employee 201 Personal Record & File Document Verification
            </p>
          </div>

          {/* Basic Grid */}
          <div className="flex gap-6 mb-6">
            {employee.photoUrl && (
              <img src={employee.photoUrl} alt="" className="w-28 h-28 object-cover rounded-xl border border-slate-300" />
            )}
            <div className="flex-1 grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Employee ID</span>
                <span className="font-bold font-mono text-blue-800">{employee.empId || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Full Name</span>
                <span className="font-bold">{employee.lastName}, {employee.firstName} {employee.middleName || ''} {employee.suffix || ''}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Department</span>
                <span className="font-semibold">{employee.department || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Position</span>
                <span className="font-semibold">{employee.position || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Date Hired</span>
                <span className="font-semibold">{employee.dateHired || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Status / Class</span>
                <span className="font-semibold">{employee.status} ({employee.classification})</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Monthly Basic Salary</span>
                <span className="font-bold text-emerald-800">₱{(employee.monthlySalary || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Employment & Organizational Assignment */}
          <div className="mb-6 space-y-2 text-xs">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b pb-1">Employment & Organizational Assignment</h3>
            <div className="grid grid-cols-3 gap-3">
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Division / Business Unit</span>{employee.division || '—'}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Location / Branch</span>{employee.locationBranch || 'Mandaluyong'} {employee.branchCode ? `(${employee.branchCode})` : ''}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Immediate Supervisor</span>{employee.immediateSupervisor || '—'}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Category / Grade</span>{employee.employeeCategory || '—'} {employee.jobLevel ? `(${employee.jobLevel})` : ''}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Work Location Type</span>{employee.workLocationType || 'Office'}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Employment Type</span>{employee.employmentType || 'Full-Time'}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Regularization Date</span>{employee.dateOfRegularization || employee.regularizationDate || '—'} ({employee.regularizationStatus || 'Regularized'})</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Probation Period</span>{employee.probationStartDate || '—'} to {employee.probationEndDate || '—'}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Cost Center</span>{employee.costCenter || '—'}</div>
            </div>
          </div>

          {/* Personal Info */}
          <div className="mb-6 space-y-2 text-xs">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b pb-1">Personal Details</h3>
            <div className="grid grid-cols-3 gap-3">
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Current Address</span>{employee.currentAddress || '—'}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Birthdate / Age</span>{employee.birthdate} ({employee.age || '—'} yrs)</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Civil Status / Gender</span>{employee.civilStatus} / {employee.gender}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Mobile Number</span>{employee.mobileNumber || '—'}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Personal Email</span>{employee.personalEmail || '—'}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Company Email</span>{employee.companyEmail || '—'}</div>
            </div>
          </div>

          {/* Government IDs & Bank Accounts */}
          <div className="mb-6 space-y-2 text-xs">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b pb-1">Government Accounts, Payroll Bank & Benefits</h3>
            <div className="grid grid-cols-4 gap-3 font-mono">
              <div><span className="block text-[10px] font-sans text-slate-500 font-bold uppercase">SSS Number</span>{employee.sss || '—'}</div>
              <div><span className="block text-[10px] font-sans text-slate-500 font-bold uppercase">PAG-IBIG MID</span>{employee.pagibig || '—'}</div>
              <div><span className="block text-[10px] font-sans text-slate-500 font-bold uppercase">PhilHealth No.</span>{employee.philhealth || '—'}</div>
              <div><span className="block text-[10px] font-sans text-slate-500 font-bold uppercase">TIN</span>{employee.tin || '—'}</div>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Payroll Bank & Account No.</span>{employee.bankName || 'BDO'} - <span className="font-mono font-bold">{employee.bankAccountNumber || '—'}</span></div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Bank Account Name</span>{employee.bankAccountName || `${employee.firstName} ${employee.lastName}`}</div>
              <div>
                <span className="block text-[10px] text-slate-500 font-bold uppercase">HMO Healthcare & Medical Benefits</span>
                {employee.hmoProvider || employee.hmoCardNumber ? (
                  <span className="font-semibold">{employee.hmoProvider || 'HMO'} {employee.hmoCardNumber ? `(${employee.hmoCardNumber})` : ''} — {employee.hmoCoverage || employee.hmoDetails || 'Active Coverage'}</span>
                ) : (
                  <span>{employee.hmoDetails || 'Enrolled Healthcare Coverage'}</span>
                )}
              </div>
            </div>
          </div>

          {/* Active Government Loans (if present) */}
          {employee.govLoans && employee.govLoans.length > 0 && (
            <div className="mb-6 space-y-2 text-xs">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b pb-1">Active Government & Company Loans</h3>
              <table className="w-full text-left text-[11px] border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b">
                    <th className="p-1.5 font-bold">Loan Type & Ref #</th>
                    <th className="p-1.5 font-bold">Principal Amount</th>
                    <th className="p-1.5 font-bold">Monthly Deduction</th>
                    <th className="p-1.5 font-bold">Start - End Date</th>
                    <th className="p-1.5 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.govLoans.map(loan => (
                    <tr key={loan.id} className="border-b">
                      <td className="p-1.5">
                        <div className="font-bold">{loan.type}</div>
                        <div className="text-[10px] text-slate-500 font-mono">Ref: {loan.referenceNo || 'N/A'}</div>
                      </td>
                      <td className="p-1.5 font-mono">₱{Number(loan.loanAmount || 0).toLocaleString()}</td>
                      <td className="p-1.5 font-mono font-bold text-rose-700">₱{Number(loan.monthlyDeduction || 0).toLocaleString()}</td>
                      <td className="p-1.5 whitespace-nowrap">{loan.startDate} to {loan.endDate || 'Active'}</td>
                      <td className="p-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          {loan.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Emergency Contact */}
          <div className="mb-6 space-y-2 text-xs">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b pb-1">Emergency Contact</h3>
            <div className="grid grid-cols-3 gap-3">
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Contact Person</span>{employee.emergencyName || '—'}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Relationship</span>{employee.emergencyRelation || '—'}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Mobile Number</span>{employee.emergencyContact || '—'}</div>
            </div>
            <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Emergency Address / Location</span>{employee.emergencyAddress || '—'}</div>
          </div>

          {/* Family Background Information */}
          <div className="mb-6 space-y-2 text-xs">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b pb-1">Family Background Information</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Mother&apos;s Maiden Name</span>{employee.motherMaidenName || '—'}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Mother&apos;s Occupation</span>{employee.motherOccupation || '—'}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Father&apos;s Name</span>{employee.fatherName || '—'}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Father&apos;s Occupation</span>{employee.fatherOccupation || '—'}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Spouse Name (If Married)</span>{employee.spouseName || '—'}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Occupation of Spouse</span>{employee.spouseOccupation || '—'}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Number of Children</span>{employee.numberOfChildren ?? employee.numChildren ?? '—'}</div>
              <div><span className="block text-[10px] text-slate-500 font-bold uppercase">Date of Birth of Child(ren)</span>{employee.childBirthDates || employee.childBirthdates || '—'}</div>
              <div className="col-span-2 sm:col-span-4"><span className="block text-[10px] text-slate-500 font-bold uppercase">Name(s) of Child</span>{employee.childNames || '—'}</div>
            </div>
          </div>

          {/* Work Experience / Career History (if present) */}
          {employee.workExperience && employee.workExperience.length > 0 && (
            <div className="mb-6 space-y-2 text-xs">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b pb-1">Previous Work Experience & Employment History</h3>
              <table className="w-full text-left text-[11px] border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b">
                    <th className="p-1.5 font-bold">Company & Position</th>
                    <th className="p-1.5 font-bold">Duration</th>
                    <th className="p-1.5 font-bold">Department / Industry</th>
                    <th className="p-1.5 font-bold">Responsibilities</th>
                    <th className="p-1.5 font-bold">Salary & Reason for Leaving</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.workExperience.map(exp => (
                    <tr key={exp.id} className="border-b">
                      <td className="p-1.5">
                        <div className="font-bold">{exp.companyName}</div>
                        <div className="text-blue-700">{exp.position}</div>
                      </td>
                      <td className="p-1.5 whitespace-nowrap">{exp.startDate} — {exp.isCurrent ? 'Present' : (exp.endDate || '—')}</td>
                      <td className="p-1.5">{exp.departmentOrIndustry || '—'}</td>
                      <td className="p-1.5">{exp.responsibilities || '—'}</td>
                      <td className="p-1.5">
                        <div className="font-mono">{exp.salary || '—'}</div>
                        <div className="text-[10px] text-slate-500">{exp.reasonForLeaving || '—'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Salary Adjustments History (if present) */}
          {employee.salaryHistory && employee.salaryHistory.length > 0 && (
            <div className="mb-6 space-y-2 text-xs">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b pb-1">Salary Adjustment & Increase Log</h3>
              <table className="w-full text-left text-[11px] border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b">
                    <th className="p-1.5 font-bold">Effective Date</th>
                    <th className="p-1.5 font-bold">Previous Salary</th>
                    <th className="p-1.5 font-bold">New Salary</th>
                    <th className="p-1.5 font-bold">Reason</th>
                    <th className="p-1.5 font-bold">Approved By</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.salaryHistory.map(sal => (
                    <tr key={sal.id} className="border-b">
                      <td className="p-1.5">{sal.effectiveDate}</td>
                      <td className="p-1.5 font-mono">₱{Number(sal.previousSalary || 0).toLocaleString()}</td>
                      <td className="p-1.5 font-mono font-bold text-emerald-800">₱{Number(sal.newSalary || 0).toLocaleString()}</td>
                      <td className="p-1.5">{sal.reason}</td>
                      <td className="p-1.5">{sal.approvedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Issued Memos (if present) */}
          {employee.memos && employee.memos.length > 0 && (
            <div className="mb-6 space-y-2 text-xs">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b pb-1">Individual Memos & HR Notices</h3>
              <div className="space-y-1.5">
                {employee.memos.map(m => (
                  <div key={m.id} className="p-2 border border-slate-200 rounded">
                    <div className="flex justify-between font-bold text-[11px]">
                      <span>{m.memoNo} - {m.title} ({m.type})</span>
                      <span className="text-slate-500">{m.dateIssued}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5">{m.details}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document Requirements Status */}
          <div className="space-y-2 text-xs">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b pb-1">201 Document Status</h3>
            <div className="grid grid-cols-2 gap-2">
              {requirements.map(req => {
                const doc = docs[req.id];
                const hasFile = Boolean(doc && (doc.url || doc.fileId));
                const expiry = employee.docExpiries?.[req.id];

                return (
                  <div key={req.id} className="p-2 border rounded border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="font-semibold block">{req.name}</span>
                      {expiry && <span className="text-[9px] text-slate-500">Expires: {expiry}</span>}
                    </div>
                    <span className={`font-bold text-[10px] uppercase ${hasFile ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {hasFile ? `Complete (${doc.filename || 'Uploaded'})` : 'Pending'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Signature & HR Verification Block */}
          <div className="mt-8 pt-4 border-t-2 border-slate-900 space-y-4">
            <div className="grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                {employee.employeeSignatureUrl ? (
                  <img src={employee.employeeSignatureUrl} alt="Signature" className="h-10 mx-auto object-contain mb-1" />
                ) : (
                  <div className="h-10 border-b border-slate-700"></div>
                )}
                <span className="block font-bold uppercase text-slate-800 text-[11px]">{employee.firstName} {employee.middleName || ''} {employee.lastName} {employee.suffix || ''}</span>
                <span className="block text-[9.5px] font-semibold text-slate-500 uppercase">Employee Signature</span>
              </div>

              <div>
                <div className="h-10 border-b border-slate-700"></div>
                <span className="block font-bold uppercase text-slate-800 text-[11px]">HR Department Manager / Custodian</span>
                <span className="block text-[9.5px] font-semibold text-slate-500 uppercase">201 Record Verified & Approved</span>
              </div>
            </div>
          </div>

          {/* Footer stamp */}
          <div className="mt-12 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
            Printed on {new Date().toLocaleDateString('en-US', { dateStyle: 'full' })} • Confidential HR 201 File
          </div>
        </div>
      </div>
    </div>
  );
};
