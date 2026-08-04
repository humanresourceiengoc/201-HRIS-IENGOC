import React, { useState, useEffect } from 'react';
import { CompanyKey, DocumentRequirement, Employee, EmployeeDocument, SalaryRecord, EmployeeMemo, UserRole, GovLoanRecord, AttendanceRecord, WorkExperience } from '../types';
import { saveFileToStorage, saveRequirement, updateRequirement, deleteRequirement, deleteFileFromStorage } from '../lib/db';
import { getProbationaryStatus, checkMissingGovIds, compressImageToDataUrl } from '../lib/hrUtils';
import { FileViewerModal } from './FileViewerModal';
import { ConfirmModal } from './ConfirmModal';
import { X, Printer, Upload, FileText, Image as ImageIcon, ExternalLink, Download, Plus, Trash2, CheckCircle2, Clock, Eye, DollarSign, TrendingUp, AlertOctagon, Award, ShieldAlert, FileSpreadsheet, Check, Pencil, Paperclip, CreditCard, AlertTriangle, Calendar, Landmark, UserCheck, Briefcase } from 'lucide-react';

interface EmployeeModalProps {
  isOpen: boolean;
  mode: 'view' | 'edit' | 'add';
  company: CompanyKey;
  userRole: UserRole;
  employee: Employee | null;
  requirements: DocumentRequirement[];
  onClose: () => void;
  onSave: (employee: Partial<Employee>) => void;
  onDelete?: (id: string) => void;
  onPrint: (id: string) => void;
  onRefreshRequirements: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const EmployeeModal: React.FC<EmployeeModalProps> = ({
  isOpen,
  mode,
  company,
  userRole,
  employee,
  requirements,
  onClose,
  onSave,
  onDelete,
  onPrint,
  onRefreshRequirements,
  onToast
}) => {
  const [formData, setFormData] = useState<Partial<Employee>>({});
  const [documents, setDocuments] = useState<Record<string, EmployeeDocument>>({});
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const [newReqName, setNewReqName] = useState<string>('');
  const [editingReqId, setEditingReqId] = useState<string | null>(null);
  const [editingReqName, setEditingReqName] = useState<string>('');

  // Modals for adding Salary Increase & Memos
  const [showSalaryModal, setShowSalaryModal] = useState<boolean>(false);
  const [salaryForm, setSalaryForm] = useState<{
    effectiveDate: string;
    newSalary: string;
    reason: string;
    approvedBy: string;
  }>({
    effectiveDate: new Date().toISOString().split('T')[0],
    newSalary: '',
    reason: 'Regularization Salary Adjustment',
    approvedBy: 'HR Manager'
  });

  const [showMemoModal, setShowMemoModal] = useState<boolean>(false);
  const [memoForm, setMemoForm] = useState<{
    memoNo: string;
    dateIssued: string;
    type: 'Notice' | 'Warning' | 'Commendation' | 'Violation' | 'Policy';
    title: string;
    details: string;
    issuedBy: string;
    filename?: string;
    dataUrl?: string;
  }>({
    memoNo: '',
    dateIssued: new Date().toISOString().split('T')[0],
    type: 'Notice',
    title: '',
    details: '',
    issuedBy: 'HR Department'
  });

  // Gov Mandated Loans with Custom Monthly Deduction
  const [showLoanModal, setShowLoanModal] = useState<boolean>(false);
  const [loanForm, setLoanForm] = useState<{
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
    loanAmount: '',
    monthlyDeduction: '',
    startDate: new Date().toISOString().split('T')[0],
    status: 'ACTIVE',
    remarks: ''
  });

  // Attendance & Punctuality Tracker state
  const [showAttendanceModal, setShowAttendanceModal] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);
  const [attendanceForm, setAttendanceForm] = useState<{
    date: string;
    timeIn: string;
    timeOut: string;
    status: string;
    minutesLate: string;
    notes: string;
  }>({
    date: new Date().toISOString().split('T')[0],
    timeIn: '08:00 AM',
    timeOut: '05:00 PM',
    status: 'LATE',
    minutesLate: '15',
    notes: ''
  });

  // Work Experience state
  const [showWorkExpModal, setShowWorkExpModal] = useState<boolean>(false);
  const [workExpForm, setWorkExpForm] = useState<{
    companyName: string;
    position: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    departmentOrIndustry: string;
    reasonForLeaving: string;
    responsibilities: string;
    salary: string;
  }>({
    companyName: '',
    position: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    departmentOrIndustry: '',
    reasonForLeaving: '',
    responsibilities: '',
    salary: ''
  });

  // Active File Viewer Modal
  const [activeViewer, setActiveViewer] = useState<{
    isOpen: boolean;
    title: string;
    filename: string;
    fileIdOrUrl?: string;
    mimeType?: string;
    notes?: string;
    uploadedAt?: string;
  }>({
    isOpen: false,
    title: '',
    filename: '',
  });

  // Local Confirmation Modal state for safe deletion
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const isReadOnly = mode === 'view' || userRole !== 'admin';

  useEffect(() => {
    if (employee && (mode === 'view' || mode === 'edit')) {
      setFormData({ ...employee });
      setDocuments(employee.documents ? { ...employee.documents } : {});
    } else {
      // Add mode reset
      setFormData({
        status: 'ACTIVE',
        classification: 'Regular',
        civilStatus: 'Single',
        gender: 'MALE',
        monthlySalary: 0,
        salaryHistory: [],
        memos: [],
        docExpiries: {},
        documents: {}
      });
      setDocuments({});
    }
  }, [employee, mode, isOpen]);

  if (!isOpen) return null;

  // Form input handler
  const handleChange = (field: keyof Employee, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      // Auto-calculate Tenure and sync Resignation/Separation Status
      if (field === 'dateHired' || field === 'separationDate' || field === 'resignationDate') {
        const hired = updated.dateHired;
        const sepDate = value ? String(value) : '';
        updated.separationDate = sepDate;
        updated.resignationDate = sepDate;

        if (hired) {
          const start = new Date(hired);
          const end = sepDate ? new Date(sepDate) : new Date();
          if (!isNaN(start.getTime())) {
            let years = end.getFullYear() - start.getFullYear();
            let months = end.getMonth() - start.getMonth();
            if (months < 0) {
              years--;
              months += 12;
            }
            if (end.getDate() < start.getDate() && months > 0) {
              months--;
            }
            updated.tenures = `${years}yr ${months}mo`;
          }
        }

        if (sepDate) {
          const reason = (updated.separationReason || '').toLowerCase();
          if (reason.includes('awol') || reason.includes('contract') || reason.includes('termination') || reason.includes('redundancy')) {
            updated.status = 'SEPARATED';
          } else {
            updated.status = 'RESIGNED';
          }
          const calc30Days = new Date(new Date(sepDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          updated.lastPayScheduleDate = calc30Days;
        } else if (updated.status === 'RESIGNED' || updated.status === 'SEPARATED') {
          updated.status = 'ACTIVE';
        }
      }

      if (field === 'separationReason') {
        const reason = (value || '').toLowerCase();
        if (updated.separationDate || updated.resignationDate) {
          if (reason.includes('awol') || reason.includes('contract') || reason.includes('termination') || reason.includes('redundancy')) {
            updated.status = 'SEPARATED';
          } else {
            updated.status = 'RESIGNED';
          }
        }
      }

      // Auto-calculate Age
      if (field === 'birthdate') {
        if (value) {
          const birth = new Date(value);
          const today = new Date();
          let age = today.getFullYear() - birth.getFullYear();
          const m = today.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
          }
          updated.age = age > 0 ? age : '';
        }
      }

      return updated;
    });
  };

  // Photo Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onToast('Please select a valid image file.', 'error');
      return;
    }

    try {
      setUploadingPhoto(true);
      // Read directly as Data URL for permanent cross-session persistence
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      setFormData(prev => ({
        ...prev,
        photoUrl: dataUrl
      }));
      setImgError(false);
      onToast('Employee photo updated successfully!', 'success');
    } catch (err: any) {
      onToast(err.message || 'Failed to upload photo.', 'error');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  // Document Upload
  const handleDocUpload = async (reqId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingDoc(reqId);
      const fileRes = await saveFileToStorage(file, file.name);

      const docObj: EmployeeDocument = {
        reqId,
        url: fileRes.url,
        fileId: fileRes.fileId,
        filename: fileRes.filename,
        mimeType: fileRes.mimeType,
        size: fileRes.size,
        uploadedAt: new Date().toISOString(),
        notes: documents[reqId]?.notes || ''
      };

      setDocuments(prev => ({
        ...prev,
        [reqId]: docObj
      }));

      onToast(`Uploaded document for ${file.name}!`, 'success');
    } catch (err: any) {
      onToast(err.message || 'Failed to upload document.', 'error');
    } finally {
      setUploadingDoc(null);
      e.target.value = '';
    }
  };

  const handleDocNoteChange = (reqId: string, note: string) => {
    setDocuments(prev => ({
      ...prev,
      [reqId]: {
        ...(prev[reqId] || { reqId, filename: '', uploadedAt: new Date().toISOString() }),
        notes: note
      }
    }));
  };

  const handleRemoveDoc = (reqId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Document',
      message: 'Are you sure you want to remove this document attachment from the employee profile?',
      onConfirm: () => {
        setDocuments(prev => {
          const next = { ...prev };
          delete next[reqId];
          return next;
        });
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        onToast('Document removed.', 'info');
      }
    });
  };

  // Add Custom Requirement in Modal
  const handleAddCustomReq = () => {
    if (!newReqName.trim()) return;
    saveRequirement(company, newReqName.trim());
    setNewReqName('');
    onRefreshRequirements();
    onToast('Requirement added to database!', 'success');
  };

  // Edit requirement name
  const handleSaveRequirementEdit = (reqId: string) => {
    if (!editingReqName.trim()) return;
    updateRequirement(company, reqId, editingReqName.trim());
    setEditingReqId(null);
    onRefreshRequirements();
    onToast('Requirement updated!', 'success');
  };

  // Delete requirement
  const handleDeleteRequirementItem = (reqId: string, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Requirement Category',
      message: `Are you sure you want to delete requirement category "${name}"? This will remove it for all employees.`,
      onConfirm: () => {
        deleteRequirement(company, reqId);
        onRefreshRequirements();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        onToast(`Requirement "${name}" deleted.`, 'info');
      }
    });
  };

  // Delete Individual Memo
  const handleDeleteMemo = (memoId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Memo Record',
      message: 'Are you sure you want to delete this memo notice from the employee record?',
      onConfirm: () => {
        setFormData(prev => ({
          ...prev,
          memos: (prev.memos || []).filter(m => m.id !== memoId)
        }));
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        onToast('Memo deleted.', 'info');
      }
    });
  };

  // Delete Salary History Record
  const handleDeleteSalaryRecord = (salId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Salary History Item',
      message: 'Are you sure you want to delete this salary increase entry from history?',
      onConfirm: () => {
        setFormData(prev => ({
          ...prev,
          salaryHistory: (prev.salaryHistory || []).filter(s => s.id !== salId)
        }));
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        onToast('Salary record deleted from history.', 'info');
      }
    });
  };

  // Salary Increase Handler
  const handleLogSalaryIncrease = () => {
    const newSalNum = parseFloat(salaryForm.newSalary);
    if (isNaN(newSalNum) || newSalNum <= 0) {
      onToast('Please enter a valid new monthly salary amount.', 'error');
      return;
    }

    const currentSal = formData.monthlySalary || 0;
    const newRecord: SalaryRecord = {
      id: `sal_${Date.now()}`,
      effectiveDate: salaryForm.effectiveDate,
      previousSalary: currentSal,
      newSalary: newSalNum,
      reason: salaryForm.reason || 'Salary Adjustment',
      approvedBy: salaryForm.approvedBy || 'HR Admin'
    };

    const updatedHistory = [newRecord, ...(formData.salaryHistory || [])];
    setFormData(prev => ({
      ...prev,
      monthlySalary: newSalNum,
      salaryHistory: updatedHistory
    }));

    setShowSalaryModal(false);
    onToast(`Salary increase logged! New monthly salary is ₱${newSalNum.toLocaleString()}`, 'success');
  };

  const handleMemoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setMemoForm(prev => ({
        ...prev,
        filename: file.name,
        dataUrl: ev.target?.result as string
      }));
      onToast(`Attached file: ${file.name} from local storage`, 'info');
    };
    reader.readAsDataURL(file);
  };

  // Issue Memo Handler
  const handleIssueMemo = () => {
    if (!memoForm.title.trim() || !memoForm.details.trim()) {
      onToast('Memo title and details are required.', 'error');
      return;
    }

    const memoNo = memoForm.memoNo || `MEMO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const newMemo: EmployeeMemo = {
      id: `memo_${Date.now()}`,
      memoNo,
      dateIssued: memoForm.dateIssued,
      type: memoForm.type,
      title: memoForm.title,
      details: memoForm.details,
      issuedBy: memoForm.issuedBy || 'HR Lead',
      filename: memoForm.filename,
      dataUrl: memoForm.dataUrl
    };

    const updatedMemos = [newMemo, ...(formData.memos || [])];
    setFormData(prev => ({
      ...prev,
      memos: updatedMemos
    }));

    setShowMemoModal(false);
    setMemoForm({
      memoNo: '',
      dateIssued: new Date().toISOString().split('T')[0],
      type: 'Notice',
      title: '',
      details: '',
      issuedBy: 'HR Department',
      filename: undefined,
      dataUrl: undefined
    });
    onToast(`Issued Memo #${memoNo} successfully!`, 'success');
  };

  // Save Government Loan / Mandate Deduction
  const handleSaveLoan = () => {
    const loanAmountNum = parseFloat(loanForm.loanAmount) || 0;
    const monthlyDedNum = parseFloat(loanForm.monthlyDeduction) || 0;

    if (!loanForm.type.trim() || monthlyDedNum <= 0) {
      onToast('Please provide loan type and a valid custom monthly deduction amount.', 'error');
      return;
    }

    const newLoan: GovLoanRecord = {
      id: `loan_${Date.now()}`,
      type: loanForm.type,
      referenceNo: loanForm.referenceNo || `REF-${Math.floor(1000 + Math.random() * 9000)}`,
      loanAmount: loanAmountNum,
      monthlyDeduction: monthlyDedNum,
      startDate: loanForm.startDate,
      status: loanForm.status,
      remarks: loanForm.remarks || 'Custom monthly deduction setup by HR'
    };

    const updatedLoans = [newLoan, ...(formData.govLoans || [])];
    setFormData(prev => ({
      ...prev,
      govLoans: updatedLoans
    }));

    setShowLoanModal(false);
    setLoanForm({
      type: 'SSS Salary Loan',
      referenceNo: '',
      loanAmount: '',
      monthlyDeduction: '',
      startDate: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
      remarks: ''
    });
    onToast(`Added Gov Mandate Loan (${loanForm.type}) with custom monthly deduction of ₱${monthlyDedNum.toLocaleString()}!`, 'success');
  };

  // Delete Gov Loan
  const handleDeleteLoan = (loanId: string) => {
    setFormData(prev => ({
      ...prev,
      govLoans: (prev.govLoans || []).filter(l => l.id !== loanId)
    }));
    onToast('Government loan record removed.', 'info');
  };

  // Save Attendance / Late Record
  const handleSaveAttendance = () => {
    const minLate = parseInt(attendanceForm.minutesLate, 10) || 0;

    const newAtt: AttendanceRecord = {
      id: `att_${Date.now()}`,
      date: attendanceForm.date,
      timeIn: attendanceForm.timeIn || '08:00 AM',
      timeOut: attendanceForm.timeOut || '05:00 PM',
      status: attendanceForm.status,
      minutesLate: minLate,
      notes: attendanceForm.notes || (minLate > 0 ? `${minLate} mins late` : 'On time')
    };

    const updatedAtt = [newAtt, ...(formData.attendanceRecords || [])].sort((a, b) => b.date.localeCompare(a.date));
    setFormData(prev => ({
      ...prev,
      attendanceRecords: updatedAtt
    }));

    setShowAttendanceModal(false);
    setAttendanceForm({
      date: new Date().toISOString().split('T')[0],
      timeIn: '08:00 AM',
      timeOut: '05:00 PM',
      status: 'LATE',
      minutesLate: '15',
      notes: ''
    });
    onToast(`Logged attendance record for ${attendanceForm.date}.`, 'success');
  };

  // Delete Attendance Record
  const handleDeleteAttendance = (attId: string) => {
    setFormData(prev => ({
      ...prev,
      attendanceRecords: (prev.attendanceRecords || []).filter(a => a.id !== attId)
    }));
    onToast('Attendance record removed.', 'info');
  };

  // Save Work Experience
  const handleSaveWorkExperience = () => {
    if (!workExpForm.companyName.trim() || !workExpForm.position.trim()) {
      onToast('Please enter both Company Name and Position.', 'error');
      return;
    }

    const newExp: WorkExperience = {
      id: `we_${Date.now()}`,
      companyName: workExpForm.companyName.trim(),
      position: workExpForm.position.trim(),
      startDate: workExpForm.startDate || '—',
      endDate: workExpForm.isCurrent ? 'Present' : (workExpForm.endDate || '—'),
      isCurrent: workExpForm.isCurrent,
      departmentOrIndustry: workExpForm.departmentOrIndustry.trim() || '—',
      reasonForLeaving: workExpForm.reasonForLeaving.trim() || '—',
      responsibilities: workExpForm.responsibilities.trim() || '—',
      salary: workExpForm.salary.trim() || '—'
    };

    const updatedWE = [newExp, ...(formData.workExperience || [])];
    setFormData(prev => ({
      ...prev,
      workExperience: updatedWE
    }));

    setShowWorkExpModal(false);
    setWorkExpForm({
      companyName: '',
      position: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      departmentOrIndustry: '',
      reasonForLeaving: '',
      responsibilities: '',
      salary: ''
    });
    onToast(`Added Work Experience at ${newExp.companyName}!`, 'success');
  };

  // Delete Work Experience
  const handleDeleteWorkExperience = (weId: string) => {
    setFormData(prev => ({
      ...prev,
      workExperience: (prev.workExperience || []).filter(w => w.id !== weId)
    }));
    onToast('Work experience record removed.', 'info');
  };

  // Calculate consecutive executive days late
  const calculateConsecutiveLateDays = () => {
    const records = [...(formData.attendanceRecords || [])].sort((a, b) => b.date.localeCompare(a.date));
    let count = 0;
    for (const rec of records) {
      if (rec.status === 'LATE' || rec.status === 'EXECUTIVE_LATE' || (rec.minutesLate && rec.minutesLate > 0)) {
        count++;
      } else if (rec.status === 'PRESENT') {
        break;
      }
    }
    return count;
  };
  const consecutiveLateCount = calculateConsecutiveLateDays();

  // Approve Probationary Regularization
  const handleApproveRegularization = () => {
    if (!confirm('Are you sure you want to approve this employee for 6-Month Regularization? Classification will be changed to Regular.')) return;

    setFormData(prev => ({
      ...prev,
      classification: 'Regular',
      perfReviews: {
        ...(prev.perfReviews || { month3Done: true }),
        month5Done: true,
        month5Notes: prev.perfReviews?.month5Notes || 'Approved for 6-Month Regularization by HR'
      }
    }));
    onToast('Employee approved and updated to Regular Classification!', 'success');
  };

  // Doc Expiry date change
  const handleExpiryDateChange = (docKey: string, dateVal: string) => {
    setFormData(prev => ({
      ...prev,
      docExpiries: {
        ...(prev.docExpiries || {}),
        [docKey]: dateVal
      }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.empId?.trim() || !formData.lastName?.trim() || !formData.firstName?.trim()) {
      onToast('Employee ID, Last Name, and First Name are required fields.', 'error');
      return;
    }

    onSave({
      ...formData,
      documents
    });
  };

  // Open file in FileViewerModal
  const openViewer = (reqName: string, docData: EmployeeDocument) => {
    setActiveViewer({
      isOpen: true,
      title: `${reqName} - ${formData.firstName || ''} ${formData.lastName || ''}`,
      filename: docData.filename,
      fileIdOrUrl: docData.fileId || docData.url,
      mimeType: docData.mimeType,
      notes: docData.notes,
      uploadedAt: docData.uploadedAt
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
        <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <h2 className="text-lg font-bold">
              {mode === 'add' ? 'Add New Employee' : mode === 'edit' ? 'Edit Employee Record' : 'Employee 201 Record'}
            </h2>

            <div className="flex items-center gap-2">
              {(employee?.id || formData?.id) && (
                <button
                  type="button"
                  onClick={() => onPrint(formData.id || employee?.id || '')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                  title="Print Employee 201 File"
                >
                  <Printer className="w-4 h-4 text-blue-400" /> Print Record
                </button>
              )}

              {employee?.id && userRole === 'admin' && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(employee.id)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Delete this employee record"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Profile
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
            {/* Photo Section */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center gap-6">
              <div className="relative group shrink-0">
                {formData.photoUrl && !imgError ? (
                  <img
                    src={formData.photoUrl}
                    alt="Employee Photo"
                    className="w-24 h-24 rounded-full object-cover border-4 border-slate-100 shadow-md"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-2xl font-black border-4 border-slate-100 shadow-md">
                    {`${formData.firstName?.[0] || ''}${formData.lastName?.[0] || ''}` || 'EM'}
                  </div>
                )}
              </div>

              <div className="flex-1 text-center sm:text-left space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">Employee Profile Image</h4>
                <p className="text-xs text-slate-500">Upload a clear passport/ID photo (PNG, JPG, WebP)</p>

                {!isReadOnly && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <label className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors inline-flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingPhoto ? 'Uploading...' : 'Upload Image'}</span>
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploadingPhoto} />
                    </label>

                    {formData.photoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          handleChange('photoUrl', '');
                          handleChange('photoFileId', '');
                          setImgError(false);
                          onToast('Profile photo removed', 'info');
                        }}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Remove Photo</span>
                      </button>
                    )}

                    <input
                      type="text"
                      value={formData.photoUrl || ''}
                      onChange={(e) => {
                        setImgError(false);
                        handleChange('photoUrl', e.target.value);
                      }}
                      placeholder="Or paste photo URL..."
                      className="px-3 py-2 border border-slate-300 rounded-xl text-xs flex-1 min-w-[200px] outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Basic Information */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-blue-700 mb-4 pb-2 border-b border-slate-100">
                Basic Employment Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Employee ID *</label>
                  <input
                    type="text"
                    required
                    readOnly={isReadOnly}
                    value={formData.empId || ''}
                    onChange={(e) => handleChange('empId', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    readOnly={isReadOnly}
                    value={formData.lastName || ''}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    readOnly={isReadOnly}
                    value={formData.firstName || ''}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Middle Name</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.middleName || ''}
                    onChange={(e) => handleChange('middleName', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Suffix (e.g. Jr., Sr., III)</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.suffix || ''}
                    onChange={(e) => handleChange('suffix', e.target.value)}
                    placeholder="e.g. Jr., Sr., III, II, PhD"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Date Hired</label>
                  <input
                    type="date"
                    readOnly={isReadOnly}
                    value={formData.dateHired || ''}
                    onChange={(e) => handleChange('dateHired', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Department</label>
                  <div className="relative">
                    <input
                      type="text"
                      list="department-suggestions"
                      readOnly={isReadOnly}
                      value={formData.department || ''}
                      onChange={(e) => handleChange('department', e.target.value)}
                      placeholder="e.g. Operations, Human Resources, Finance..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                    />
                    <datalist id="department-suggestions">
                      <option value="Operations" />
                      <option value="Administration" />
                      <option value="Human Resources" />
                      <option value="Finance & Accounting" />
                      <option value="IT & Technical Services" />
                      <option value="Sales & Marketing" />
                      <option value="Logistics & Warehouse" />
                      <option value="Maintenance & Engineering" />
                      <option value="Safety & Quality Control" />
                      <option value="Executive Management" />
                      <option value="Customer Support" />
                    </datalist>
                  </div>
                  {!isReadOnly && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {['Operations', 'HR', 'Finance', 'IT', 'Logistics', 'Admin'].map(dept => (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => handleChange('department', dept === 'HR' ? 'Human Resources' : dept === 'IT' ? 'IT & Technical Services' : dept)}
                          className="px-1.5 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded text-[10px] font-medium transition-colors"
                        >
                          + {dept}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Position</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.position || ''}
                    onChange={(e) => handleChange('position', e.target.value)}
                    placeholder="e.g. Operations Manager, Accountant..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                {/* Classic Hierarchy Level / Org Level */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Classic Hierarchy Level / Tier</label>
                  <div className="relative">
                    <input
                      type="text"
                      list="org-level-suggestions"
                      readOnly={isReadOnly}
                      value={formData.orgLevel || ''}
                      onChange={(e) => handleChange('orgLevel', e.target.value)}
                      placeholder="e.g. 1 - Executive Leadership, Custom..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    <datalist id="org-level-suggestions">
                      <option value="1 - Executive Leadership" />
                      <option value="2 - Managers & Supervisors" />
                      <option value="3 - Senior Specialists & Leads" />
                      <option value="4 - Rank & File Staff" />
                      <option value="5 - Consultants & Advisory" />
                      <option value="6 - Field & Project Workers" />
                      <option value="Custom" />
                    </datalist>
                  </div>
                  {!isReadOnly && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {['1 - Executive', '2 - Managers', '3 - Leads', '4 - Staff', 'Custom'].map(tier => (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => {
                            if (tier === 'Custom') {
                              handleChange('orgLevel', 'Custom Tier Level');
                            } else {
                              const fullTier = tier === '1 - Executive' ? '1 - Executive Leadership' : tier === '2 - Managers' ? '2 - Managers & Supervisors' : tier === '3 - Leads' ? '3 - Senior Specialists & Leads' : '4 - Rank & File Staff';
                              handleChange('orgLevel', fullTier);
                            }
                          }}
                          className="px-1.5 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded text-[10px] font-medium transition-colors"
                        >
                          + {tier}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Direct Status with datalist suggestions */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Employee Status</label>
                  <div className="relative">
                    <input
                      type="text"
                      list="status-suggestions"
                      readOnly={isReadOnly}
                      value={formData.status || 'ACTIVE'}
                      onChange={(e) => handleChange('status', e.target.value.toUpperCase())}
                      placeholder="Type any status or choose from list..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 read-only:bg-slate-50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    <datalist id="status-suggestions">
                      <option value="ACTIVE" />
                      <option value="RESIGNED" />
                      <option value="SEPARATED" />
                      <option value="SUSPENDED" />
                      <option value="ON LEAVE" />
                      <option value="MATERNITY LEAVE" />
                      <option value="DECEASED" />
                    </datalist>
                  </div>
                  {!isReadOnly && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {['ACTIVE', 'RESIGNED', 'SEPARATED', 'SUSPENDED', 'ON LEAVE'].map(st => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleChange('status', st)}
                          className="px-1.5 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded text-[10px] font-medium transition-colors"
                        >
                          + {st}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Direct Classification */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Classification</label>
                  <div className="relative">
                    <input
                      type="text"
                      list="classification-suggestions"
                      readOnly={isReadOnly}
                      value={formData.classification || 'Regular'}
                      onChange={(e) => handleChange('classification', e.target.value)}
                      placeholder="Type classification or pick below..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    <datalist id="classification-suggestions">
                      <option value="Regular" />
                      <option value="Probationary" />
                      <option value="Contractual" />
                      <option value="Project-Based" />
                      <option value="Casual" />
                      <option value="Part-Time" />
                      <option value="Executive" />
                      <option value="Consultant" />
                    </datalist>
                  </div>
                  {!isReadOnly && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {['Regular', 'Probationary', 'Contractual', 'Project-Based', 'Casual'].map(cl => (
                        <button
                          key={cl}
                          type="button"
                          onClick={() => handleChange('classification', cl)}
                          className="px-1.5 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded text-[10px] font-medium transition-colors"
                        >
                          + {cl}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Date of Regularization</label>
                  <input
                    type="date"
                    readOnly={isReadOnly}
                    value={formData.dateOfRegularization || formData.regularizationDate || ''}
                    onChange={(e) => {
                      handleChange('dateOfRegularization', e.target.value);
                      handleChange('regularizationDate', e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">End of Contract Date</label>
                  <input
                    type="date"
                    readOnly={isReadOnly}
                    value={formData.endOfContractDate || ''}
                    onChange={(e) => handleChange('endOfContractDate', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Location / Branch</label>
                  <div className="relative">
                    <input
                      type="text"
                      list="location-suggestions"
                      readOnly={isReadOnly}
                      value={formData.locationBranch || 'Mandaluyong'}
                      onChange={(e) => handleChange('locationBranch', e.target.value)}
                      placeholder="Type location / branch..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    <datalist id="location-suggestions">
                      <option value="Mandaluyong" />
                      <option value="Legazpi, Albay" />
                      <option value="Head Office" />
                      <option value="Main Branch" />
                    </datalist>
                  </div>
                  {!isReadOnly && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {['Mandaluyong', 'Legazpi, Albay', 'Head Office'].map(loc => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => handleChange('locationBranch', loc)}
                          className="px-1.5 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded text-[10px] font-medium transition-colors"
                        >
                          + {loc}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Monthly Basic Salary (₱)</label>
                  <input
                    type="number"
                    step="100"
                    readOnly={isReadOnly}
                    value={formData.monthlySalary || ''}
                    onChange={(e) => handleChange('monthlySalary', parseFloat(e.target.value) || 0)}
                    placeholder="Enter basic monthly salary..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50/20 read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Payroll Schedule</label>
                  <div className="relative">
                    <input
                      type="text"
                      list="schedule-suggestions"
                      readOnly={isReadOnly}
                      value={formData.payrollSchedule || 'Semi-Monthly'}
                      onChange={(e) => handleChange('payrollSchedule', e.target.value)}
                      placeholder="Type schedule (e.g. Semi-Monthly, Weekly, Custom)..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    <datalist id="schedule-suggestions">
                      <option value="Semi-Monthly" />
                      <option value="Weekly" />
                      <option value="Bi-Weekly" />
                      <option value="Monthly" />
                      <option value="Custom" />
                    </datalist>
                  </div>
                  {!isReadOnly && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {['Semi-Monthly', 'Weekly', 'Bi-Weekly', 'Monthly', 'Custom'].map(sch => (
                        <button
                          key={sch}
                          type="button"
                          onClick={() => handleChange('payrollSchedule', sch === 'Custom' ? 'Custom Schedule' : sch)}
                          className="px-1.5 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded text-[10px] font-medium transition-colors"
                        >
                          + {sch}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Separation / Resignation Date</label>
                  <input
                    type="date"
                    readOnly={isReadOnly}
                    value={formData.separationDate || formData.resignationDate || ''}
                    onChange={(e) => {
                      handleChange('separationDate', e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Separation Reason</label>
                  <div className="relative">
                    <input
                      type="text"
                      list="reason-suggestions"
                      readOnly={isReadOnly}
                      value={formData.separationReason || ''}
                      onChange={(e) => handleChange('separationReason', e.target.value)}
                      placeholder="Type any separation reason..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    <datalist id="reason-suggestions">
                      <option value="Resignation" />
                      <option value="AWOL (Absence Without Official Leave)" />
                      <option value="End of Contract" />
                      <option value="Involuntary Termination" />
                      <option value="Retirement" />
                      <option value="Health Reasons" />
                      <option value="Redundancy" />
                    </datalist>
                  </div>
                  {!isReadOnly && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {['Resignation', 'AWOL', 'End of Contract', 'Involuntary Termination', 'Retirement'].map(rs => (
                        <button
                          key={rs}
                          type="button"
                          onClick={() => handleChange('separationReason', rs)}
                          className="px-1.5 py-0.5 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 rounded text-[10px] font-medium transition-colors"
                        >
                          + {rs}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {(formData.status === 'RESIGNED' || formData.status === 'SEPARATED' || Boolean(formData.separationDate)) && (
                  <div className="col-span-1 sm:col-span-2 bg-amber-50 p-4 rounded-2xl border border-amber-300 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                        🗓️ 30-Day Resigned / Separated Employee Last Pay Schedule
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-200 text-amber-900">
                        FINAL PAY COUNTDOWN
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">
                          Calculated 30-Day Last Pay Schedule
                        </label>
                        <input
                          type="date"
                          readOnly={isReadOnly}
                          value={formData.lastPayScheduleDate || (formData.separationDate ? new Date(new Date(formData.separationDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : '')}
                          onChange={(e) => handleChange('lastPayScheduleDate', e.target.value)}
                          className="w-full px-3 py-2 border border-amber-300 rounded-xl text-xs font-bold text-amber-950 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">
                          Last Pay Status
                        </label>
                        <select
                          disabled={isReadOnly}
                          value={formData.lastPayStatus || 'PENDING'}
                          onChange={(e) => handleChange('lastPayStatus', e.target.value)}
                          className="w-full px-3 py-2 border border-amber-300 rounded-xl text-xs font-bold text-amber-950 bg-white"
                        >
                          <option value="PENDING">PENDING (Processing 30-Day Countdown)</option>
                          <option value="PROCESSED">PROCESSED (Clearance & Computation Ready)</option>
                          <option value="RELEASED">RELEASED (Final Pay Handed Over)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">
                          Final / Last Pay Amount (₱)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          readOnly={isReadOnly}
                          value={formData.lastPayAmount ?? ''}
                          onChange={(e) => handleChange('lastPayAmount', parseFloat(e.target.value) || 0)}
                          placeholder="e.g. 15000.00"
                          className="w-full px-3 py-2 border border-amber-300 rounded-xl text-xs font-extrabold text-amber-950 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Tenure (Auto Calculated)</label>
                  <input
                    type="text"
                    readOnly
                    value={formData.tenures || ''}
                    placeholder="Auto-computed"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* Probationary 6-Month Regularization & Performance Review Manager */}
            {formData.classification === 'Probationary' && (() => {
              const probStatus = getProbationaryStatus(formData as Employee);
              const reviews = formData.perfReviews || { month3Done: false, month5Done: false };

              return (
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl border border-slate-700 shadow-lg space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-700 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                        <Clock className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm text-white">Probationary 6-Month Regularization Countdown & Review</h3>
                        <p className="text-xs text-slate-400">Track 3rd month performance review, 5th month evaluation, and regularization decision.</p>
                      </div>
                    </div>

                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={handleApproveRegularization}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Approve 6-Month Regularization
                      </button>
                    )}
                  </div>

                  {probStatus ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/80 p-3.5 rounded-xl border border-slate-700/60 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Regularization Date</span>
                        <span className="font-bold text-white text-sm">{probStatus.regularizationDate}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Countdown Status</span>
                        <span className={`font-black font-mono text-sm ${probStatus.daysRemaining <= 0 ? 'text-rose-400' : 'text-amber-400'}`}>
                          {probStatus.daysRemaining <= 0 ? '⚠️ OVERDUE FOR DECISION' : `⏱️ ${probStatus.daysRemaining} Days Remaining`}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Timeline Checkpoint</span>
                        <span className="font-semibold text-slate-300">
                          3rd Mo: {probStatus.month3Due} | 5th Mo: {probStatus.month5Due}
                        </span>
                      </div>
                    </div>
                  ) : (formData.status === 'RESIGNED' || formData.status === 'SEPARATED' || formData.status === 'AWOL' || formData.status === 'INACTIVE') && (
                    <div className="bg-rose-950/80 p-3.5 rounded-xl border border-rose-700/60 text-xs flex items-center justify-between text-rose-200">
                      <div className="flex items-center gap-2">
                        <span className="text-base">⏹️</span>
                        <div>
                          <span className="font-extrabold uppercase text-xs block text-rose-300">Countdown Halted & Stopped</span>
                          <span className="text-[11px] text-rose-200">
                            Employee status is <strong className="uppercase font-bold underline">{formData.status}</strong>. Regularization evaluation countdown has been stopped.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Review Notes Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="bg-slate-800/90 p-3.5 rounded-xl border border-slate-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <Check className={`w-4 h-4 ${reviews.month3Done ? 'text-emerald-400' : 'text-slate-500'}`} />
                          3rd Month Performance Review
                        </label>
                        {!isReadOnly && (
                          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={reviews.month3Done || false}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                perfReviews: { ...prev.perfReviews, month3Done: e.target.checked }
                              }))}
                              className="rounded border-slate-600"
                            />
                            <span>Completed</span>
                          </label>
                        )}
                      </div>
                      <textarea
                        rows={2}
                        readOnly={isReadOnly}
                        value={reviews.month3Notes || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          perfReviews: { ...prev.perfReviews, month3Notes: e.target.value }
                        }))}
                        placeholder="Notes on 3rd month performance rating, attendance, skills assessment..."
                        className="w-full p-2 bg-slate-900/80 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none"
                      />
                    </div>

                    <div className="bg-slate-800/90 p-3.5 rounded-xl border border-slate-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <Check className={`w-4 h-4 ${reviews.month5Done ? 'text-emerald-400' : 'text-slate-500'}`} />
                          5th Month Final Evaluation (Regularization Decision)
                        </label>
                        {!isReadOnly && (
                          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={reviews.month5Done || false}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                perfReviews: { ...prev.perfReviews, month5Done: e.target.checked }
                              }))}
                              className="rounded border-slate-600"
                            />
                            <span>Completed</span>
                          </label>
                        )}
                      </div>
                      <textarea
                        rows={2}
                        readOnly={isReadOnly}
                        value={reviews.month5Notes || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          perfReviews: { ...prev.perfReviews, month5Notes: e.target.value }
                        }))}
                        placeholder="Final recommendation by department head for regularization..."
                        className="w-full p-2 bg-slate-900/80 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Salary History & Salary Adjustments Log */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-emerald-700">
                      Salary Records & Compensation Increase History Log
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Current Basic Salary: <span className="font-bold text-emerald-700">{formData.monthlySalary ? `₱${Number(formData.monthlySalary).toLocaleString()} / month` : 'Not Set (Enter custom salary)'}</span>
                    </p>
                  </div>
                </div>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      setSalaryForm(prev => ({
                        ...prev,
                        effectiveDate: new Date().toISOString().split('T')[0],
                        newSalary: String((formData.monthlySalary || 0) + 2000)
                      }));
                      setShowSalaryModal(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Log Salary Increase
                  </button>
                )}
              </div>

              {/* Salary History Table */}
              {(!formData.salaryHistory || formData.salaryHistory.length === 0) ? (
                <p className="text-xs text-slate-400 italic">No salary increase records logged yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase">
                        <th className="py-2 px-3">Effective Date</th>
                        <th className="py-2 px-3">Previous Salary</th>
                        <th className="py-2 px-3">New Salary</th>
                        <th className="py-2 px-3">Increase Amount</th>
                        <th className="py-2 px-3">Reason / Promotion</th>
                        <th className="py-2 px-3">Approved By</th>
                        {!isReadOnly && <th className="py-2 px-3 text-right">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formData.salaryHistory.map((sal) => {
                        const diff = sal.newSalary - sal.previousSalary;
                        const pct = sal.previousSalary > 0 ? ((diff / sal.previousSalary) * 100).toFixed(1) : '100';

                        return (
                          <tr key={sal.id} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{sal.effectiveDate}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">₱{sal.previousSalary.toLocaleString()}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">₱{sal.newSalary.toLocaleString()}</td>
                            <td className="py-2.5 px-3 font-bold text-emerald-600">
                              +{diff > 0 ? `₱${diff.toLocaleString()} (+${pct}%)` : 'Base Rate'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">{sal.reason}</td>
                            <td className="py-2.5 px-3 text-slate-500">{sal.approvedBy}</td>
                            {!isReadOnly && (
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSalaryRecord(sal.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Delete Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Individual Memos & Disciplinary/Commendation Notices Log */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-blue-700">
                      Individual Memos & HR Disciplinary / Commendation Notices
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Log of official memos, notices to explain, commendations, and policy acknowledgments.
                    </p>
                  </div>
                </div>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      setMemoForm({
                        memoNo: `MEMO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
                        dateIssued: new Date().toISOString().split('T')[0],
                        type: 'Notice',
                        title: '',
                        details: '',
                        issuedBy: 'HR Department'
                      });
                      setShowMemoModal(true);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Issue New Memo
                  </button>
                )}
              </div>

              {(!formData.memos || formData.memos.length === 0) ? (
                <p className="text-xs text-slate-400 italic">No individual memos issued to this employee.</p>
              ) : (
                <div className="space-y-3">
                  {formData.memos.map((memo) => {
                    const typeBg = memo.type === 'Commendation'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : memo.type === 'Warning' || memo.type === 'Violation'
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-blue-100 text-blue-800 border-blue-300';

                    return (
                      <div key={memo.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900">{memo.memoNo}</span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${typeBg}`}>
                              {memo.type}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">Issued: {memo.dateIssued}</span>
                          </div>
                          <h4 className="font-bold text-xs text-slate-800">{memo.title}</h4>
                          <p className="text-xs text-slate-600">{memo.details}</p>
                          <span className="text-[10px] text-slate-400 block">Issued By: {memo.issuedBy}</span>
                          {memo.filename && (
                            <div className="pt-1.5 flex items-center gap-2">
                              <a
                                href={memo.dataUrl || '#'}
                                download={memo.filename}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-[11px] font-bold text-blue-600 hover:bg-blue-50 transition-colors shadow-2xs"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                                <span>Attached File: {memo.filename} (Click to View/Download)</span>
                              </a>
                            </div>
                          )}
                        </div>

                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMemo(memo.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0 self-start"
                            title="Delete Memo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Government Mandated Loans & Custom Monthly Deductions */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700">
                      Government Mandated Loans & Salary Deductions
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Log SSS, Pag-IBIG, Calamity, or Company loans with custom editable monthly salary deductions.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-800 text-xs font-bold">
                    Total Deduction:{' '}
                    <span className="text-indigo-600">
                      ₱{(formData.govLoans || [])
                        .filter(l => l.status === 'ACTIVE')
                        .reduce((sum, l) => sum + (Number(l.monthlyDeduction) || 0), 0)
                        .toLocaleString()}
                    </span>{' '}
                    / mo
                  </div>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => setShowLoanModal(true)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Gov Loan
                    </button>
                  )}
                </div>
              </div>

              {(!formData.govLoans || formData.govLoans.length === 0) ? (
                <p className="text-xs text-slate-400 italic">No government or mandated loan deductions recorded for this employee.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase">
                        <th className="py-2 px-3">Loan Type</th>
                        <th className="py-2 px-3">Reference No.</th>
                        <th className="py-2 px-3">Loan Amount</th>
                        <th className="py-2 px-3">Custom Monthly Deduction</th>
                        <th className="py-2 px-3">Start Date</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Remarks</th>
                        {!isReadOnly && <th className="py-2 px-3 text-right">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formData.govLoans.map((loan) => (
                        <tr key={loan.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{loan.type}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{loan.referenceNo || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-700 font-semibold">₱{Number(loan.loanAmount || 0).toLocaleString()}</td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                              ₱{Number(loan.monthlyDeduction || 0).toLocaleString()} / mo
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{loan.startDate}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              loan.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : loan.status === 'FULLY_PAID'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {loan.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-[180px] truncate">{loan.remarks || '—'}</td>
                          {!isReadOnly && (
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteLoan(loan.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Remove Loan Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Attendance & Lateness Tracker (Executive Days Late Warning) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-amber-700">
                      Attendance Tracker & Executive Days Late Monitoring
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Monitor daily attendance records. Automatically warns HR when an employee reaches 3 consecutive executive days late.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {consecutiveLateCount >= 3 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-600 text-white font-black text-xs rounded-xl shadow-sm animate-pulse">
                      <AlertTriangle className="w-4 h-4" />
                      {consecutiveLateCount} Executive Days Late
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {consecutiveLateCount} Consecutive Late Days
                    </span>
                  )}
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => setShowAttendanceModal(true)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> Log Attendance / Late
                    </button>
                  )}
                </div>
              </div>

              {/* 3 Executive Days Late Automatic Warning Banner */}
              {consecutiveLateCount >= 3 && (
                <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-extrabold text-rose-900 text-xs uppercase">
                        ⚠️ HR ALERT: 3 Consecutive Executive Days of Lateness Detected!
                      </h4>
                      <p className="text-xs text-rose-800 mt-0.5">
                        Employee <span className="font-bold">{formData.firstName} {formData.lastName}</span> has been LATE for <span className="font-bold underline">{consecutiveLateCount} consecutive executive days</span>. Under company attendance policy, an official Notice to Explain (NTE) or Disciplinary Warning Memo should be issued.
                      </p>
                    </div>
                  </div>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        setMemoForm({
                          memoNo: `NTE-LATE-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
                          dateIssued: new Date().toISOString().split('T')[0],
                          type: 'Warning',
                          title: 'Notice to Explain - 3 Consecutive Executive Days Late',
                          details: `You have been recorded LATE for ${consecutiveLateCount} consecutive executive working days. In accordance with company code of conduct, you are required to submit a written explanation within forty-eight (48) hours explaining why disciplinary action should not be imposed against you.`,
                          issuedBy: 'HR Department'
                        });
                        setShowMemoModal(true);
                      }}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shrink-0 transition-colors flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" /> Issue Warning Memo Now
                    </button>
                  )}
                </div>
              )}

              {(!formData.attendanceRecords || formData.attendanceRecords.length === 0) ? (
                <p className="text-xs text-slate-400 italic">No attendance or lateness records logged for this employee.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase">
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Time In</th>
                        <th className="py-2 px-3">Time Out</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Minutes Late</th>
                        <th className="py-2 px-3">Notes / Reason</th>
                        {!isReadOnly && <th className="py-2 px-3 text-right">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formData.attendanceRecords.map((att) => (
                        <tr key={att.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{att.date}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">{att.timeIn || '—'}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{att.timeOut || '—'}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              att.status === 'PRESENT'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : att.status === 'LATE' || att.status === 'EXECUTIVE_LATE'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200 font-extrabold'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {att.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {att.minutesLate && att.minutesLate > 0 ? (
                              <span className="font-bold text-rose-600">{att.minutesLate} mins late</span>
                            ) : (
                              <span className="text-slate-400">On time</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 text-[11px] max-w-[200px] truncate">{att.notes || '—'}</td>
                          {!isReadOnly && (
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteAttendance(att.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Personal Information */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-blue-700 mb-4 pb-2 border-b border-slate-100">
                Personal Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Current Address</label>
                  <textarea
                    rows={2}
                    readOnly={isReadOnly}
                    value={formData.currentAddress || ''}
                    onChange={(e) => handleChange('currentAddress', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Permanent Address</label>
                  <textarea
                    rows={2}
                    readOnly={isReadOnly}
                    value={formData.permanentAddress || ''}
                    onChange={(e) => handleChange('permanentAddress', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Birthdate</label>
                  <input
                    type="date"
                    readOnly={isReadOnly}
                    value={formData.birthdate || ''}
                    onChange={(e) => handleChange('birthdate', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Age (Auto Computed)</label>
                  <input
                    type="text"
                    readOnly
                    value={formData.age || ''}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Civil Status</label>
                  <select
                    disabled={isReadOnly}
                    value={formData.civilStatus || 'Single'}
                    onChange={(e) => handleChange('civilStatus', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold disabled:bg-slate-50"
                  >
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Gender</label>
                  <select
                    disabled={isReadOnly}
                    value={formData.gender || 'MALE'}
                    onChange={(e) => handleChange('gender', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold disabled:bg-slate-50"
                  >
                    <option value="MALE">MALE</option>
                    <option value="FEMALE">FEMALE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Religion</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.religion || ''}
                    onChange={(e) => handleChange('religion', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Place of Birth</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.placeOfBirth || ''}
                    onChange={(e) => handleChange('placeOfBirth', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Blood Type</label>
                  <select
                    disabled={isReadOnly}
                    value={formData.bloodType || ''}
                    onChange={(e) => handleChange('bloodType', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold disabled:bg-slate-50"
                  >
                    <option value="">-- Select Blood Type --</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-blue-700 mb-4 pb-2 border-b border-slate-100">
                Contact Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Mobile Number</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.mobileNumber || ''}
                    onChange={(e) => handleChange('mobileNumber', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Personal Email</label>
                  <input
                    type="email"
                    readOnly={isReadOnly}
                    value={formData.personalEmail || ''}
                    onChange={(e) => handleChange('personalEmail', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Company Email</label>
                  <input
                    type="email"
                    readOnly={isReadOnly}
                    value={formData.companyEmail || ''}
                    onChange={(e) => handleChange('companyEmail', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>
              </div>
            </div>

            {/* Government IDs */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-blue-700 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span>Government Numbers & Accounts</span>
                </h3>
                {(() => {
                  const missingList = checkMissingGovIds(formData);
                  if (missingList.length === 0) {
                    return (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black flex items-center gap-1 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Complete Gov't Mandatory IDs
                      </span>
                    );
                  }
                  return (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-full text-[10px] font-black flex items-center gap-1 border border-amber-300 animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Missing {missingList.length} Mandatory ID{missingList.length > 1 ? 's' : ''}
                    </span>
                  );
                })()}
              </div>

              {/* Warning Alert if any mandatory government IDs are missing */}
              {(() => {
                const missingList = checkMissingGovIds(formData);
                if (missingList.length === 0) return null;
                return (
                  <div className="p-3.5 bg-amber-50/90 border-2 border-amber-300/80 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-extrabold text-amber-950 text-xs uppercase">
                        ⚠️ WARNING: Missing Mandatory Government Information ({missingList.join(', ')})
                      </h4>
                      <p className="text-xs text-amber-900 mt-0.5">
                        In accordance with Philippine Labor Code & HR compliance regulations, the employee must provide valid government numbers for <strong className="underline">{missingList.join(', ')}</strong> for mandatory payroll contributions and 201 filing.
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase">SSS Number</label>
                    {(!formData.sss || formData.sss === '0' || formData.sss.toLowerCase() === 'na') && (
                      <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">Missing</span>
                    )}
                  </div>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.sss || ''}
                    onChange={(e) => handleChange('sss', e.target.value)}
                    placeholder="e.g. 34-1234567-8"
                    className={`w-full px-3 py-2 border rounded-xl text-xs font-semibold read-only:bg-slate-50 outline-none ${
                      !formData.sss || formData.sss === '0' || formData.sss.toLowerCase() === 'na'
                        ? 'border-amber-400 bg-amber-50/30 focus:border-rose-500'
                        : 'border-slate-300 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase">PAG-IBIG MID</label>
                    {(!formData.pagibig || formData.pagibig === '0' || formData.pagibig.toLowerCase() === 'na') && (
                      <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">Missing</span>
                    )}
                  </div>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.pagibig || ''}
                    onChange={(e) => handleChange('pagibig', e.target.value)}
                    placeholder="e.g. 1210-1234-5678"
                    className={`w-full px-3 py-2 border rounded-xl text-xs font-semibold read-only:bg-slate-50 outline-none ${
                      !formData.pagibig || formData.pagibig === '0' || formData.pagibig.toLowerCase() === 'na'
                        ? 'border-amber-400 bg-amber-50/30 focus:border-rose-500'
                        : 'border-slate-300 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase">PhilHealth No.</label>
                    {(!formData.philhealth || formData.philhealth === '0' || formData.philhealth.toLowerCase() === 'na') && (
                      <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">Missing</span>
                    )}
                  </div>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.philhealth || ''}
                    onChange={(e) => handleChange('philhealth', e.target.value)}
                    placeholder="e.g. 12-345678901-2"
                    className={`w-full px-3 py-2 border rounded-xl text-xs font-semibold read-only:bg-slate-50 outline-none ${
                      !formData.philhealth || formData.philhealth === '0' || formData.philhealth.toLowerCase() === 'na'
                        ? 'border-amber-400 bg-amber-50/30 focus:border-rose-500'
                        : 'border-slate-300 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase">TIN</label>
                    {(!formData.tin || formData.tin === '0' || formData.tin.toLowerCase() === 'na') && (
                      <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">Missing</span>
                    )}
                  </div>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.tin || ''}
                    onChange={(e) => handleChange('tin', e.target.value)}
                    placeholder="e.g. 123-456-789-000"
                    className={`w-full px-3 py-2 border rounded-xl text-xs font-semibold read-only:bg-slate-50 outline-none ${
                      !formData.tin || formData.tin === '0' || formData.tin.toLowerCase() === 'na'
                        ? 'border-amber-400 bg-amber-50/30 focus:border-rose-500'
                        : 'border-slate-300 focus:border-blue-500'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Bank Details & Allowances */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-emerald-700 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Bank Details & Allowances</span>
                <span className="text-[10px] text-slate-500 font-normal normal-case">Payroll Disbursal & Monthly Benefits</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Bank Name</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.bankName || ''}
                    onChange={(e) => handleChange('bankName', e.target.value)}
                    placeholder="e.g. BDO, BPI, Metrobank..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Bank Account Number</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.bankAccountNumber || ''}
                    onChange={(e) => handleChange('bankAccountNumber', e.target.value)}
                    placeholder="e.g. 001234567890"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Account Holder Name</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.bankAccountName || ''}
                    onChange={(e) => handleChange('bankAccountName', e.target.value)}
                    placeholder="Name on ATM card..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>
              </div>
            </div>

            {/* HMO Healthcare & Medical Benefits */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-teal-700 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>HMO Healthcare & Medical Benefits</span>
                <span className="text-[10px] text-slate-500 font-normal normal-case">Medical Insurance & Dependents Coverage</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">HMO Provider Name</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.hmoProvider || ''}
                    onChange={(e) => handleChange('hmoProvider', e.target.value)}
                    placeholder="e.g. Maxicare, Intellicare, Medicard..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">HMO Card / Member ID No.</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.hmoCardNumber || ''}
                    onChange={(e) => handleChange('hmoCardNumber', e.target.value)}
                    placeholder="e.g. 1168-9012-3456"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">HMO Plan & Dependents Coverage</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.hmoCoverage || formData.hmoDetails || ''}
                    onChange={(e) => {
                      handleChange('hmoCoverage', e.target.value);
                      handleChange('hmoDetails', e.target.value);
                    }}
                    placeholder="e.g. Principal + 2 Dependents (₱150k MBL)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-blue-700 mb-4 pb-2 border-b border-slate-100">
                In Case of Emergency (ICE)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Contact Person Name</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.emergencyName || ''}
                    onChange={(e) => handleChange('emergencyName', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Relationship</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.emergencyRelation || ''}
                    onChange={(e) => handleChange('emergencyRelation', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Emergency Contact No.</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.emergencyContact || ''}
                    onChange={(e) => handleChange('emergencyContact', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Emergency Address</label>
                  <textarea
                    rows={2}
                    readOnly={isReadOnly}
                    value={formData.emergencyAddress || ''}
                    onChange={(e) => handleChange('emergencyAddress', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>
              </div>
            </div>

            {/* Family Background Information */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-blue-700 mb-4 pb-2 border-b border-slate-100">
                Family Background Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Mother&apos;s Maiden Name</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.motherMaidenName || ''}
                    onChange={(e) => handleChange('motherMaidenName', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Mother&apos;s Occupation</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.motherOccupation || ''}
                    onChange={(e) => handleChange('motherOccupation', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Father&apos;s Name</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.fatherName || ''}
                    onChange={(e) => handleChange('fatherName', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Father&apos;s Occupation</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.fatherOccupation || ''}
                    onChange={(e) => handleChange('fatherOccupation', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Spouse Name (If Married)</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.spouseName || ''}
                    onChange={(e) => handleChange('spouseName', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Occupation of Spouse</label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={formData.spouseOccupation || ''}
                    onChange={(e) => handleChange('spouseOccupation', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Number of Children</label>
                  <input
                    type="number"
                    min="0"
                    readOnly={isReadOnly}
                    value={formData.numberOfChildren ?? formData.numChildren ?? ''}
                    onChange={(e) => {
                      handleChange('numberOfChildren', e.target.value);
                      handleChange('numChildren', e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Date of Birth of Child(ren)</label>
                  <input
                    type="text"
                    placeholder="e.g. 2015-06-12, 2018-09-24"
                    readOnly={isReadOnly}
                    value={formData.childBirthDates || formData.childBirthdates || ''}
                    onChange={(e) => {
                      handleChange('childBirthDates', e.target.value);
                      handleChange('childBirthdates', e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Name(s) of Child</label>
                  <input
                    type="text"
                    placeholder="e.g. Miguel Dela Cruz, Sofia Dela Cruz"
                    readOnly={isReadOnly}
                    value={formData.childNames || ''}
                    onChange={(e) => handleChange('childNames', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold read-only:bg-slate-50"
                  />
                </div>
              </div>
            </div>

            {/* Work Experience & Career History */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    Work Experience & Employment History
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Previous employers, positions held, durations, industry, and career background.
                  </p>
                </div>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => setShowWorkExpModal(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Work Experience
                  </button>
                )}
              </div>

              {(!formData.workExperience || formData.workExperience.length === 0) ? (
                <div className="p-8 text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-300">
                  <Briefcase className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
                  <p className="text-xs font-bold text-slate-600">No work experience records logged yet.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Click "Add Work Experience" above to log previous employment history.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-3">Company & Position</th>
                        <th className="p-3">Duration / Period</th>
                        <th className="p-3">Department / Industry</th>
                        <th className="p-3">Responsibilities</th>
                        <th className="p-3">Salary / Reason for Leaving</th>
                        {!isReadOnly && <th className="p-3 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formData.workExperience.map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3">
                            <div className="font-extrabold text-slate-900">{exp.companyName}</div>
                            <div className="text-blue-700 font-bold text-[11px]">{exp.position}</div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold text-[11px]">
                              {exp.startDate} — {exp.isCurrent ? 'Present' : (exp.endDate || '—')}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-slate-700">
                            {exp.departmentOrIndustry || '—'}
                          </td>
                          <td className="p-3 text-slate-600 max-w-xs truncate" title={exp.responsibilities}>
                            {exp.responsibilities || '—'}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-800 font-mono">{exp.salary || '—'}</div>
                            <div className="text-[10px] text-slate-500">{exp.reasonForLeaving || '—'}</div>
                          </td>
                          {!isReadOnly && (
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteWorkExperience(exp.id)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete work experience record"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Document Requirements (CRITICAL SECTION FOR USER REQUEST) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-blue-700">
                    201 Document Requirements & Local Storage Attachments
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Upload, view, open, and download PDFs, scanned images, and documents for this employee.
                  </p>
                </div>

                {!isReadOnly && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newReqName}
                      onChange={(e) => setNewReqName(e.target.value)}
                      placeholder="Add requirement name..."
                      className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomReq}
                      className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-xl text-xs flex items-center gap-1 hover:bg-blue-700"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                )}
              </div>

              {/* Grid of Documents */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {requirements.map((req) => {
                  const docData = documents[req.id];
                  const hasFile = Boolean(docData && (docData.url || docData.fileId));
                  const isPdf = docData?.filename?.toLowerCase().endsWith('.pdf') || docData?.mimeType?.includes('pdf');
                  const isImage = docData?.mimeType?.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(docData?.filename || '');

                  return (
                    <div
                      key={req.id}
                      className={`p-4 rounded-xl border transition-all ${
                        hasFile ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50/70 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          {editingReqId === req.id ? (
                            <div className="flex items-center gap-1.5 my-1">
                              <input
                                type="text"
                                value={editingReqName}
                                onChange={(e) => setEditingReqName(e.target.value)}
                                className="px-2 py-1 border border-blue-400 rounded-lg text-xs font-semibold outline-none w-full bg-white"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveRequirementEdit(req.id)}
                                className="p-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                                title="Save requirement name"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingReqId(null)}
                                className="p-1 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs flex items-center gap-1">
                                {req.name}
                                {req.required && <span className="text-rose-500 font-black">*</span>}
                              </span>

                              {!isReadOnly && (
                                <div className="flex items-center gap-1 ml-1 opacity-80 hover:opacity-100">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingReqId(req.id);
                                      setEditingReqName(req.name);
                                    }}
                                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
                                    title="Edit requirement name"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRequirementItem(req.id, req.name)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                    title="Delete requirement"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          <span className="text-[10px] text-slate-400 font-semibold uppercase">
                            {req.isDefault ? 'Standard Req' : 'Custom Req'}
                          </span>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shrink-0 ${
                          hasFile ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {hasFile ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Clock className="w-3 h-3 text-slate-400" />}
                          {hasFile ? 'Uploaded' : 'Pending'}
                        </span>
                      </div>

                      {/* File Details & Preview Action Bar */}
                      {hasFile && docData ? (
                        <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2 mb-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 truncate pr-2">
                              {isPdf ? (
                                <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                              ) : isImage ? (
                                <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                              ) : (
                                <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                              )}
                              <span className="font-semibold text-slate-800 truncate" title={docData.filename}>
                                {docData.filename || 'Attached File'}
                              </span>
                            </div>

                            {/* View / Open / Download Action Buttons */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openViewer(req.name, docData)}
                                className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors"
                                title="View inline in app viewer"
                              >
                                <Eye className="w-3 h-3" /> View
                              </button>

                              <button
                                type="button"
                                onClick={() => openViewer(req.name, docData)}
                                className="p-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
                                title="Open in viewer/tab"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>

                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDoc(req.id)}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                  title="Remove Document"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="text-[10px] text-slate-400 font-medium">
                            Uploaded {new Date(docData.uploadedAt).toLocaleDateString()} {docData.size ? `(${Math.round(docData.size / 1024)} KB)` : ''}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic mb-2">No file uploaded yet.</p>
                      )}

                      {/* Upload / Replace Controls */}
                      {!isReadOnly && (
                        <div className="flex items-center gap-2 pt-1">
                          <label className="px-3 py-1.5 bg-white border border-slate-300 hover:border-blue-500 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-colors inline-flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            <span>{uploadingDoc === req.id ? 'Uploading...' : hasFile ? 'Replace File' : 'Upload File / PDF'}</span>
                            <input
                              type="file"
                              accept="image/*,.pdf,.doc,.docx"
                              onChange={(e) => handleDocUpload(req.id, e)}
                              className="hidden"
                              disabled={uploadingDoc === req.id}
                            />
                          </label>
                        </div>
                      )}

                      {/* Notes & Document Expiry Date Inputs */}
                      <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">Document Notes</label>
                          <input
                            type="text"
                            readOnly={isReadOnly}
                            value={docData?.notes || ''}
                            onChange={(e) => handleDocNoteChange(req.id, e.target.value)}
                            placeholder="e.g. Valid NBI clearance..."
                            className="w-full px-2.5 py-1 border border-slate-200 rounded-lg text-[11px] bg-white read-only:bg-slate-50 text-slate-600 outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">Document Expiry Date</label>
                          <input
                            type="date"
                            readOnly={isReadOnly}
                            value={formData.docExpiries?.[req.id] || ''}
                            onChange={(e) => handleExpiryDateChange(req.id, e.target.value)}
                            className="w-full px-2.5 py-1 border border-slate-200 rounded-lg text-[11px] bg-white read-only:bg-slate-50 text-slate-700 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Form Submit */}
            {!isReadOnly && (
              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 bg-white/90 backdrop-blur-md p-4 rounded-xl">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all"
                >
                  Save Employee Profile
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Log Salary Increase Sub-Modal */}
      {showSalaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" /> Log Compensation / Salary Increase
              </h3>
              <button onClick={() => setShowSalaryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Effective Date</label>
                <input
                  type="date"
                  value={salaryForm.effectiveDate}
                  onChange={(e) => setSalaryForm(prev => ({ ...prev, effectiveDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Current Monthly Basic Salary</label>
                <input
                  type="text"
                  disabled
                  value={`₱${(formData.monthlySalary || 0).toLocaleString()}`}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-600 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">New Monthly Basic Salary (₱) *</label>
                <input
                  type="number"
                  step="100"
                  value={salaryForm.newSalary}
                  onChange={(e) => setSalaryForm(prev => ({ ...prev, newSalary: e.target.value }))}
                  placeholder="e.g. 30000"
                  className="w-full px-3 py-2 border border-emerald-400 rounded-xl font-bold text-emerald-800 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Reason / Promotion Details</label>
                <input
                  type="text"
                  value={salaryForm.reason}
                  onChange={(e) => setSalaryForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. 6-Month Regularization Merit Increase"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Approved By</label>
                <input
                  type="text"
                  value={salaryForm.approvedBy}
                  onChange={(e) => setSalaryForm(prev => ({ ...prev, approvedBy: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSalaryModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogSalaryIncrease}
                className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-emerald-700"
              >
                Save Increase Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Memo Sub-Modal */}
      {showMemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" /> Issue Individual Memo / HR Notice
              </h3>
              <button onClick={() => setShowMemoModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Memo #</label>
                  <input
                    type="text"
                    value={memoForm.memoNo}
                    onChange={(e) => setMemoForm(prev => ({ ...prev, memoNo: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Date Issued</label>
                  <input
                    type="date"
                    value={memoForm.dateIssued}
                    onChange={(e) => setMemoForm(prev => ({ ...prev, dateIssued: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Notice Category</label>
                <select
                  value={memoForm.type}
                  onChange={(e) => setMemoForm(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-semibold"
                >
                  <option value="Notice">Notice to Explain / Standard Notice</option>
                  <option value="Warning">Warning / Disciplinary Action</option>
                  <option value="Commendation">Commendation / Performance Recognition</option>
                  <option value="Violation">Company Policy Violation</option>
                  <option value="Policy">Policy Acknowledgment</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Memo Subject / Title *</label>
                <input
                  type="text"
                  value={memoForm.title}
                  onChange={(e) => setMemoForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Attendance Policy Reminder"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Details & Remarks *</label>
                <textarea
                  rows={3}
                  value={memoForm.details}
                  onChange={(e) => setMemoForm(prev => ({ ...prev, details: e.target.value }))}
                  placeholder="Enter full details of the issued memo..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Issued By</label>
                <input
                  type="text"
                  value={memoForm.issuedBy}
                  onChange={(e) => setMemoForm(prev => ({ ...prev, issuedBy: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Insert File / Attachment from Local Storage</label>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 flex items-center gap-1.5 transition-colors">
                    <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                    <span>{memoForm.filename ? 'Change Attached File' : 'Insert File from Local Storage'}</span>
                    <input
                      type="file"
                      onChange={handleMemoFileUpload}
                      className="hidden"
                    />
                  </label>
                  {memoForm.filename && (
                    <span className="text-xs font-semibold text-emerald-600 truncate max-w-[200px]">
                      ✓ {memoForm.filename}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowMemoModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleIssueMemo}
                className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-blue-700"
              >
                Issue Memo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gov Loan Modal */}
      {showLoanModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-indigo-600" />
                Add Government Mandate Loan & Deduction
              </h3>
              <button
                type="button"
                onClick={() => setShowLoanModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Loan Type *</label>
                <select
                  value={loanForm.type}
                  onChange={(e) => setLoanForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-semibold"
                >
                  <option value="SSS Salary Loan">SSS Salary Loan</option>
                  <option value="SSS Calamity Loan">SSS Calamity Loan</option>
                  <option value="Pag-IBIG Multi-Purpose Loan (MPL)">Pag-IBIG Multi-Purpose Loan (MPL)</option>
                  <option value="Pag-IBIG Calamity Loan">Pag-IBIG Calamity Loan</option>
                  <option value="Company Salary Loan">Company Salary Loan</option>
                  <option value="Emergency Loan">Emergency Loan</option>
                  <option value="Custom Mandate Loan">Custom Mandate Loan</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Reference / SSS/PGB No.</label>
                  <input
                    type="text"
                    placeholder="e.g. SSS-SL-2026-889"
                    value={loanForm.referenceNo}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, referenceNo: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={loanForm.startDate}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Total Loan Amount (₱)</label>
                  <input
                    type="number"
                    placeholder="e.g. 25000"
                    value={loanForm.loanAmount}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, loanAmount: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-amber-700 uppercase mb-1">Custom Monthly Deduction (₱) *</label>
                  <input
                    type="number"
                    placeholder="e.g. 1800"
                    value={loanForm.monthlyDeduction}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, monthlyDeduction: e.target.value }))}
                    className="w-full px-3 py-2 border-2 border-amber-300 bg-amber-50/40 rounded-xl outline-none font-bold text-slate-900"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Custom editable monthly salary deduction</p>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Status</label>
                <select
                  value={loanForm.status}
                  onChange={(e) => setLoanForm(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-semibold"
                >
                  <option value="ACTIVE">ACTIVE (Deducting Monthly)</option>
                  <option value="ON_HOLD">ON HOLD</option>
                  <option value="FULLY_PAID">FULLY PAID</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Remarks / Amortization Note</label>
                <input
                  type="text"
                  placeholder="e.g. 24-month amortization setup"
                  value={loanForm.remarks}
                  onChange={(e) => setLoanForm(prev => ({ ...prev, remarks: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLoanModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLoan}
                className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-indigo-700"
              >
                Save Loan & Deduction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance & Late Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider text-amber-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                Log Attendance / Lateness Incident
              </h3>
              <button
                type="button"
                onClick={() => setShowAttendanceModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Date *</label>
                  <input
                    type="date"
                    value={attendanceForm.date}
                    onChange={(e) => setAttendanceForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Attendance Status *</label>
                  <select
                    value={attendanceForm.status}
                    onChange={(e) => setAttendanceForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-bold"
                  >
                    <option value="LATE">LATE (Late Arrival)</option>
                    <option value="EXECUTIVE_LATE">EXECUTIVE LATE (Executive Day Late)</option>
                    <option value="PRESENT">PRESENT (On Time)</option>
                    <option value="HALF_DAY">HALF DAY</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="ON_LEAVE">ON LEAVE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Time In</label>
                  <input
                    type="text"
                    placeholder="08:25 AM"
                    value={attendanceForm.timeIn}
                    onChange={(e) => setAttendanceForm(prev => ({ ...prev, timeIn: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Time Out</label>
                  <input
                    type="text"
                    placeholder="05:00 PM"
                    value={attendanceForm.timeOut}
                    onChange={(e) => setAttendanceForm(prev => ({ ...prev, timeOut: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-rose-700 uppercase mb-1">Minutes Late</label>
                <input
                  type="number"
                  placeholder="e.g. 25"
                  value={attendanceForm.minutesLate}
                  onChange={(e) => setAttendanceForm(prev => ({ ...prev, minutesLate: e.target.value }))}
                  className="w-full px-3 py-2 border-2 border-rose-200 rounded-xl outline-none font-bold"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">3 consecutive executive days late will trigger HR Warning Alert</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Notes / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Heavy traffic along Commonwealth / vehicle breakdown"
                  value={attendanceForm.notes}
                  onChange={(e) => setAttendanceForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAttendanceModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAttendance}
                className="px-4 py-2 bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-amber-700"
              >
                Log Attendance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Work Experience Modal */}
      {showWorkExpModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-600" /> Log Previous Work Experience
              </h3>
              <button onClick={() => setShowWorkExpModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Company / Employer *</label>
                  <input
                    type="text"
                    placeholder="e.g. Aboitiz Shipping Corp."
                    value={workExpForm.companyName}
                    onChange={(e) => setWorkExpForm(prev => ({ ...prev, companyName: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Position / Job Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Marine Engineer"
                    value={workExpForm.position}
                    onChange={(e) => setWorkExpForm(prev => ({ ...prev, position: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-bold text-blue-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Start Date / Month & Year</label>
                  <input
                    type="text"
                    placeholder="e.g. March 2019 or 2019-03-01"
                    value={workExpForm.startDate}
                    onChange={(e) => setWorkExpForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-semibold"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700 uppercase">End Date / Month & Year</label>
                    <label className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={workExpForm.isCurrent}
                        onChange={(e) => setWorkExpForm(prev => ({ ...prev, isCurrent: e.target.checked }))}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      Current Job
                    </label>
                  </div>
                  <input
                    type="text"
                    disabled={workExpForm.isCurrent}
                    placeholder={workExpForm.isCurrent ? 'Present / Current Role' : 'e.g. Dec 2022'}
                    value={workExpForm.isCurrent ? '' : workExpForm.endDate}
                    onChange={(e) => setWorkExpForm(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-semibold disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Department / Industry</label>
                  <input
                    type="text"
                    placeholder="e.g. Maritime Engineering / Shipyard"
                    value={workExpForm.departmentOrIndustry}
                    onChange={(e) => setWorkExpForm(prev => ({ ...prev, departmentOrIndustry: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Last Salary (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. ₱45,000 / month"
                    value={workExpForm.salary}
                    onChange={(e) => setWorkExpForm(prev => ({ ...prev, salary: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Reason for Leaving</label>
                <input
                  type="text"
                  placeholder="e.g. Career growth / End of Contract"
                  value={workExpForm.reasonForLeaving}
                  onChange={(e) => setWorkExpForm(prev => ({ ...prev, reasonForLeaving: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Key Responsibilities / Achievements</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Supervised engine room repairs, led drydocking technical crew..."
                  value={workExpForm.responsibilities}
                  onChange={(e) => setWorkExpForm(prev => ({ ...prev, responsibilities: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowWorkExpModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveWorkExperience}
                className="px-5 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-blue-700"
              >
                Save Work Experience
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Viewer Modal */}
      <FileViewerModal
        isOpen={activeViewer.isOpen}
        onClose={() => setActiveViewer(prev => ({ ...prev, isOpen: false }))}
        fileTitle={activeViewer.title}
        filename={activeViewer.filename}
        fileIdOrUrl={activeViewer.fileIdOrUrl}
        mimeType={activeViewer.mimeType}
        notes={activeViewer.notes}
        uploadedAt={activeViewer.uploadedAt}
      />

      {/* Local Confirm Modal for EmployeeModal actions */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </>
  );
};
