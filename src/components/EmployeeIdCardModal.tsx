import React, { useState } from 'react';
import { CompanyKey, Employee } from '../types';
import { X, Printer, Shield, Phone, CreditCard, Sparkles, RotateCw, Building2, HeartHandshake, FileText, User, Copy, Check, QrCode } from 'lucide-react';
import { IenLogo, SebLogo } from './CompanyLogos';

interface EmployeeIdCardModalProps {
  isOpen: boolean;
  company: CompanyKey;
  employee: Employee | null;
  onClose: () => void;
}

export const EmployeeIdCardModal: React.FC<EmployeeIdCardModalProps> = ({
  isOpen,
  company,
  employee,
  onClose,
}) => {
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const cardRef = React.useRef<HTMLDivElement>(null);

  if (!isOpen || !employee) return null;

  const isSeb = company === 'seb';
  const companyName = isSeb ? 'SEB EQUIPMENT CORP.' : 'INTEGRATED AND EFFECTIVE NAVIGATION CONSULTANCY CORP.';
  const shortCompanyName = isSeb ? 'SEB EQUIPMENT CORP.' : 'IEN CONSULTANCY CORP.';
  const accentGradient = isSeb
    ? 'from-teal-600 via-cyan-600 to-emerald-600'
    : 'from-blue-700 via-indigo-600 to-sky-600';

  const permanentKey = `${company}_${employee.empId || employee.id}`;
  const verifyUrl = `${window.location.origin}${window.location.pathname}?verify=${encodeURIComponent(permanentKey)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(verifyUrl)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verifyUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handlePrintCard = () => {
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.error('Print card error:', e);
      window.print();
    }
  };

  const handleFlip = () => {
    setActiveSide(prev => (prev === 'front' ? 'back' : 'front'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs print-id-card-modal">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[94vh] print:max-h-none print:shadow-none print:border-none print:w-auto">
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 no-print">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-sm tracking-tight">Employee ID Card Badge</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs ${
                copiedLink ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
              {copiedLink ? 'Copied Link!' : 'Copy Permanent Link'}
            </button>
            <button
              onClick={handlePrintCard}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Card
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Card Front/Back Toggle & Flip Button */}
        <div className="p-3 bg-slate-100 flex items-center justify-between border-b border-slate-200 no-print px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSide('front')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeSide === 'front'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              Front Side
            </button>
            <button
              onClick={() => setActiveSide('back')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeSide === 'back'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              Back Side
            </button>
          </div>
          <button
            onClick={handleFlip}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-full border border-slate-300 flex items-center gap-1.5 transition-colors"
            title="Flip between Front and Back of ID Badge"
          >
            <RotateCw className="w-3.5 h-3.5 text-blue-600" />
            Flip Card
          </button>
        </div>

        {/* ID Card Display Area - Using overflow-y-auto WITHOUT justify-center to prevent top clipping */}
        <div className="p-6 bg-slate-200/80 flex flex-col items-center overflow-y-auto print:p-0 print:bg-white print:overflow-visible flex-1">
          {/* Printable Container centered using my-auto so it never clips top when scrolling */}
          <div ref={cardRef} className="my-auto py-2 print:m-0 print:py-0 print:shadow-none">
            {activeSide === 'front' ? (
              /* FRONT OF ID CARD */
              <div className="w-[320px] h-[500px] bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-slate-300 flex flex-col justify-between relative font-sans">
                {/* Header Band */}
                <div className={`h-24 bg-gradient-to-r ${accentGradient} p-3 flex flex-col justify-between relative`}>
                  <div className="flex items-center justify-between">
                    <div className="w-7 h-7 bg-white rounded-lg p-0.5 flex items-center justify-center shadow-xs">
                      {isSeb ? <SebLogo size={24} /> : <IenLogo size={24} />}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">
                      {isSeb ? 'SEB EQUIPMENT' : 'IEN CORP'}
                    </span>
                    <Shield className="w-4 h-4 text-white/90" />
                  </div>
                  <h4 className="text-[9.5px] font-black text-white uppercase tracking-wider leading-tight">
                    {companyName}
                  </h4>
                  {/* Decorative accent bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-amber-400" />
                </div>

                {/* Photo & Main Details */}
                <div className="flex flex-col items-center px-4 -mt-10 z-10">
                  <div className="w-28 h-28 rounded-2xl overflow-hidden border-4 border-white shadow-md bg-slate-100 flex items-center justify-center">
                    {employee.photoUrl ? (
                      <img
                        src={employee.photoUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-800 text-white font-black text-2xl flex items-center justify-center">
                        {employee.firstName?.[0]}{employee.lastName?.[0]}
                      </div>
                    )}
                  </div>

                  <h2 className="mt-3 text-base font-black text-slate-900 text-center uppercase tracking-tight leading-snug line-clamp-2">
                    {employee.firstName} {employee.lastName}
                  </h2>
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide text-center mt-0.5">
                    {employee.position || 'Employee'}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">
                    {employee.department || 'General'}
                  </p>

                  <div className="mt-4 px-3.5 py-1 bg-slate-100 rounded-full border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-mono font-black tracking-widest text-slate-800">
                      ID: {employee.empId || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Footer Bar */}
                <div className="p-3 bg-slate-900 text-slate-300 text-center flex flex-col items-center justify-center gap-1 border-t border-slate-800">
                  <div className="w-full flex justify-center space-x-0.5 py-1 bg-white rounded-sm">
                    {/* Simulated Barcode */}
                    {Array.from({ length: 32 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-6 ${i % 3 === 0 ? 'w-1' : i % 5 === 0 ? 'w-1.5' : 'w-0.5'} ${
                          i % 7 === 0 ? 'bg-transparent' : 'bg-slate-900'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                    AUTHORIZED PERSONNEL ONLY
                  </span>
                </div>
              </div>
            ) : (
              /* BACK OF ID CARD - Official PVC White Badge Aesthetic */
              <div className="w-[320px] h-[500px] bg-white text-slate-900 rounded-2xl shadow-xl overflow-hidden border-2 border-slate-300 flex flex-col justify-between relative font-sans">
                {/* Top Company Accent Stripe */}
                <div className={`h-3 bg-gradient-to-r ${accentGradient} w-full`} />

                <div className="px-5 pt-3 pb-2 space-y-3 flex-1 flex flex-col justify-between">
                  {/* Statutory Identifiers Header */}
                  <div>
                    <div className="border-b border-slate-200 pb-1.5 mb-2 flex justify-between items-center">
                      <h5 className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        Government Identifiers
                      </h5>
                      <span className="text-[9px] font-bold text-slate-400 font-mono">
                        {employee.empId || 'ID'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="text-slate-500 font-bold block text-[8.5px] uppercase tracking-wider">SSS Number</span>
                        <span className="font-mono font-black text-slate-900 text-[11px] block mt-0.5">
                          {employee.sss || 'NOT RECORDED'}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="text-slate-500 font-bold block text-[8.5px] uppercase tracking-wider">TIN Number</span>
                        <span className="font-mono font-black text-slate-900 text-[11px] block mt-0.5">
                          {employee.tin || 'NOT RECORDED'}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="text-slate-500 font-bold block text-[8.5px] uppercase tracking-wider">PhilHealth</span>
                        <span className="font-mono font-black text-slate-900 text-[11px] block mt-0.5">
                          {employee.philhealth || 'NOT RECORDED'}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="text-slate-500 font-bold block text-[8.5px] uppercase tracking-wider">Pag-IBIG</span>
                        <span className="font-mono font-black text-slate-900 text-[11px] block mt-0.5">
                          {employee.pagibig || 'NOT RECORDED'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Emergency Contact & Verification QR Code Section */}
                  <div className="border-t border-slate-200 pt-2 flex items-center justify-between gap-2">
                    <div className="flex-1 bg-rose-50/70 p-2 rounded-xl border border-rose-200/80 space-y-0.5 text-[9.5px]">
                      <h5 className="text-[9px] font-black text-rose-700 uppercase tracking-wider flex items-center gap-1">
                        <HeartHandshake className="w-3 h-3 text-rose-600" />
                        In Case of Emergency
                      </h5>
                      <p className="font-black text-slate-900 text-[10.5px] leading-tight truncate">
                        {employee.emergencyName || 'HR Office'}
                      </p>
                      <p className="font-mono font-bold text-rose-700 text-[10px]">
                        {employee.emergencyContact || 'Not recorded'}
                      </p>
                    </div>

                    <div className="bg-white p-1 rounded-lg border border-slate-300 flex flex-col items-center shrink-0">
                      <img src={qrCodeUrl} alt="Verify QR Code" className="w-12 h-12 object-contain" />
                      <span className="text-[6.5px] font-bold uppercase tracking-tighter text-slate-600 mt-0.5">SCAN VERIFY</span>
                    </div>
                  </div>

                  {/* Authorized HR Signature Block */}
                  <div className="pt-2 border-t border-slate-200 flex flex-col items-center justify-end">
                    <div className="w-36 border-b border-slate-400 pb-1 mb-1 text-center">
                      <span className="font-serif italic text-xs font-bold text-slate-700 tracking-wide">
                        HR Department
                      </span>
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                      Authorized Signature
                    </span>
                  </div>
                </div>

                {/* Company Return Address & Disclaimer Footer */}
                <div className="px-4 py-2 bg-slate-100 text-slate-600 text-center border-t border-slate-200 text-[8px] leading-tight space-y-0.5">
                  <p className="font-bold text-slate-800 uppercase tracking-tight">
                    {shortCompanyName}
                  </p>
                  <p className="text-[7.5px] font-semibold text-slate-600">
                    3 M. Vicente St. Brgy Malamig Mandaluyong City • TIN: {isSeb ? '607 097 263 00000' : '601 157 401 00000'}
                  </p>
                  <p className="text-[7px] text-slate-400">
                    If found, please return to HR Dept.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between no-print px-4">
          <button
            onClick={handleFlip}
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Switch to {activeSide === 'front' ? 'Back Side' : 'Front Side'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};

