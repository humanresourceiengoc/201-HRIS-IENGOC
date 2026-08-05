import React, { useState, useEffect } from 'react';
import { CompanyKey, Employee } from '../types';
import { fetchPublicVerifiedEmployee } from '../lib/db';
import { ShieldCheck, CheckCircle2, Building2, User, FileText, Phone, HeartHandshake, Copy, Check, QrCode, Search, LogIn, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { IenLogo, SebLogo } from './CompanyLogos';

interface PublicVerificationViewProps {
  initialQuery?: string;
  onGoToLogin?: () => void;
}

export const PublicVerificationView: React.FC<PublicVerificationViewProps> = ({
  initialQuery = '',
  onGoToLogin
}) => {
  const [query, setQuery] = useState<string>(initialQuery);
  const [searchWord, setSearchWord] = useState<string>(initialQuery);
  const [loading, setLoading] = useState<boolean>(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [company, setCompany] = useState<CompanyKey>('iencc');
  const [copied, setCopied] = useState<boolean>(false);
  const [verifyTime, setVerifyTime] = useState<string>('');

  useEffect(() => {
    // Read query from URL if not explicitly provided
    if (!query) {
      const urlParams = new URLSearchParams(window.location.search);
      const paramVal = urlParams.get('verify') || urlParams.get('verifyEmp') || urlParams.get('empId') || urlParams.get('id') || '';
      if (paramVal) {
        setQuery(paramVal);
        setSearchWord(paramVal);
      }
    }
  }, []);

  useEffect(() => {
    if (!query) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetchPublicVerifiedEmployee(query).then(result => {
      if (!isMounted) return;
      if (result) {
        setEmployee(result.employee);
        setCompany(result.company);
        setVerifyTime(new Date().toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'medium'
        }));
      } else {
        setEmployee(null);
      }
      setLoading(false);
    }).catch(err => {
      console.warn('Public verification error:', err);
      if (isMounted) {
        setEmployee(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [query]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchWord.trim()) return;
    setQuery(searchWord.trim());
    // Update browser URL query parameter without full reload
    const newUrl = `${window.location.origin}${window.location.pathname}?verify=${encodeURIComponent(searchWord.trim())}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const isSeb = company === 'seb';
  const companyFullName = isSeb ? 'SEB Equipment Corp.' : 'Integrated and Effective Navigation Consultancy Corp.';
  const shortCompany = isSeb ? 'SEB EQUIPMENT CORP.' : 'IEN CONSULTANCY CORP.';

  // Build permanent verification URL for this employee
  const permanentKey = employee ? `${company}_${employee.empId || employee.id}` : query;
  const permanentUrl = `${window.location.origin}${window.location.pathname}?verify=${encodeURIComponent(permanentKey)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(permanentUrl)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(permanentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Banner Header */}
      <header className="bg-slate-950 border-b border-slate-800 py-4 px-6 sticky top-0 z-30 shadow-md">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl p-1 flex items-center justify-center shadow-sm">
              {isSeb ? <SebLogo size={32} /> : <IenLogo size={32} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-wider text-blue-400 uppercase">OFFICIAL HRIS VERIFICATION</span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Live
                </span>
              </div>
              <h1 className="text-sm font-bold text-white tracking-tight">{shortCompany}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search Bar */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64 min-w-[180px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Enter Employee ID..."
                value={searchWord}
                onChange={(e) => setSearchWord(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </form>

            {onGoToLogin && (
              <button
                onClick={onGoToLogin}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shrink-0 shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                HR Login
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Public Body */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 my-auto flex flex-col justify-center">
        {loading ? (
          <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-12 text-center shadow-2xl backdrop-blur-md my-8">
            <RefreshCw className="w-10 h-10 text-blue-400 animate-spin mx-auto mb-4" />
            <h3 className="text-base font-bold text-white">Verifying Employee Record...</h3>
            <p className="text-xs text-slate-400 mt-1">Connecting to Cloud Database to retrieve official 201 records.</p>
          </div>
        ) : employee ? (
          <div className="space-y-6 my-4">
            {/* Verified Badge Header */}
            <div className="bg-gradient-to-r from-emerald-900/60 via-slate-800 to-emerald-900/60 border border-emerald-500/40 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    OFFICIAL VERIFIED EMPLOYEE
                    <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-400/20 text-emerald-300 rounded-md border border-emerald-400/30">
                      AUTHENTIC 201 RECORD
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Verified against company database on <span className="font-semibold text-emerald-300">{verifyTime}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleCopyLink}
                  className={`w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600'
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-blue-400" />}
                  {copied ? 'Copied Permanent Link!' : 'Copy Permanent Link'}
                </button>
              </div>
            </div>

            {/* Profile Card */}
            <div className="bg-slate-800/90 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-md">
              <div className={`h-2.5 bg-gradient-to-r ${isSeb ? 'from-teal-500 via-cyan-500 to-emerald-500' : 'from-blue-600 via-indigo-500 to-sky-500'}`} />

              <div className="p-6 sm:p-8 space-y-6">
                {/* Photo & Primary Info */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 border-b border-slate-700/80 pb-6 text-center sm:text-left">
                  <div className="w-32 h-32 rounded-2xl overflow-hidden border-4 border-slate-700 bg-slate-900 shadow-xl shrink-0 flex items-center justify-center relative group">
                    {employee.photoUrl ? (
                      <img src={employee.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-slate-800 text-slate-300 font-black text-3xl flex items-center justify-center">
                        {employee.firstName?.[0]}{employee.lastName?.[0]}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <div>
                      <span className="inline-block px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-mono font-bold tracking-wider mb-1">
                        EMP ID: {employee.empId || employee.id}
                      </span>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                        {employee.firstName} {employee.middleName ? `${employee.middleName} ` : ''}{employee.lastName} {employee.suffix || ''}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                      <span className="px-3 py-1 bg-slate-700/80 text-white rounded-lg text-xs font-bold border border-slate-600">
                        {employee.position || 'Employee'}
                      </span>
                      <span className="px-3 py-1 bg-slate-700/80 text-slate-300 rounded-lg text-xs font-medium border border-slate-600">
                        {employee.department || 'General'}
                      </span>
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                        employee.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      }`}>
                        {employee.status || 'ACTIVE'} ({employee.classification || 'Regular'})
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 pt-1">
                      Company: <strong className="text-slate-200">{companyFullName}</strong>
                    </p>
                  </div>
                </div>

                {/* Grid Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Employment Details */}
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-700/60 space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <Building2 className="w-4 h-4 text-blue-400" />
                      Employment Status
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 text-[11px] block">Date Hired</span>
                        <span className="font-semibold text-slate-200">{employee.dateHired || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[11px] block">Regularization</span>
                        <span className="font-semibold text-slate-200">{employee.dateOfRegularization || employee.regularizationDate || 'Regularized'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[11px] block">Division / Unit</span>
                        <span className="font-semibold text-slate-200">{employee.division || 'Operations'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[11px] block">Work Location</span>
                        <span className="font-semibold text-slate-200">{employee.locationBranch || 'Mandaluyong Office'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Government Identification */}
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-700/60 space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      Government Identification
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div>
                        <span className="text-slate-500 text-[10px] block font-sans">SSS Number</span>
                        <span className="font-bold text-slate-200">{employee.sss || 'RECORDED'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block font-sans">TIN Number</span>
                        <span className="font-bold text-slate-200">{employee.tin || 'RECORDED'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block font-sans">PhilHealth</span>
                        <span className="font-bold text-slate-200">{employee.philhealth || 'RECORDED'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block font-sans">Pag-IBIG</span>
                        <span className="font-bold text-slate-200">{employee.pagibig || 'RECORDED'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                {employee.emergencyName && (
                  <div className="bg-rose-950/20 p-4 rounded-2xl border border-rose-800/40 space-y-1 text-xs">
                    <h4 className="font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                      <HeartHandshake className="w-4 h-4 text-rose-400" />
                      Emergency Contact Person
                    </h4>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="font-bold text-slate-200">{employee.emergencyName} ({employee.emergencyRelation || 'Contact'})</span>
                      <span className="font-mono text-rose-300 font-bold flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {employee.emergencyContact || 'N/A'}
                      </span>
                    </div>
                  </div>
                )}

                {/* QR Code & Permanent Share Link Section */}
                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="space-y-2 flex-1 text-center sm:text-left">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1.5">
                      <QrCode className="w-4 h-4 text-blue-400" />
                      Permanent Verification URL & QR Code
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      This QR code and link provide standard public verification for external auditors, government inspectors, and bank verification requests.
                    </p>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono text-[11px] text-blue-300 truncate select-all">
                      {permanentUrl}
                    </div>
                  </div>

                  {/* QR Image */}
                  <div className="bg-white p-2.5 rounded-2xl shadow-lg border border-slate-300 shrink-0">
                    <img src={qrCodeUrl} alt="Employee Verification QR Code" className="w-28 h-28 object-contain" />
                    <span className="block text-[9px] font-mono font-bold text-slate-800 text-center mt-1">SCAN TO VERIFY</span>
                  </div>
                </div>
              </div>

              {/* Footer Notice */}
              <div className="p-4 bg-slate-950 text-slate-500 text-center text-[11px] border-t border-slate-800">
                Official HRIS Employee Database Verification Portal • {shortCompany} • Mandaluyong City, Philippines
              </div>
            </div>
          </div>
        ) : (
          /* Not Found State */
          <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-8 sm:p-12 text-center shadow-2xl backdrop-blur-md my-8 space-y-4">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto text-rose-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Employee Record Not Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                No active employee record matching ID <strong className="text-slate-200">"{query}"</strong> was found in the official HRIS cloud database.
              </p>
            </div>

            <form onSubmit={handleSearchSubmit} className="max-w-md mx-auto flex gap-2 pt-2">
              <input
                type="text"
                placeholder="Try another Employee ID..."
                value={searchWord}
                onChange={(e) => setSearchWord(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors"
              >
                Verify ID
              </button>
            </form>

            {onGoToLogin && (
              <div className="pt-4 border-t border-slate-700/60">
                <button
                  onClick={onGoToLogin}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center justify-center gap-1.5 mx-auto"
                >
                  <LogIn className="w-4 h-4" /> Go to HRIS Employee Portal Login
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
