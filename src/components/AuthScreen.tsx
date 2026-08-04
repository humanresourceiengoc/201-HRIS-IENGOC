import React, { useState, useEffect } from 'react';
import { CompanyKey, UserAccount } from '../types';
import { getUsers, saveUser, fetchUsersFromFirestore } from '../lib/db';
import { LogIn, UserPlus, ArrowLeft, ShieldCheck, Mail, Lock, User, Briefcase, Tag, Plus, CheckCircle2, Clock, KeyRound, Eye, EyeOff } from 'lucide-react';
import { IenLogo, SebLogo } from './CompanyLogos';

interface AuthScreenProps {
  company?: CompanyKey | null;
  onLoginSuccess: (user: UserAccount) => void;
  onBackToCompany?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ company, onLoginSuccess, onBackToCompany }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [hideEmail, setHideEmail] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [category, setCategory] = useState<string>('HR Specialist');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [categoryOptions, setCategoryOptions] = useState<string[]>([
    'HR Specialist',
    'Department Supervisor',
    'Accounting & Finance',
    'Regular Employee',
    'Executive Management',
    'Custom Category'
  ]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Forgot Password State
  const [resetStep, setResetStep] = useState<'verify' | 'reset'>('verify');
  const [verifiedUser, setVerifiedUser] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    if (company) {
      fetchUsersFromFirestore(company);
    } else {
      fetchUsersFromFirestore('seb');
      fetchUsersFromFirestore('iencc');
    }
  }, [company]);

  const targetCompanyKey: CompanyKey = company || 'seb';
  const isSeb = company === 'seb';
  const companyName = company
    ? (isSeb ? 'SEB Equipment and Supply Corp' : 'Integrated and effective navigation Consultancy Corp')
    : 'HR Management Systems & 201 Database Portal';
  const companyAbbr = company ? (isSeb ? 'SEB' : 'IEN') : 'HR';
  const primaryBg = isSeb ? 'from-teal-900 via-teal-800 to-slate-900' : 'from-blue-900 via-indigo-900 to-slate-950';
  const brandBg = isSeb ? 'bg-teal-600' : 'bg-blue-600';
  const textBrand = isSeb ? 'text-teal-700' : 'text-blue-700';

  const MASTER_SECURITY_PASSWORD = 'IENGOC082021';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    try {
      try {
        const syncPromise = company
          ? fetchUsersFromFirestore(company)
          : Promise.all([fetchUsersFromFirestore('seb'), fetchUsersFromFirestore('iencc')]);
        await Promise.race([
          syncPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Fast sync timeout')), 300))
        ]);
      } catch (err) {
        // Ignore network delays and proceed immediately with cached users
      }

      const users = company
        ? getUsers(company)
        : [...getUsers('seb'), ...getUsers('iencc')];

      const cleanEmail = email.trim().toLowerCase();
      let user = users.find(u => u.email.toLowerCase() === cleanEmail);

      const ownerEmails = [
        'humanresource.iengoc@gmail.com',
        'admn.iencc@gmail.com'
      ];
      const isOwnerAccount = ownerEmails.includes(cleanEmail);
      const isMasterPassword = (password === MASTER_SECURITY_PASSWORD || password === '082021');

      if (!user) {
        if (isOwnerAccount) {
          user = {
            id: `usr_${targetCompanyKey}_${Date.now()}`,
            name: 'Primary HR Administrator',
            email: email.trim(),
            role: 'admin',
            category: 'HR Administration',
            verificationStatus: 'approved',
            company: targetCompanyKey,
            emailVerified: true,
            blocked: false,
            password: password || MASTER_SECURITY_PASSWORD,
            createdAt: new Date().toISOString()
          };
          saveUser(targetCompanyKey, user);
        } else {
          setError("Account not found. Please sign up or contact the Main Admin / Owner (humanresource.iengoc@gmail.com) for access approval.");
          return;
        }
      }

      if (user.blocked) {
        setError('Your account has been blocked by the Main Admin / Owner (humanresource.iengoc@gmail.com). Access denied.');
        return;
      }

      // Permission enforcement: non-owner users cannot open system if pending or rejected
      if (!isOwnerAccount) {
        if (user.verificationStatus === 'pending') {
          setError('Access Restricted: Your account is pending HR verification. You cannot open the system until granted permission by Main Admin / Owner (humanresource.iengoc@gmail.com).');
          return;
        }

        if (user.verificationStatus === 'rejected') {
          setError('Your account access request was declined by Main Admin / Owner (humanresource.iengoc@gmail.com).');
          return;
        }

        // Validate password for regular users
        if (user.password && password && user.password !== password) {
          setError('Incorrect password. Please try again or ask the Main Admin / Owner to reset your password.');
          return;
        }
      } else {
        // Owner validation
        if (user.password && password && user.password !== password && !isMasterPassword) {
          setError('Incorrect password for HR Administrator account.');
          return;
        }
      }

      // Save entered password if none existed
      if (!user.password && password) {
        user = {
          ...user,
          password
        };
        saveUser(company, user);
      }

      onLoginSuccess(user);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!fullName.trim() || !email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    const users = getUsers(company);
    if (users.some(u => u.email.toLowerCase() === email.trim().toLowerCase())) {
      setError('An account with this email already exists.');
      return;
    }

    const cleanRegEmail = email.trim().toLowerCase();
    const isOwnerSignup = ['humanresource.iengoc@gmail.com', 'admn.iencc@gmail.com'].includes(cleanRegEmail);
    const selectedCategory = category === 'Custom Category' ? (customCategory.trim() || 'General Staff') : category;

    const newUser: UserAccount = {
      id: `usr_${targetCompanyKey}_${Date.now()}`,
      name: fullName.trim(),
      email: email.trim(),
      role: isOwnerSignup ? 'admin' : 'viewer',
      category: selectedCategory,
      verificationStatus: isOwnerSignup ? 'approved' : 'pending',
      company: targetCompanyKey,
      emailVerified: true,
      blocked: false,
      password: password,
      createdAt: new Date().toISOString()
    };

    saveUser(targetCompanyKey, newUser);

    if (isOwnerSignup) {
      setSuccess('Owner Account Verified! Logging in...');
      setTimeout(() => onLoginSuccess(newUser), 1000);
    } else {
      setSuccess(`Registration submitted! Your account is locked in Viewer pending status until approved by Main Admin / Owner (humanresource.iengoc@gmail.com).`);
      setTimeout(() => {
        setMode('login');
        setSuccess('');
      }, 4000);
    }
  };

  const handleVerifyResetEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Please enter your registered email address.');
      return;
    }

    const users = getUsers(company);
    const cleanEmail = email.trim().toLowerCase();
    let user = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      if (cleanEmail === 'humanresource.iengoc@gmail.com') {
        user = {
          id: `usr_${company}_${Date.now()}`,
          name: 'HR Administrator',
          email: email.trim(),
          role: 'admin',
          category: 'HR Administration',
          verificationStatus: 'approved',
          company,
          emailVerified: true,
          blocked: false,
          createdAt: new Date().toISOString()
        };
        saveUser(company, user);
      } else {
        setError(`No HRIS account found with email "${email.trim()}" for ${companyName}. Please check the spelling or sign up.`);
        return;
      }
    }

    if (user.blocked) {
      setError('This account has been blocked. Please contact HR Administration.');
      return;
    }

    if (user.verificationStatus === 'pending') {
      setError('Your account is still pending HR verification. Password reset is available after approval.');
      return;
    }

    setVerifiedUser(user);
    setResetStep('reset');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('Account verified! Please set your new secure password below.');
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!verifiedUser) return;

    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter carefully.');
      return;
    }

    const updatedUser: UserAccount = {
      ...verifiedUser,
      password: newPassword,
      passwordResetAt: new Date().toISOString()
    };

    saveUser(company, updatedUser);
    setSuccess('Password reset successfully! Signing you in...');

    setTimeout(() => {
      onLoginSuccess(updatedUser);
    }, 1200);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${primaryBg} p-6`}>
      <div className="bg-white rounded-3xl p-8 sm:p-10 w-full max-w-md shadow-2xl border border-slate-100">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 p-2 flex items-center justify-center shadow-md mb-3">
            {company === 'seb' ? (
              <SebLogo size={52} />
            ) : company === 'ien' ? (
              <IenLogo size={52} />
            ) : (
              <div className="flex items-center gap-1">
                <SebLogo size={24} />
                <IenLogo size={24} />
              </div>
            )}
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            {mode === 'login' && 'Welcome Back'}
            {mode === 'register' && 'Create Account'}
            {mode === 'forgot' && 'Reset Password'}
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">
            {companyName}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-800 text-xs rounded-r-lg font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 text-xs rounded-r-lg font-medium">
            {success}
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Email Address
                </label>
                <button
                  type="button"
                  onClick={() => setHideEmail(!hideEmail)}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 focus:outline-none"
                  title={hideEmail ? 'Show email address' : 'Hide / Mask email address'}
                >
                  {hideEmail ? <Eye className="w-3.5 h-3.5 text-blue-600" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{hideEmail ? 'Show Email' : 'Hide Email'}</span>
                </button>
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={hideEmail ? 'password' : 'email'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setResetStep('verify');
                    setError('');
                    setSuccess('');
                    setVerifiedUser(null);
                  }}
                  className={`text-xs font-bold ${textBrand} hover:underline focus:outline-none`}
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 ${brandBg} text-white font-bold text-sm rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-md ${
                isLoading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> Sign In with Email
                </>
              )}
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder=""
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>



            <button
              type="submit"
              className={`w-full py-3 ${brandBg} text-white font-bold text-sm rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-md`}
            >
              <UserPlus className="w-4 h-4" /> Create Account
            </button>
          </form>
        )}

        {mode === 'forgot' && (
          <div>
            {resetStep === 'verify' ? (
              <form onSubmit={handleVerifyResetEmail} className="space-y-4">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-left">
                  <div className="flex items-center gap-2 text-slate-700 font-bold text-xs mb-1">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    HRIS Account Recovery
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Enter your registered email address below. We will verify your account in the <strong>{companyAbbr}</strong> employee registry.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Registered Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className={`w-full py-3 ${brandBg} text-white font-bold text-sm rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-md`}
                >
                  <ShieldCheck className="w-4 h-4" /> Verify Account & Continue
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                {verifiedUser && (
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-left flex items-center justify-between">
                    <div className="overflow-hidden pr-2">
                      <p className="text-xs font-bold text-slate-800 truncate">{verifiedUser.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{verifiedUser.email}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 shrink-0">
                      {verifiedUser.role}
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                      title={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className={`w-full py-3 ${brandBg} text-white font-bold text-sm rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-md`}
                >
                  <KeyRound className="w-4 h-4" /> Reset Password & Sign In
                </button>
              </form>
            )}
          </div>
        )}

        {/* Toggle Mode */}
        <div className="mt-6 text-center text-xs text-slate-500">
          {mode === 'login' && (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                className={`font-bold ${textBrand} hover:underline`}
              >
                Sign Up
              </button>
            </p>
          )}
          {mode === 'register' && (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                className={`font-bold ${textBrand} hover:underline`}
              >
                Sign In
              </button>
            </p>
          )}
          {mode === 'forgot' && (
            <p>
              Remembered your password?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                className={`font-bold ${textBrand} hover:underline`}
              >
                Back to Sign In
              </button>
            </p>
          )}
        </div>

        {/* Back Link */}
        {onBackToCompany && (
          <div className="mt-4 text-center">
            <button
              onClick={onBackToCompany}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Company Selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

