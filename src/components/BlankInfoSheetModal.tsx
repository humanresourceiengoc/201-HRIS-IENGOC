import React from 'react';
import { CompanyKey } from '../types';
import { IenLogo, SebLogo } from './CompanyLogos';
import { Printer, X, FileText, CheckSquare, ShieldCheck, ExternalLink } from 'lucide-react';

interface BlankInfoSheetModalProps {
  company: CompanyKey;
  isOpen: boolean;
  onClose: () => void;
}

export const BlankInfoSheetModal: React.FC<BlankInfoSheetModalProps> = ({ company, isOpen, onClose }) => {
  const printRef = React.useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const isSeb = company === 'seb';
  const companyFullName = isSeb ? 'SEB Equipment and Supply Corp.' : 'Integrated and Effective Navigation Consultancy Corp.';
  const companyAddress = '3 M. Vicente St., Brgy. Malamig, Mandaluyong City, Metro Manila';
  const companyTin = isSeb ? '607-097-263-00000' : '601-157-401-00000';

  const handleOpenNewTab = () => {
    try {
      const printEl = printRef.current;
      if (printEl) {
        const contentHtml = printEl.innerHTML;
        const printWin = window.open('', '_blank');
        if (printWin) {
          printWin.document.write(`
            <!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="UTF-8">
                <title>HR 201 Blank Form - ${companyFullName}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                  @page { size: A4 portrait; margin: 4mm 5mm; }
                  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; padding: 16px; margin: 0; }
                  @media print {
                    .no-print-bar { display: none !important; }
                    body { background: #ffffff !important; padding: 0 !important; }
                  }
                </style>
              </head>
              <body>
                <div class="no-print-bar max-w-4xl mx-auto mb-4 p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between shadow-lg border border-slate-800">
                  <div>
                    <h3 class="font-extrabold text-sm text-blue-400">HR 201 Personnel Form Ready to Print</h3>
                    <p class="text-xs text-slate-300">Click &quot;Print Form Now&quot; below or press <strong>Ctrl + P</strong> on your keyboard.</p>
                  </div>
                  <button onclick="window.print()" style="background:#2563eb;color:#ffffff;font-weight:800;padding:8px 18px;border-radius:10px;border:none;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:6px;">
                    🖨️ Print Form Now
                  </button>
                </div>
                <div class="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  ${contentHtml}
                </div>
                <script>
                  window.addEventListener('load', () => {
                    setTimeout(() => { window.print(); }, 300);
                  });
                </script>
              </body>
            </html>
          `);
          printWin.document.close();
        }
      }
    } catch (e) {
      console.error('Error opening print window:', e);
    }
  };

  const handlePrint = () => {
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.error('Print trigger error:', e);
    }
    handleOpenNewTab();
  };

  return (
    <>
      {/* Screen Modal Preview */}
      <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:hidden">
        <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh] sm:max-h-[95vh]">
          {/* Modal Header */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider">
                  Blank 201 Employee Information Sheet
                </h3>
                <p className="text-xs text-slate-300">
                  Official Complete HR Personnel Form ({isSeb ? 'SEB Corp' : 'IEN Corp'})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePrint();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer relative z-10"
                title="Trigger print or open printable page"
              >
                <Printer className="w-4 h-4" />
                <span>Print Form</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOpenNewTab();
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Open clean printable document in a new tab"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">Open in New Tab</span>
              </button>

              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form Scrollable Content Preview */}
          <div className="p-4 sm:p-8 overflow-y-auto bg-slate-100 flex justify-center flex-1">
            <div className="bg-white p-6 sm:p-10 rounded-2xl shadow-lg border border-slate-300 w-full max-w-3xl text-slate-900 font-sans text-xs space-y-6">
              
              {/* Form Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 flex items-center justify-center shrink-0">
                    {isSeb ? <SebLogo size={56} /> : <IenLogo size={56} />}
                  </div>
                  <div>
                    <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">{companyFullName}</h1>
                    <p className="text-[11px] font-bold text-slate-600">{companyAddress}</p>
                    <p className="text-[10px] font-mono text-slate-500">TIN: {companyTin}</p>
                    <span className="inline-block mt-1 text-[11px] font-black uppercase text-blue-900 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded">
                      HR 201 EMPLOYEE PERSONAL DATA SHEET
                    </span>
                  </div>
                </div>

                {/* 2x2 Photo Box Placeholder */}
                <div className="w-24 h-24 border-2 border-dashed border-slate-400 rounded-lg flex flex-col items-center justify-center text-center p-1 bg-slate-50 shrink-0">
                  <span className="text-[9px] font-extrabold uppercase text-slate-500 leading-tight">Attach Recent</span>
                  <span className="text-[10px] font-black text-slate-700">2x2 Photo</span>
                  <span className="text-[8px] text-slate-400 mt-1">(White Backgnd)</span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[11px] text-amber-900 font-medium">
                <strong>INSTRUCTIONS:</strong> Please complete all sections clearly and legibly in <u>BLOCK CAPITAL LETTERS</u>. Mark <strong>N/A</strong> for non-applicable fields. This document forms an essential part of your official HR 201 Personnel File.
              </div>

              {/* SECTION I: PERSONAL INFORMATION */}
              <div className="space-y-3">
                <h2 className="text-xs font-black uppercase tracking-wider bg-slate-900 text-white px-3 py-1 rounded">
                  I. PERSONAL INFORMATION
                </h2>

                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-1 border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Surname / Last Name *</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="col-span-1 border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">First Name *</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="col-span-1 border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Middle Name</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="col-span-1 border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Suffix (Jr, Sr) / Nickname</span>
                    <div className="h-4"></div>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-3 border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Date of Birth (MM/DD/YYYY) *</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="col-span-3 border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Place of Birth</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="col-span-2 border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Gender *</span>
                    <div className="min-h-5 text-[9.5px] text-slate-700 font-medium pt-0.5">[ ] M  [ ] F</div>
                  </div>
                  <div className="col-span-4 border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Civil Status *</span>
                    <div className="min-h-5 text-[8.5px] text-slate-700 font-medium flex flex-wrap gap-x-1.5 pt-0.5">
                      <span>[ ] Single</span>
                      <span>[ ] Married</span>
                      <span>[ ] Widowed</span>
                      <span>[ ] Separated</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Religion</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Citizenship / Nationality</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Blood Type</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Height / Weight</span>
                    <div className="h-4"></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Permanent Home Address *</span>
                    <div className="h-5"></div>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Present / Residential Address *</span>
                    <div className="h-5"></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Mobile Contact Number(s) *</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Personal Email Address *</span>
                    <div className="h-4"></div>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="border-b border-slate-400 pb-1">
                      <span className="block text-[9px] font-bold text-slate-700 uppercase">Emergency Contact Person *</span>
                      <div className="h-4"></div>
                    </div>
                    <div className="border-b border-slate-400 pb-1">
                      <span className="block text-[9px] font-bold text-slate-700 uppercase">Relationship *</span>
                      <div className="h-4"></div>
                    </div>
                    <div className="border-b border-slate-400 pb-1">
                      <span className="block text-[9px] font-bold text-slate-700 uppercase">Contact No. *</span>
                      <div className="h-4"></div>
                    </div>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-700 uppercase">Emergency Contact Complete Address / Location *</span>
                    <div className="h-5"></div>
                  </div>
                </div>
              </div>

              {/* SECTION II: MANDATORY GOVERNMENT NUMBERS & PAYROLL BANK */}
              <div className="space-y-3">
                <h2 className="text-xs font-black uppercase tracking-wider bg-slate-900 text-white px-3 py-1 rounded">
                  II. MANDATORY GOVERNMENT NUMBERS & PAYROLL BANK DETAILS
                </h2>

                <div className="grid grid-cols-4 gap-3">
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">SSS Number *</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">TIN (Tax Identification No.) *</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">PhilHealth Number *</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">PAG-IBIG (HDMF) MID *</span>
                    <div className="h-4"></div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Payroll Bank Name (e.g., BDO, BPI)</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Payroll Account Number</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Account Name as Registered</span>
                    <div className="h-4"></div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-200">
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-emerald-800 uppercase">HMO / Medical Provider (Maxicare / Intellicare)</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-emerald-800 uppercase">HMO Card / Member ID No.</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-emerald-800 uppercase">HMO Plan / Dependents Coverage</span>
                    <div className="h-4"></div>
                  </div>
                </div>
              </div>

              {/* SECTION III: HR EMPLOYMENT ASSIGNMENT (HR / APPLICANT) */}
              <div className="space-y-3">
                <h2 className="text-xs font-black uppercase tracking-wider bg-slate-900 text-white px-3 py-1 rounded">
                  III. POSITION & EMPLOYMENT ASSIGNMENT
                </h2>

                <div className="grid grid-cols-4 gap-3">
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Position Applied For / Title</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Department / Division</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Work Location / Branch</span>
                    <div className="h-4 text-[9px] text-slate-600">[ ] Mandaluyong  [ ] Legazpi, Albay</div>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Target Start Date</span>
                    <div className="h-4"></div>
                  </div>
                </div>
              </div>

              {/* SECTION IV: EDUCATIONAL BACKGROUND */}
              <div className="space-y-3">
                <h2 className="text-xs font-black uppercase tracking-wider bg-slate-900 text-white px-3 py-1 rounded">
                  IV. EDUCATIONAL ATTAINMENT
                </h2>

                <table className="w-full text-left border border-slate-300 text-[10px]">
                  <thead>
                    <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                      <th className="p-1.5 border-r border-slate-300">Level</th>
                      <th className="p-1.5 border-r border-slate-300">Name of School / University</th>
                      <th className="p-1.5 border-r border-slate-300">Degree / Course Completed</th>
                      <th className="p-1.5 border-r border-slate-300">Year Graduated</th>
                      <th className="p-1.5">Honors / Academic Awards</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 font-bold border-r border-slate-200">Elementary</td>
                      <td className="p-1.5 border-r border-slate-200"></td>
                      <td className="p-1.5 border-r border-slate-200"></td>
                      <td className="p-1.5 border-r border-slate-200"></td>
                      <td className="p-1.5"></td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 font-bold border-r border-slate-200">High School / SHS</td>
                      <td className="p-1.5 border-r border-slate-200"></td>
                      <td className="p-1.5 border-r border-slate-200"></td>
                      <td className="p-1.5 border-r border-slate-200"></td>
                      <td className="p-1.5"></td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 font-bold border-r border-slate-200">College / Vocational</td>
                      <td className="p-1.5 border-r border-slate-200"></td>
                      <td className="p-1.5 border-r border-slate-200"></td>
                      <td className="p-1.5 border-r border-slate-200"></td>
                      <td className="p-1.5"></td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 font-bold border-r border-slate-200">Post Graduate / Others</td>
                      <td className="p-1.5 border-r border-slate-200"></td>
                      <td className="p-1.5 border-r border-slate-200"></td>
                      <td className="p-1.5 border-r border-slate-200"></td>
                      <td className="p-1.5"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* SECTION V: FAMILY BACKGROUND & DEPENDENTS */}
              <div className="space-y-3">
                <h2 className="text-xs font-black uppercase tracking-wider bg-slate-900 text-white px-3 py-1 rounded">
                  V. FAMILY BACKGROUND & DEPENDENTS
                </h2>

                <div className="grid grid-cols-2 gap-3">
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Father&apos;s Full Name</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Father&apos;s Occupation / Employer</span>
                    <div className="h-4"></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Mother&apos;s Maiden Full Name</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Mother&apos;s Occupation / Employer</span>
                    <div className="h-4"></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Spouse&apos;s Name (if married)</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Spouse Occupation & Employer</span>
                    <div className="h-4"></div>
                  </div>
                </div>

                <div>
                  <span className="block text-[9px] font-bold text-slate-700 uppercase mb-1">Names of Dependent Children / Qualified Beneficiaries:</span>
                  <table className="w-full text-left border border-slate-300 text-[10px]">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-slate-300">
                        <th className="p-1 border-r border-slate-300 w-8 text-center">#</th>
                        <th className="p-1 border-r border-slate-300">Full Name of Child / Dependent</th>
                        <th className="p-1 border-r border-slate-300">Date of Birth (MM/DD/YYYY)</th>
                        <th className="p-1 border-r border-slate-300">Gender</th>
                        <th className="p-1">Relationship</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4].map(idx => (
                        <tr key={idx} className="border-b border-slate-200">
                          <td className="p-1 font-bold border-r border-slate-200 text-center">{idx}</td>
                          <td className="p-1 border-r border-slate-200 h-5"></td>
                          <td className="p-1 border-r border-slate-200 h-5"></td>
                          <td className="p-1 border-r border-slate-200 h-5"></td>
                          <td className="p-1 h-5"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION VI: EMPLOYMENT HISTORY */}
              <div className="space-y-3">
                <h2 className="text-xs font-black uppercase tracking-wider bg-slate-900 text-white px-3 py-1 rounded">
                  VI. PREVIOUS EMPLOYMENT HISTORY (Most Recent First)
                </h2>

                <table className="w-full text-left border border-slate-300 text-[10px]">
                  <thead>
                    <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                      <th className="p-1.5 border-r border-slate-300">Company Name & Address</th>
                      <th className="p-1.5 border-r border-slate-300">Position Held</th>
                      <th className="p-1.5 border-r border-slate-300">Inclusive Dates (From - To)</th>
                      <th className="p-1.5 border-r border-slate-300">Monthly Salary</th>
                      <th className="p-1.5">Reason for Leaving</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map(row => (
                      <tr key={row} className="border-b border-slate-200">
                        <td className="p-1.5 border-r border-slate-200 h-7"></td>
                        <td className="p-1.5 border-r border-slate-200 h-7"></td>
                        <td className="p-1.5 border-r border-slate-200 h-7"></td>
                        <td className="p-1.5 border-r border-slate-200 h-7"></td>
                        <td className="p-1.5 h-7"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* SECTION VII: CHARACTER REFERENCES */}
              <div className="space-y-3">
                <h2 className="text-xs font-black uppercase tracking-wider bg-slate-900 text-white px-3 py-1 rounded">
                  VII. CHARACTER REFERENCES (3 Professional / Personal References - Not Related By Blood)
                </h2>

                <table className="w-full text-left border border-slate-300 text-[10px]">
                  <thead>
                    <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                      <th className="p-1.5 border-r border-slate-300">Full Name</th>
                      <th className="p-1.5 border-r border-slate-300">Company Name & Occupation / Position</th>
                      <th className="p-1.5 border-r border-slate-300">Contact Number / Email</th>
                      <th className="p-1.5">Years Known</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map(row => (
                      <tr key={row} className="border-b border-slate-200">
                        <td className="p-1.5 border-r border-slate-200 h-6"></td>
                        <td className="p-1.5 border-r border-slate-200 h-6"></td>
                        <td className="p-1.5 border-r border-slate-200 h-6"></td>
                        <td className="p-1.5 h-6"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* SECTION VIII: MANDATORY 201 REQUIREMENTS CHECKLIST */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-300">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-blue-700" />
                  <span>VIII. MANDATORY HR 201 DOCUMENT SUBMISSION CHECKLIST</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] font-semibold text-slate-800">
                  <div className="flex items-center gap-1.5">[  ] PSA Birth Certificate</div>
                  <div className="flex items-center gap-1.5">[  ] PSA Marriage Certificate</div>
                  <div className="flex items-center gap-1.5">[  ] NBI / Police Clearance</div>
                  <div className="flex items-center gap-1.5">[  ] SSS E-1 / Verification / Card</div>
                  <div className="flex items-center gap-1.5">[  ] BIR Form 1902 / 2316</div>
                  <div className="flex items-center gap-1.5">[  ] PhilHealth MDR / ID</div>
                  <div className="flex items-center gap-1.5">[  ] Pag-IBIG Member Data Form</div>
                  <div className="flex items-center gap-1.5">[  ] Medical / Drug Test Cert.</div>
                  <div className="flex items-center gap-1.5">[  ] Diploma / Transcript (TOR)</div>
                  <div className="flex items-center gap-1.5">[  ] 2x2 Recent ID Pictures (2 pcs)</div>
                  <div className="flex items-center gap-1.5">[  ] COE / Resignation Clearance</div>
                  <div className="flex items-center gap-1.5">[  ] Government Issued ID Copy</div>
                </div>
              </div>

              {/* SECTION IX: UNDERTAKING, DATA PRIVACY CONSENT & SIGNATURE */}
              <div className="space-y-4 pt-3 border-t-2 border-slate-900">
                <div className="flex items-start gap-2 bg-blue-50/80 p-3 rounded-lg border border-blue-200 text-[9.5px] leading-relaxed text-slate-800">
                  <ShieldCheck className="w-4 h-4 text-blue-800 shrink-0 mt-0.5" />
                  <div>
                    <strong>DATA PRIVACY CONSENT & UNDERTAKING:</strong> I hereby certify that all information supplied in this 201 Personnel Data Sheet is true, correct, and complete to the best of my knowledge and belief. I understand that any false, misleading, or fraudulent statement made herein shall constitute sufficient ground for disqualification or immediate termination of employment. Pursuant to the <em>Philippine Data Privacy Act of 2012 (RA 10173)</em>, I authorize <strong>{companyFullName}</strong> to collect, store, and process my personal data for legitimate human resource, payroll, background verification, and regulatory compliance purposes.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-6">
                  <div className="text-center">
                    <div className="border-b-2 border-slate-800 h-8"></div>
                    <span className="block text-[10px] font-black uppercase text-slate-800 mt-1">Employee Signature Over Printed Name</span>
                  </div>

                  <div className="text-center">
                    <div className="border-b-2 border-slate-800 h-8"></div>
                    <span className="block text-[10px] font-black uppercase text-slate-800 mt-1">Date Signed (MM/DD/YYYY)</span>
                  </div>
                </div>

                <div className="bg-slate-100 p-3 rounded-lg border border-slate-300 text-[9px] text-slate-700 flex justify-between items-center mt-4">
                  <div>
                    <span className="font-bold text-slate-900 block uppercase">FOR HR DEPARTMENT USE ONLY:</span>
                    <span>Received & Verified By: __________________________</span>
                  </div>
                  <div>
                    <span>Assigned Employee ID: ______________</span>
                  </div>
                  <div>
                    <span>Date Received: ______________</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
            <span className="text-xs text-slate-500 font-medium">
              💡 Tip: Click &quot;Print Form&quot; to output standard A4 HR documents for onboarding new employees.
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>

      {/* Dedicated Print Container for Window.print() */}
      <div ref={printRef} className="print-only p-3 bg-white text-slate-900 font-sans text-[8.5px] leading-tight space-y-1.5">
        {/* Header */}
        <div className="flex justify-between items-center border-b-2 border-slate-900 pb-1.5 mb-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              {isSeb ? <SebLogo size={38} /> : <IenLogo size={38} />}
            </div>
            <div>
              <h1 className="text-[11px] font-black text-slate-900 uppercase tracking-tight leading-none">{companyFullName}</h1>
              <p className="text-[8px] font-bold text-slate-600 mt-0.5">{companyAddress}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[7.5px] font-mono text-slate-500">TIN: {companyTin}</span>
                <span className="text-[8px] font-black uppercase text-slate-900 border border-slate-900 px-1 py-0.5 rounded leading-none">
                  HR 201 EMPLOYEE PERSONAL DATA SHEET
                </span>
              </div>
            </div>
          </div>

          {/* Photo box */}
          <div className="w-14 h-14 border border-dashed border-slate-500 rounded flex flex-col items-center justify-center text-center p-0.5 bg-slate-50 shrink-0">
            <span className="text-[6.5px] font-black uppercase text-slate-500 leading-tight">Attach Recent</span>
            <span className="text-[7.5px] font-black text-slate-800">2x2 Photo</span>
          </div>
        </div>

        {/* Section I */}
        <div className="space-y-1">
          <h2 className="text-[8px] font-black uppercase bg-slate-900 text-white px-1.5 py-0.5 rounded tracking-wide">
            I. PERSONAL INFORMATION
          </h2>

          <div className="grid grid-cols-4 gap-2">
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">Surname / Last Name *</span>
              <div className="h-2.5"></div>
            </div>
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">First Name *</span>
              <div className="h-2.5"></div>
            </div>
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">Middle Name</span>
              <div className="h-2.5"></div>
            </div>
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">Suffix / Nickname</span>
              <div className="h-2.5"></div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-3 border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">Date of Birth *</span>
              <div className="h-2.5"></div>
            </div>
            <div className="col-span-3 border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">Place of Birth</span>
              <div className="h-2.5"></div>
            </div>
            <div className="col-span-2 border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">Gender *</span>
              <div className="h-2.5 text-[7px] flex items-center gap-2">[ ] M   [ ] F</div>
            </div>
            <div className="col-span-4 border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">Civil Status *</span>
              <div className="h-2.5 text-[6.5px] flex items-center gap-1.5">[ ] Single [ ] Married [ ] Widowed [ ] Sep</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">Permanent Home Address *</span>
              <div className="h-2.5"></div>
            </div>
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">Present Residential Address *</span>
              <div className="h-2.5"></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">Mobile Contact Number *</span>
              <div className="h-2.5"></div>
            </div>
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">Personal Email Address *</span>
              <div className="h-2.5"></div>
            </div>
          </div>

          <div className="border border-slate-300 p-1.5 rounded space-y-1 bg-slate-50/80">
            <div className="grid grid-cols-3 gap-2">
              <div className="border-b border-slate-400 pb-0.5">
                <span className="block text-[7px] font-bold text-slate-700 uppercase">Emergency Contact Person *</span>
                <div className="h-2.5"></div>
              </div>
              <div className="border-b border-slate-400 pb-0.5">
                <span className="block text-[7px] font-bold text-slate-700 uppercase">Relationship *</span>
                <div className="h-2.5"></div>
              </div>
              <div className="border-b border-slate-400 pb-0.5">
                <span className="block text-[7px] font-bold text-slate-700 uppercase">Contact No. *</span>
                <div className="h-2.5"></div>
              </div>
            </div>
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-700 uppercase">Emergency Contact Address / Location *</span>
              <div className="h-2.5"></div>
            </div>
          </div>
        </div>

        {/* Section II */}
        <div className="space-y-1">
          <h2 className="text-[8px] font-black uppercase bg-slate-900 text-white px-1.5 py-0.5 rounded tracking-wide">
            II. MANDATORY GOVERNMENT NUMBERS & PAYROLL BANK
          </h2>

          <div className="grid grid-cols-4 gap-2">
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">SSS Number *</span>
              <div className="h-2.5"></div>
            </div>
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">TIN *</span>
              <div className="h-2.5"></div>
            </div>
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">PhilHealth No. *</span>
              <div className="h-2.5"></div>
            </div>
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">PAG-IBIG MID *</span>
              <div className="h-2.5"></div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">ATM Bank Name</span>
              <div className="h-2.5"></div>
            </div>
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">Payroll Account Number</span>
              <div className="h-2.5"></div>
            </div>
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">HMO Provider & Card No.</span>
              <div className="h-2.5"></div>
            </div>
          </div>
        </div>

        {/* Section III */}
        <div className="space-y-1">
          <h2 className="text-[8px] font-black uppercase bg-slate-900 text-white px-1.5 py-0.5 rounded tracking-wide">
            III. EDUCATIONAL ATTAINMENT
          </h2>

          <table className="w-full text-left border border-slate-300 text-[7px] table-fixed">
            <thead>
              <tr className="bg-slate-200 font-bold border-b border-slate-300 text-slate-900">
                <th className="p-1 border-r border-slate-300 w-[16%]">Level</th>
                <th className="p-1 border-r border-slate-300 w-[36%]">Name of School</th>
                <th className="p-1 border-r border-slate-300 w-[24%]">Degree / Course</th>
                <th className="p-1 border-r border-slate-300 w-[12%]">Year Graduated</th>
                <th className="p-1 w-[12%]">Honors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-1 font-bold border-r border-slate-200 bg-slate-50">Elementary</td>
                <td className="p-1 border-r border-slate-200"></td>
                <td className="p-1 border-r border-slate-200"></td>
                <td className="p-1 border-r border-slate-200"></td>
                <td className="p-1"></td>
              </tr>
              <tr>
                <td className="p-1 font-bold border-r border-slate-200 bg-slate-50">High School</td>
                <td className="p-1 border-r border-slate-200"></td>
                <td className="p-1 border-r border-slate-200"></td>
                <td className="p-1 border-r border-slate-200"></td>
                <td className="p-1"></td>
              </tr>
              <tr>
                <td className="p-1 font-bold border-r border-slate-200 bg-slate-50">College</td>
                <td className="p-1 border-r border-slate-200"></td>
                <td className="p-1 border-r border-slate-200"></td>
                <td className="p-1 border-r border-slate-200"></td>
                <td className="p-1"></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section IV */}
        <div className="space-y-1">
          <h2 className="text-[8px] font-black uppercase bg-slate-900 text-white px-1.5 py-0.5 rounded tracking-wide">
            IV. PREVIOUS EMPLOYMENT HISTORY
          </h2>

          <table className="w-full text-left border border-slate-300 text-[7px] table-fixed">
            <thead>
              <tr className="bg-slate-200 font-bold border-b border-slate-300 text-slate-900">
                <th className="p-1 border-r border-slate-300 w-[28%]">Company Name</th>
                <th className="p-1 border-r border-slate-300 w-[24%]">Position Held</th>
                <th className="p-1 border-r border-slate-300 w-[20%]">Inclusive Dates</th>
                <th className="p-1 border-r border-slate-300 w-[12%]">Salary</th>
                <th className="p-1 w-[16%]">Reason for Leaving</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {[1, 2].map(r => (
                <tr key={r}>
                  <td className="p-1 border-r border-slate-200 h-3.5"></td>
                  <td className="p-1 border-r border-slate-200 h-3.5"></td>
                  <td className="p-1 border-r border-slate-200 h-3.5"></td>
                  <td className="p-1 border-r border-slate-200 h-3.5"></td>
                  <td className="p-1 h-3.5"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section V: Family Background & Dependents */}
        <div className="space-y-1">
          <h2 className="text-[8px] font-black uppercase bg-slate-900 text-white px-1.5 py-0.5 rounded tracking-wide">
            V. FAMILY BACKGROUND & DEPENDENT CHILDREN
          </h2>

          <div className="grid grid-cols-2 gap-2">
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">Father&apos;s Name & Occupation</span>
              <div className="h-2.5"></div>
            </div>
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">Mother&apos;s Maiden Name & Occupation</span>
              <div className="h-2.5"></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">Spouse Name & Occupation</span>
              <div className="h-2.5"></div>
            </div>
            <div className="border-b border-slate-400 pb-0.5">
              <span className="block text-[7px] font-bold text-slate-600 uppercase">Number of Children</span>
              <div className="h-2.5"></div>
            </div>
          </div>

          <table className="w-full text-left border border-slate-300 text-[7px] table-fixed">
            <thead>
              <tr className="bg-slate-200 font-bold border-b border-slate-300 text-slate-900">
                <th className="p-1 border-r border-slate-300 w-[6%] text-center">#</th>
                <th className="p-1 border-r border-slate-300 w-[44%]">Full Name of Dependent Child</th>
                <th className="p-1 border-r border-slate-300 w-[20%]">Date of Birth</th>
                <th className="p-1 border-r border-slate-300 w-[15%]">Gender</th>
                <th className="p-1 w-[15%]">Relationship</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {[1, 2].map(r => (
                <tr key={r}>
                  <td className="p-1 font-bold border-r border-slate-200 text-center bg-slate-50">{r}</td>
                  <td className="p-1 border-r border-slate-200 h-3"></td>
                  <td className="p-1 border-r border-slate-200 h-3"></td>
                  <td className="p-1 border-r border-slate-200 h-3"></td>
                  <td className="p-1 h-3"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section VI: Character References */}
        <div className="space-y-1">
          <h2 className="text-[8px] font-black uppercase bg-slate-900 text-white px-1.5 py-0.5 rounded tracking-wide">
            VI. CHARACTER REFERENCES (3 Professional References)
          </h2>

          <table className="w-full text-left border border-slate-300 text-[7px] table-fixed">
            <thead>
              <tr className="bg-slate-200 font-bold border-b border-slate-300 text-slate-900">
                <th className="p-1 border-r border-slate-300 w-[28%]">Full Name</th>
                <th className="p-1 border-r border-slate-300 w-[36%]">Company & Position</th>
                <th className="p-1 border-r border-slate-300 w-[21%]">Contact Number</th>
                <th className="p-1 w-[15%]">Years Known</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {[1, 2, 3].map(r => (
                <tr key={r}>
                  <td className="p-1 border-r border-slate-200 h-3"></td>
                  <td className="p-1 border-r border-slate-200 h-3"></td>
                  <td className="p-1 border-r border-slate-200 h-3"></td>
                  <td className="p-1 h-3"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section VII: Mandatory 201 Submission Checklist */}
        <div className="space-y-1 p-1.5 border border-slate-300 rounded bg-slate-50/80 avoid-page-break break-inside-avoid">
          <h2 className="text-[7.5px] font-black uppercase text-slate-900 tracking-wide">
            VII. MANDATORY HR 201 REQUIREMENTS CHECKLIST
          </h2>
          <div className="grid grid-cols-4 gap-1 text-[6.5px] font-medium text-slate-800">
            <div>[ ] PSA Birth Cert</div>
            <div>[ ] SSS E-1 / Card</div>
            <div>[ ] NBI Clearance</div>
            <div>[ ] PSA Marriage Cert</div>
            <div>[ ] BIR Form 1902/2316</div>
            <div>[ ] Medical / Drug Test</div>
            <div>[ ] PhilHealth MDR</div>
            <div>[ ] Pag-IBIG MID Form</div>
            <div>[ ] Diploma / TOR</div>
            <div>[ ] 2x2 Photos (2pcs)</div>
            <div>[ ] COE / Clearance</div>
            <div>[ ] Valid Gov ID</div>
          </div>
        </div>

        {/* Undertaking & Signatures */}
        <div className="space-y-1.5 pt-1.5 border-t-2 border-slate-900 avoid-page-break break-inside-avoid">
          <p className="text-[6.5px] leading-tight text-slate-800 italic">
            &quot;I hereby certify that all information supplied in this 201 Personnel Data Sheet is true and complete. Pursuant to RA 10173 (Data Privacy Act), I authorize the company to process my data for HR and regulatory compliance.&quot;
          </p>

          <div className="grid grid-cols-2 gap-8 pt-2">
            <div className="text-center">
              <div className="border-b border-slate-900 h-5"></div>
              <span className="block text-[7px] font-bold uppercase text-slate-900 mt-1">Employee Signature Over Printed Name</span>
            </div>

            <div className="text-center">
              <div className="border-b border-slate-900 h-5"></div>
              <span className="block text-[7px] font-bold uppercase text-slate-900 mt-1">Date Signed</span>
            </div>
          </div>
        </div>

      </div>
    </>
  );
};

