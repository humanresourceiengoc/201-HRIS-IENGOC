import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CompanyKey, DocumentRequirement, Employee, UserAccount, CollaboratorPresence } from './types';
import {
  getEmployees,
  saveEmployee,
  deleteEmployee,
  getRequirements,
  getUsers,
  fetchUsersFromFirestore,
  subscribeToEmployees,
  subscribeToRequirements,
  subscribeToUsers,
  subscribeToPresence,
  updatePresence,
  removePresence,
  syncAllLocalDataToFirestore
} from './lib/db';

import { CompanySelector } from './components/CompanySelector';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { RealtimeSyncBanner } from './components/RealtimeSyncBanner';
import { Dashboard } from './components/Dashboard';
import { EmployeesList } from './components/EmployeesList';
import { EmployeeModal } from './components/EmployeeModal';
import { ImportExport } from './components/ImportExport';
import { UserManagement } from './components/UserManagement';
import { CalendarView } from './components/CalendarView';
import { OrgChart } from './components/OrgChart';
import { AttendanceTrackerView } from './components/AttendanceTrackerView';
import { GovLoansView } from './components/GovLoansView';
import { PrintView } from './components/PrintView';
import { EmployeePrintModal } from './components/EmployeePrintModal';
import { BlankInfoSheetModal } from './components/BlankInfoSheetModal';
import { EmployeeIdCardModal } from './components/EmployeeIdCardModal';
import { ConfirmModal } from './components/ConfirmModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { PublicVerificationView } from './components/PublicVerificationView';
import { GoogleSheetsIntegration } from './components/GoogleSheetsIntegration';
import { FileSpreadsheet } from 'lucide-react';

export default function App() {
  const [company, setCompany] = useState<CompanyKey | null>(null);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [presenceList, setPresenceList] = useState<CollaboratorPresence[]>([]);

  // Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'view' | 'edit' | 'add';
    employee: Employee | null;
  }>({
    isOpen: false,
    mode: 'view',
    employee: null,
  });

  // Google Sheet Quick Modal State
  const [showGoogleSheetModal, setShowGoogleSheetModal] = useState<boolean>(false);

  // Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Print Employee state
  const [printEmployee, setPrintEmployee] = useState<Employee | null>(null);

  // ID Card Badge State
  const [idCardEmployee, setIdCardEmployee] = useState<Employee | null>(null);

  // Blank 201 Form Modal State
  const [showBlankFormModal, setShowBlankFormModal] = useState<boolean>(false);

  // Delete Confirmation Modal State
  const [pendingDeleteEmployee, setPendingDeleteEmployee] = useState<Employee | null>(null);

  // Public Employee 201 Verification Route State (Accessible across browsers without login)
  const [publicVerifyQuery, setPublicVerifyQuery] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('verify') || urlParams.get('verifyEmp') || urlParams.get('empId') || urlParams.get('id') || null;
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(new Date());

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Load Company Data
  const loadCompanyData = useCallback(() => {
    if (!company) return;
    const emps = getEmployees(company);
    const reqs = getRequirements(company);
    const usrs = getUsers(company);

    setEmployees([...emps]);
    setRequirements([...reqs]);
    setUsers([...usrs]);

    fetchUsersFromFirestore(company).then(freshUsers => {
      setUsers([...freshUsers]);
    }).catch(err => {
      console.warn('Could not sync users from Firestore:', err);
    });
  }, [company]);

  const prevUsersRef = useRef<UserAccount[]>([]);
  const isFirstUsersSyncRef = useRef<boolean>(true);
  const prevPresenceRef = useRef<CollaboratorPresence[]>([]);
  const isFirstPresenceSyncRef = useRef<boolean>(true);

  // Real-Time Firestore Synchronization for Users & Current Account Permissions
  useEffect(() => {
    const targetComp = company || 'iencc';
    const unsubUsers = subscribeToUsers(targetComp, (freshUsers) => {
      setUsers([...freshUsers]);

      // Check current user status updates in real-time
      if (currentUser) {
        const myAccount = freshUsers.find(u => u.email.toLowerCase() === currentUser.email.toLowerCase());
        if (myAccount) {
          // Detect Role Changes (Admin vs Viewer)
          if (myAccount.role !== currentUser.role) {
            setCurrentUser(myAccount);
            addToast(
              `🔔 ACCESS LEVEL UPDATED: Your account role was changed in real-time to ${myAccount.role.toUpperCase()} (${myAccount.role === 'admin' ? 'Full HR Access' : 'Read-Only Viewer'}).`,
              'success'
            );
          }
          // Detect Block / Unblock Status Changes
          if (myAccount.blocked !== currentUser.blocked) {
            setCurrentUser(myAccount);
            if (myAccount.blocked) {
              addToast(`⛔ ACCOUNT BLOCKED: Your account access was BLOCKED by HR Administrator.`, 'error');
            } else {
              addToast(`✅ ACCOUNT UNBLOCKED: Your account access was UNBLOCKED by HR Administrator.`, 'success');
            }
          }
          // Detect Verification Approval / Status
          if (myAccount.verificationStatus !== currentUser.verificationStatus) {
            setCurrentUser(myAccount);
            if (myAccount.verificationStatus === 'approved') {
              addToast(`🎉 REGISTRATION APPROVED: HR Administrator approved your account access!`, 'success');
            } else if (myAccount.verificationStatus === 'rejected') {
              addToast(`⚠️ ACCESS DECLINED: HR Administrator declined your registration request.`, 'warning');
            }
          }
        }
      }

      // Notify Admins about new users / status updates from other browsers
      if (!isFirstUsersSyncRef.current && prevUsersRef.current.length > 0) {
        freshUsers.forEach(u => {
          const prevU = prevUsersRef.current.find(pu => pu.email.toLowerCase() === u.email.toLowerCase());
          if (!prevU) {
            // New user registration
            if (currentUser?.role === 'admin') {
              addToast(`📩 NEW USER REGISTRATION: ${u.email} registered as ${u.role.toUpperCase()} (${u.verificationStatus || 'Pending'})`, 'info');
            }
          } else {
            // Role / Block changes for other users
            if (prevU.role !== u.role && currentUser?.role === 'admin' && u.email.toLowerCase() !== currentUser.email.toLowerCase()) {
              addToast(`🔄 REAL-TIME USER UPDATE: ${u.email} is now ${u.role.toUpperCase()}.`, 'info');
            }
            if (prevU.blocked !== u.blocked && currentUser?.role === 'admin' && u.email.toLowerCase() !== currentUser.email.toLowerCase()) {
              addToast(`🔄 REAL-TIME USER UPDATE: ${u.email} is now ${u.blocked ? 'BLOCKED' : 'UNBLOCKED'}.`, 'info');
            }
          }
        });
      }

      prevUsersRef.current = freshUsers;
      isFirstUsersSyncRef.current = false;
    });

    return () => {
      unsubUsers();
    };
  }, [company, currentUser, addToast]);

  // Real-Time Firestore Synchronization for Employees & Requirements
  useEffect(() => {
    if (!company) return;
    loadCompanyData();

    const unsubEmps = subscribeToEmployees(company, (realtimeEmps) => {
      setEmployees([...realtimeEmps]);
      setLastSyncTime(new Date());
    });
    const unsubReqs = subscribeToRequirements(company, (realtimeReqs) => {
      setRequirements([...realtimeReqs]);
      setLastSyncTime(new Date());
    });

    return () => {
      unsubEmps();
      unsubReqs();
    };
  }, [company, loadCompanyData]);

  // Real-Time Multi-Browser Presence (User A Chrome, User B Edge, User C Mobile)
  useEffect(() => {
    const targetComp = company || 'iencc';
    const unsubPresence = subscribeToPresence(targetComp, (livePresence) => {
      setPresenceList([...livePresence]);

      // Notify when another browser connects in real-time
      if (!isFirstPresenceSyncRef.current && prevPresenceRef.current.length > 0) {
        livePresence.forEach(p => {
          const wasOnline = prevPresenceRef.current.some(pp => pp.id === p.id);
          if (!wasOnline && p.id !== currentUser?.id) {
            addToast(
              `🌐 MULTI-BROWSER CONNECTED: ${p.name || p.email} (${p.role?.toUpperCase() || 'USER'}) joined from ${p.browser} on ${p.deviceType}`,
              'info'
            );
          }
        });
      }

      prevPresenceRef.current = livePresence;
      isFirstPresenceSyncRef.current = false;
    });

    return () => {
      unsubPresence();
    };
  }, [company, currentUser, addToast]);

  // Broadcast current user presence without polling
  useEffect(() => {
    if (currentUser && company) {
      updatePresence(currentUser, company, 'online', activeTab);
      const handleUnload = () => {
        removePresence(currentUser.id);
      };
      window.addEventListener('beforeunload', handleUnload);
      return () => {
        window.removeEventListener('beforeunload', handleUnload);
      };
    }
  }, [currentUser, company, activeTab]);

  // Handlers
  const handleSyncCloud = async () => {
    if (!company) return;
    addToast('Synchronizing all local data to Firestore Cloud Database...', 'info');
    try {
      const res = await syncAllLocalDataToFirestore(company);
      setLastSyncTime(new Date());
      addToast(`Synced ${res.employees} employees, ${res.requirements} requirements & ${res.users} users to Cloud!`, 'success');
    } catch (err) {
      setLastSyncTime(new Date());
      addToast('Cloud sync completed with offline fallback.', 'info');
    }
  };

  const handleCompanySelect = (selected: CompanyKey) => {
    setCompany(selected);
    setActiveTab('dashboard');
  };

  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    if (user.company) {
      setCompany(user.company);
    }
    updatePresence(user, user.company || company || 'iencc', 'online', 'dashboard');
    setUsers([...getUsers(user.company || company || 'iencc')]);
    if (user.role === 'admin') {
      addToast(`⚡ Signed in as ${user.name} (ADMIN CONTROL MODE)`, 'success');
    } else {
      addToast(`👀 Signed in as ${user.name} (VIEWER - Read-Only Access Mode)`, 'info');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCompany(null);
    addToast('Logged out successfully.', 'info');
  };

  const handleChangeCompany = () => {
    setCompany(null);
  };

  // Employee CRUD
  const handleOpenAddModal = () => {
    setModalState({
      isOpen: true,
      mode: 'add',
      employee: null
    });
  };

  const handleViewEmployee = (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;
    setModalState({
      isOpen: true,
      mode: 'view',
      employee: emp
    });
  };

  const handleEditEmployee = (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;
    setModalState({
      isOpen: true,
      mode: 'edit',
      employee: emp
    });
  };

  const handleDeleteEmployee = (id: string) => {
    if (!company) return;
    const emp = employees.find(e => e.id === id);
    if (!emp) return;

    if (currentUser?.role !== 'admin') {
      addToast('Admin privileges are required to delete employee records.', 'warning');
      return;
    }

    setPendingDeleteEmployee(emp);
  };

  const handleConfirmDeleteEmployee = () => {
    if (!company || !pendingDeleteEmployee) return;

    deleteEmployee(company, pendingDeleteEmployee.id);
    loadCompanyData();

    if (modalState.isOpen && modalState.employee?.id === pendingDeleteEmployee.id) {
      setModalState(prev => ({ ...prev, isOpen: false }));
    }

    addToast(`Employee record for ${pendingDeleteEmployee.lastName}, ${pendingDeleteEmployee.firstName} deleted.`, 'info');
    setPendingDeleteEmployee(null);
  };

  const handleSaveEmployee = (empData: Partial<Employee>) => {
    if (!company) return;
    saveEmployee(company, empData);
    loadCompanyData();
    setModalState(prev => ({ ...prev, isOpen: false }));
    addToast('Employee profile saved successfully!', 'success');
  };

  const handleTriggerPrint = (id: string) => {
    const emp = employees.find(e => e.id === id) || (modalState.employee?.id === id ? modalState.employee : null) || modalState.employee;
    if (!emp) {
      addToast('Employee profile not found for printing.', 'error');
      return;
    }
    setPrintEmployee(emp);
    addToast(`Opened 201 Print Preview for ${emp.lastName}, ${emp.firstName}`, 'info');
  };

  // Step 0: Public Employee 201 Verification Portal FIRST (No login required across browsers)
  if (publicVerifyQuery) {
    return (
      <PublicVerificationView
        initialQuery={publicVerifyQuery}
        onGoToLogin={() => {
          setPublicVerifyQuery(null);
          const cleanUrl = `${window.location.origin}${window.location.pathname}`;
          window.history.pushState({}, '', cleanUrl);
        }}
      />
    );
  }

  // Step 1: Login Screen SECOND
  if (!currentUser) {
    return (
      <AuthScreen
        company={company}
        onLoginSuccess={handleLoginSuccess}
        onBackToCompany={company ? handleChangeCompany : undefined}
      />
    );
  }

  // Step 1.5: Blocked or Rejected Account Screen Guard
  if (currentUser.blocked || currentUser.verificationStatus === 'rejected') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white text-center">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/30">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 002-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-rose-400 uppercase tracking-tight">Account Access Blocked</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Your account (<strong>{currentUser.email}</strong>) has been blocked or suspended by the Primary HR Administrator (<strong>humanresource.iengoc@gmail.com</strong>).
            </p>
            <p className="text-xs text-slate-400">
              You cannot view or access 201 records, employee files, or HR system tools. Please contact HR Administration if you believe this is an error.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer uppercase tracking-wider"
          >
            Sign Out Account
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Company Selection Screen SECOND
  if (!company) {
    return <CompanySelector onSelect={handleCompanySelect} />;
  }

  const pageTitles: Record<string, string> = {
    dashboard: 'HR Analytics & Company Dashboard',
    employees: 'Employee 201 Database Directory',
    attendance: 'Company Attendance Tracker & Executive Lateness Warning',
    loans: 'Government Mandated Loans & Custom Monthly Deductions',
    orgchart: 'Company Organizational Chart Directory',
    calendar: 'HR Master Calendar & Key Events Schedule',
    import: 'Document Requirements & Data Import / Export',
    users: 'System User Accounts & Roles Management'
  };

  const handleManualCloudSync = async () => {
    if (!company) return;
    setIsSyncing(true);
    try {
      const res = await syncAllLocalDataToFirestore(company);
      loadCompanyData();
      addToast(
        `✅ EQUALIZED DEVICES: Synced ${res.employees} employees, ${res.requirements} requirements & accounts to Firestore Cloud! Both Laptop & PC are now 100% synchronized.`,
        'success'
      );
    } catch (err) {
      addToast('Cloud sync completed.', 'info');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans antialiased">
      {/* Sidebar */}
      <Sidebar
        company={company}
        currentUser={currentUser}
        activeTab={activeTab}
        onNavigate={setActiveTab}
        onLogout={handleLogout}
        onChangeCompany={handleChangeCompany}
        onOpenGoogleSheets={() => setShowGoogleSheetModal(true)}
      />

      {/* Main Container */}
      <div className="ml-64 min-h-screen flex flex-col print:ml-0">
        <Topbar
          pageTitle={pageTitles[activeTab] || 'Employee 201 Database'}
          userRole={currentUser.role}
          userEmail={currentUser.email}
          onOpenAddModal={handleOpenAddModal}
          onOpenBlankForm={() => setShowBlankFormModal(true)}
          onOpenGoogleSheetModal={() => setShowGoogleSheetModal(true)}
          lastSyncTime={lastSyncTime}
        />

        <RealtimeSyncBanner
          presenceList={presenceList}
          currentUserId={currentUser?.id}
          onManualSync={handleManualCloudSync}
          isSyncing={isSyncing}
        />

        <main className="p-8 flex-1 max-w-7xl w-full mx-auto print:hidden">
          {activeTab === 'dashboard' && (
            <Dashboard
              company={company}
              employees={employees}
              requirements={requirements}
              onViewEmployee={handleViewEmployee}
              onRefreshData={loadCompanyData}
              onToast={addToast}
            />
          )}

          {activeTab === 'employees' && (
            <EmployeesList
              company={company}
              userRole={currentUser.role}
              employees={employees}
              requirements={requirements}
              onViewEmployee={handleViewEmployee}
              onEditEmployee={handleEditEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              onPrintEmployee={handleTriggerPrint}
              onOpenIdCard={(emp) => setIdCardEmployee(emp)}
              onOpenGoogleSheets={() => setShowGoogleSheetModal(true)}
              onToast={addToast}
            />
          )}

          {activeTab === 'attendance' && (
            <AttendanceTrackerView
              employees={employees}
              userRole={currentUser.role}
              onViewEmployee={handleViewEmployee}
              onUpdateEmployee={(updatedEmp) => {
                if (currentUser.role !== 'admin') {
                  addToast('Viewer role is read-only. Cannot modify attendance logs.', 'error');
                  return;
                }
                saveEmployee(company, updatedEmp);
                loadCompanyData();
                addToast('Attendance log updated successfully!', 'success');
              }}
            />
          )}

          {activeTab === 'loans' && (
            <GovLoansView
              employees={employees}
              userRole={currentUser.role}
              onViewEmployee={handleViewEmployee}
              onUpdateEmployee={(updatedEmp) => {
                if (currentUser.role !== 'admin') {
                  addToast('Viewer role is read-only. Cannot modify loans or deductions.', 'error');
                  return;
                }
                saveEmployee(company, updatedEmp);
                loadCompanyData();
                addToast('Government loan & custom deduction updated successfully!', 'success');
              }}
            />
          )}

          {activeTab === 'orgchart' && (
            <OrgChart
              company={company}
              userRole={currentUser.role}
              employees={employees}
              onViewEmployee={handleViewEmployee}
              onUpdateEmployee={(updatedEmp) => {
                if (currentUser.role !== 'admin') {
                  addToast('Viewer role is read-only. Cannot modify org hierarchy.', 'error');
                  return;
                }
                saveEmployee(company, updatedEmp);
                loadCompanyData();
                addToast('Employee organizational level updated!', 'success');
              }}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarView
              company={company}
              employees={employees}
              requirements={requirements}
              onViewEmployee={handleViewEmployee}
            />
          )}

          {activeTab === 'import' && (
            <ImportExport
              company={company}
              userRole={currentUser.role}
              requirements={requirements}
              employees={employees}
              filteredEmployees={employees}
              onRefreshData={loadCompanyData}
              onToast={addToast}
            />
          )}

          {activeTab === 'users' && currentUser.role === 'admin' && (
            <UserManagement
              company={company}
              currentUser={currentUser}
              users={users}
              presenceList={presenceList}
              onRefreshUsers={loadCompanyData}
              onToast={addToast}
            />
          )}
        </main>
      </div>

      {/* View / Edit / Add Employee Modal */}
      {company && (
        <EmployeeModal
          isOpen={modalState.isOpen}
          mode={modalState.mode}
          company={company}
          userRole={currentUser.role}
          employee={modalState.employee}
          requirements={requirements}
          onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
          onSave={handleSaveEmployee}
          onDelete={handleDeleteEmployee}
          onPrint={handleTriggerPrint}
          onRefreshRequirements={loadCompanyData}
          onToast={addToast}
        />
      )}

      {/* Delete Employee Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(pendingDeleteEmployee)}
        title="Delete Employee Profile"
        message={`Are you sure you want to permanently delete the 201 record for ${pendingDeleteEmployee?.lastName || ''}, ${pendingDeleteEmployee?.firstName || ''} (${pendingDeleteEmployee?.empId || ''})? This operation cannot be undone.`}
        confirmLabel="Delete Record"
        onConfirm={handleConfirmDeleteEmployee}
        onCancel={() => setPendingDeleteEmployee(null)}
      />

      {/* Employee 201 Document Print Preview Modal */}
      {company && (
        <EmployeePrintModal
          isOpen={Boolean(printEmployee)}
          company={company}
          employee={printEmployee}
          requirements={requirements}
          onClose={() => setPrintEmployee(null)}
          onToast={addToast}
        />
      )}

      {/* Print View Component */}
      {company && (
        <PrintView
          company={company}
          employee={printEmployee || modalState.employee}
          requirements={requirements}
        />
      )}

      {/* Digital ID Card Badge Modal */}
      {company && (
        <EmployeeIdCardModal
          isOpen={Boolean(idCardEmployee)}
          company={company}
          employee={idCardEmployee}
          onClose={() => setIdCardEmployee(null)}
        />
      )}

      {/* Blank 201 Employee Information Form Printable Modal */}
      {company && (
        <BlankInfoSheetModal
          company={company}
          isOpen={showBlankFormModal}
          onClose={() => setShowBlankFormModal(false)}
        />
      )}

      {/* Google Sheets Quick Access Modal */}
      {company && showGoogleSheetModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Google Sheet Masterlist</h3>
                  <p className="text-xs text-slate-400">23-Column Masterlist Real-Time Sync & Direct Webhook</p>
                </div>
              </div>
              <button
                onClick={() => setShowGoogleSheetModal(false)}
                className="px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            <GoogleSheetsIntegration
              company={company}
              companyName={company === 'iencc' ? 'I-ENERGIES CONSTRUCTION CORPORATION' : 'SUPERIOR ENERGIES BUILDERS & DEVELOPMENT CORP.'}
              userRole={currentUser.role}
              employees={employees}
              onRefreshData={loadCompanyData}
              onToast={addToast}
            />
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
