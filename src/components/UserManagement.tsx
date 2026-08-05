import React, { useState, useEffect } from 'react';
import { CompanyKey, UserAccount, UserRole, CollaboratorPresence } from '../types';
import { saveUser, toggleUserBlock, deleteUser, updateUserRole, fetchUsersFromFirestore, getDeletedUserEmails } from '../lib/db';
import { ConfirmModal } from './ConfirmModal';
import { UserPlus, ShieldCheck, User as UserIcon, Ban, CheckCircle, Trash2, XCircle, Tag, Clock, KeyRound, Mail, Search, CheckCircle2, RefreshCw, ShieldAlert } from 'lucide-react';

interface UserManagementProps {
  company: CompanyKey;
  currentUser: UserAccount;
  users: UserAccount[];
  presenceList?: CollaboratorPresence[];
  onRefreshUsers: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  company,
  currentUser,
  users,
  presenceList,
  onRefreshUsers,
  onToast
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('viewer');
  const [name, setName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingDeleteUser, setPendingDeleteUser] = useState<UserAccount | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchUsersFromFirestore(company).then(() => {
      onRefreshUsers();
    });
  }, [company, onRefreshUsers]);

  const handleSyncCloud = async () => {
    setIsSyncing(true);
    try {
      await fetchUsersFromFirestore(company);
      onRefreshUsers();
      onToast('Synchronized users list with Cloud Firestore!', 'success');
    } catch (e) {
      onToast('Sync completed using local storage.', 'info');
    } finally {
      setIsSyncing(false);
    }
  };

  const isOwner = currentUser.email.toLowerCase() === 'humanresource.iengoc@gmail.com' || currentUser.email.toLowerCase() === 'admn.iencc@gmail.com';

  const handleInviteUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      onToast('Please enter an email address.', 'error');
      return;
    }

    const assignedRole = isOwner ? role : 'viewer';
    if (!isOwner && role === 'admin') {
      onToast('Only Main Admin / Owner (humanresource.iengoc@gmail.com) can assign Admin role. Assigning Viewer role.', 'warning');
    }

    const newUser: UserAccount = {
      id: `usr_${company}_${Date.now()}`,
      name: name.trim() || email.split('@')[0],
      email: email.trim(),
      role: assignedRole,
      category: assignedRole === 'admin' ? 'HR Administration' : 'HR Specialist',
      verificationStatus: 'approved',
      company,
      emailVerified: true,
      blocked: false,
      password: 'admin123',
      createdAt: new Date().toISOString()
    };

    saveUser(company, newUser);
    setEmail('');
    setName('');
    onRefreshUsers();
    onToast(`Added user ${newUser.email} as ${assignedRole} (default password: admin123)`, 'success');
  };

  const handleApproveUser = (user: UserAccount) => {
    if (!isOwner) {
      onToast('Only Main Admin / Owner (humanresource.iengoc@gmail.com) is authorized to approve user registrations.', 'error');
      return;
    }
    const updated = { ...user, approved: true, verificationStatus: 'approved' as const };
    saveUser(company, updated);
    onRefreshUsers();
    onToast(`Approved HR access for ${user.email} (${user.category || 'User'})!`, 'success');
  };

  const handleRejectUser = (user: UserAccount) => {
    if (!isOwner) {
      onToast('Only Main Admin / Owner (humanresource.iengoc@gmail.com) is authorized to reject user registrations.', 'error');
      return;
    }
    const updated = { ...user, approved: false, verificationStatus: 'rejected' as const };
    saveUser(company, updated);
    onRefreshUsers();
    onToast(`Declined registration for ${user.email}.`, 'info');
  };

  const handleResetUserPassword = (user: UserAccount) => {
    if (!isOwner) {
      onToast('Only Main Admin / Owner (humanresource.iengoc@gmail.com) can reset user passwords.', 'error');
      return;
    }
    const updated = {
      ...user,
      password: 'admin123',
      passwordResetAt: new Date().toISOString()
    };
    saveUser(company, updated);
    onRefreshUsers();
    onToast(`Reset password for ${user.email} to "admin123"`, 'success');
  };

  const handleToggleBlock = (user: UserAccount) => {
    if (!isOwner) {
      onToast('Only Main Admin / Owner (humanresource.iengoc@gmail.com) is authorized to block or unblock accounts.', 'error');
      return;
    }
    if (user.id === currentUser.id) {
      onToast('You cannot block your own account.', 'error');
      return;
    }
    if (user.email.toLowerCase() === 'humanresource.iengoc@gmail.com') {
      onToast('You cannot block the Primary HR Owner account.', 'error');
      return;
    }

    const nextState = !user.blocked;
    toggleUserBlock(company, user.id, nextState);
    onRefreshUsers();
    onToast(nextState ? `Blocked ${user.email}.` : `Unblocked ${user.email}.`, 'info');
  };

  const handleToggleRole = (user: UserAccount) => {
    if (!isOwner) {
      onToast('Only Main Admin / Owner (humanresource.iengoc@gmail.com) is authorized to change user roles (Admin/Viewer).', 'error');
      return;
    }
    if (user.id === currentUser.id) {
      onToast('You cannot change your own role.', 'error');
      return;
    }
    if (user.email.toLowerCase() === 'humanresource.iengoc@gmail.com') {
      onToast('Primary HR Owner (humanresource.iengoc@gmail.com) must remain ADMIN.', 'error');
      return;
    }

    const nextRole: UserRole = user.role === 'admin' ? 'viewer' : 'admin';
    updateUserRole(company, user.id, nextRole);
    onRefreshUsers();
    onToast(`Updated ${user.email} role to ${nextRole.toUpperCase()}.`, 'success');
  };

  const handleDeleteUser = (user: UserAccount) => {
    if (!isOwner) {
      onToast('Only Main Admin / Owner (humanresource.iengoc@gmail.com) is authorized to remove accounts.', 'error');
      return;
    }
    if (user.id === currentUser.id) {
      onToast('You cannot delete your own account.', 'error');
      return;
    }
    if (user.email.toLowerCase() === 'humanresource.iengoc@gmail.com') {
      onToast('Primary HR Owner account cannot be removed.', 'error');
      return;
    }

    setPendingDeleteUser(user);
  };

  const handleConfirmDeleteUser = () => {
    if (!pendingDeleteUser) return;

    deleteUser(company, pendingDeleteUser.id);
    onRefreshUsers();
    onToast(`Removed user account ${pendingDeleteUser.email}.`, 'info');
    setPendingDeleteUser(null);
  };

  const displayUsersMap = new Map<string, UserAccount>();
  const deletedEmails = getDeletedUserEmails();

  // Add all saved / registered users (excluding deleted ones)
  users.forEach(u => {
    if (!deletedEmails.includes(u.email.toLowerCase())) {
      displayUsersMap.set(u.email.toLowerCase(), u);
    }
  });

  // Merge any online presence users not yet in users list (excluding deleted ones)
  presenceList.forEach(p => {
    if (p.email && !deletedEmails.includes(p.email.toLowerCase()) && !displayUsersMap.has(p.email.toLowerCase())) {
      const pEmail = p.email.toLowerCase();
      const isOwner = pEmail === 'humanresource.iengoc@gmail.com' || pEmail === 'admn.iencc@gmail.com';
      displayUsersMap.set(pEmail, {
        id: p.id || `usr_presence_${pEmail}`,
        name: p.name || p.email.split('@')[0],
        email: p.email,
        role: isOwner ? 'admin' : 'viewer',
        company: company,
        emailVerified: true,
        blocked: Boolean(p.blocked),
        verificationStatus: isOwner ? 'approved' : 'pending',
        category: isOwner ? 'HR Administration' : 'HR Specialist'
      });
    }
  });

  const combinedUsers = Array.from(displayUsersMap.values()).filter(
    u => !deletedEmails.includes(u.email.toLowerCase())
  );

  const filteredUsers = combinedUsers.filter(u => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      (u.category && u.category.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const pendingCount = combinedUsers.filter(u => u.verificationStatus === 'pending').length;

  return (
    <div className="space-y-6">
      {!isOwner && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-amber-900 text-xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold block text-amber-950">Protected Ownership Rights</span>
            <span>Only the Main Owner / Admin (<strong>humanresource.iengoc@gmail.com</strong>) is authorized to assign Admin/Viewer roles, approve registrations, or block/unblock accounts.</span>
          </div>
        </div>
      )}

      {/* Invite Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <h3 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-blue-600" /> Invite / Add New User
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Grant access to colleagues for this company database. Admins have full edit permissions. Default password for new accounts is <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-bold">admin123</span>.
        </p>

        <form onSubmit={handleInviteUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full Name (optional)"
            className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none"
          />

          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="User Email Address"
            className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none"
          />

          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none bg-white"
          >
            <option value="viewer">Viewer Role</option>
            <option value="admin">Admin Role</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Add User
          </button>
        </form>
      </div>

      {/* Users List & Filter */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm">Authorized Users & HR Registrations</h3>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                  {pendingCount} Pending Verification
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Verify login emails, approve HR Specialist registrations, and manage password resets
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-80">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user email or name..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
              />
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No HRIS user accounts found matching your search.
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSelf = u.id === currentUser.id;
              const isPending = u.verificationStatus === 'pending';
              const isRejected = u.verificationStatus === 'rejected';

              return (
                <div
                  key={u.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    u.blocked ? 'bg-rose-50/50' : isPending ? 'bg-amber-50/60 border-l-4 border-l-amber-500' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full font-black text-xs text-white flex items-center justify-center shrink-0 ${
                      u.role === 'admin' ? 'bg-blue-600' : isPending ? 'bg-amber-500' : 'bg-slate-600'
                    }`}>
                      {u.name.charAt(0).toUpperCase() || 'U'}
                    </div>

                    <div>
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-bold text-slate-900 text-xs">{u.name}</span>
                        {(() => {
                          const isOnline = presenceList?.some(
                            p => p.email?.toLowerCase() === u.email.toLowerCase() || p.id === u.id || p.name?.toLowerCase() === u.name.toLowerCase()
                          );
                          return isOnline ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white flex items-center gap-1.5 shadow-xs animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-white inline-block"></span>
                              ONLINE (ACTIVE)
                            </span>
                          ) : null;
                        })()}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {u.role.toUpperCase()}
                        </span>
                        {u.category && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 flex items-center gap-1">
                            <Tag className="w-2.5 h-2.5" /> {u.category}
                          </span>
                        )}
                        {isPending && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 flex items-center gap-1 border border-amber-300">
                            <Clock className="w-2.5 h-2.5" /> PENDING HR APPROVAL
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            REJECTED
                          </span>
                        )}
                        {u.blocked && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            BLOCKED
                          </span>
                        )}
                        {isSelf && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            YOU
                          </span>
                        )}
                        {u.passwordResetAt && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 flex items-center gap-1" title={`Password updated on ${new Date(u.passwordResetAt).toLocaleString()}`}>
                            <KeyRound className="w-2.5 h-2.5" /> PWD RESET
                          </span>
                        )}
                      </div>

                      {/* Prominent Login Email Display */}
                      <div className="mt-1 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                          {u.email}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center flex-wrap gap-2 self-end sm:self-auto">
                    {isPending && isOwner && (
                      <>
                        <button
                          onClick={() => handleApproveUser(u)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Approve User Sign-In"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve Registration
                        </button>
                        <button
                          onClick={() => handleRejectUser(u)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Reject User Sign-In"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Decline
                        </button>
                      </>
                    )}

                    {!isSelf && isOwner && (
                      <>
                        <button
                          onClick={() => handleResetUserPassword(u)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          title="Reset password to default admin123"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-slate-600" />
                          <span>Reset Pwd</span>
                        </button>

                        {u.email.toLowerCase() !== 'humanresource.iengoc@gmail.com' && (
                          <>
                            <button
                              onClick={() => handleToggleRole(u)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                                u.role === 'admin'
                                  ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                                  : 'bg-indigo-100 text-indigo-900 hover:bg-indigo-200'
                              }`}
                              title={`Change Role from ${u.role.toUpperCase()} to ${u.role === 'admin' ? 'VIEWER' : 'ADMIN'}`}
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Make {u.role === 'admin' ? 'Viewer' : 'Admin'}</span>
                            </button>

                            <button
                              onClick={() => handleToggleBlock(u)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                                u.blocked
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                              }`}
                            >
                              {u.blocked ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                              <span>{u.blocked ? 'Unblock' : 'Block'}</span>
                            </button>

                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </>
                    )}

                    {!isOwner && !isSelf && (
                      <span className="text-[11px] text-slate-400 font-medium italic px-2 py-1 bg-slate-100 rounded-md">
                        Owner Controls Reserved
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(pendingDeleteUser)}
        title="Remove Authorized User"
        message={`Are you sure you want to remove user ${pendingDeleteUser?.email || ''}? They will no longer be able to log in to this company database.`}
        confirmLabel="Remove User"
        onConfirm={handleConfirmDeleteUser}
        onCancel={() => setPendingDeleteUser(null)}
      />
    </div>
  );
};

