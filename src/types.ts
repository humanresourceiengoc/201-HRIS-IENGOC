export type CompanyKey = 'iencc' | 'seb';

export type UserRole = 'admin' | 'viewer';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  category?: string;
  approved?: boolean;
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  blocked?: boolean;
  company: CompanyKey;
  emailVerified?: boolean;
  password?: string;
  passwordResetAt?: string;
  createdAt?: string;
}

export interface DocumentRequirement {
  id: string;
  name: string;
  required?: boolean;
  isDefault?: boolean;
}

export interface EmployeeDocument {
  id?: string;
  reqId: string;
  url?: string; // Data URL or Blob URL or http URL
  fileId?: string; // IndexedDB record key
  filename: string;
  mimeType?: string;
  size?: number;
  uploadedAt: string;
  notes?: string;
  dataUrl?: string;
}

export interface SalaryRecord {
  id: string;
  effectiveDate: string;
  previousSalary: number;
  newSalary: number;
  reason: string;
  approvedBy?: string;
  notes?: string;
}

export interface EmployeeMemo {
  id: string;
  memoNo: string;
  dateIssued: string;
  type: 'Warning' | 'Commendation' | 'Violation' | 'Notice' | 'Memo' | string;
  title: string;
  details: string;
  issuedBy?: string;
  filename?: string;
  dataUrl?: string;
  fileId?: string;
}

export interface WorkExperience {
  id: string;
  companyName: string;
  position: string;
  startDate: string;
  endDate?: string;
  isCurrent?: boolean;
  departmentOrIndustry?: string;
  reasonForLeaving?: string;
  responsibilities?: string;
  salary?: string;
}

export interface DocumentExpiryRecord {
  expiryDate: string;
  notes?: string;
}

export interface GovLoanRecord {
  id: string;
  type: 'SSS Salary Loan' | 'SSS Calamity Loan' | 'Pag-IBIG Multi-Purpose Loan (MPL)' | 'Pag-IBIG Calamity Loan' | 'Company Salary Loan' | 'Emergency Loan' | string;
  referenceNo?: string;
  loanAmount: number;
  monthlyDeduction: number; // Custom monthly deduction amount
  startDate: string;
  endDate?: string;
  status: 'ACTIVE' | 'FULLY_PAID' | 'ON_HOLD';
  remarks?: string;
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  timeIn: string;
  timeOut?: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'EXECUTIVE_LATE' | string;
  minutesLate?: number;
  notes?: string;
}

export interface CustomCalendarEvent {
  id: string;
  title: string;
  dateStr: string; // YYYY-MM-DD
  type: 'custom' | 'holiday' | 'meeting' | 'deadline' | 'event' | string;
  category?: 'Benefits' | 'Recruitment' | 'Compliance' | 'Performance Evaluation' | 'Payroll / Last Pay' | 'General HR' | 'Employee Relations' | string;
  description?: string;
  company: CompanyKey;
  createdAt?: string;
}

export interface Employee {
  id: string;
  empId: string;
  company?: CompanyKey;
  employeeNumber?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string; // Jr., Sr., III, II, IV, PhD, etc.
  preferredName?: string;
  photoUrl?: string;
  photoFileId?: string;
  employeeSignatureUrl?: string;

  // Master Info
  birthdate?: string;
  bloodType?: string; // e.g. O+, A+, B+, AB+, O-, etc.
  age?: number | string;
  placeOfBirth?: string;
  nationality?: string;
  civilStatus?: string;
  gender: 'MALE' | 'FEMALE' | string;
  religion?: string;
  mobileNumber?: string;
  personalEmail?: string;
  companyEmail?: string;
  email3?: string;
  currentAddress?: string;
  permanentAddress?: string;

  // Emergency Contact
  emergencyName?: string;
  emergencyRelation?: string;
  emergencyContact?: string;
  emergencyAddress?: string;

  // Family Info
  motherMaidenName?: string;
  motherOccupation?: string;
  fatherName?: string;
  fatherOccupation?: string;
  spouseName?: string;
  spouseOccupation?: string;
  numChildren?: number | string;
  numberOfChildren?: number | string;
  childNames?: string;
  childBirthdates?: string;
  childBirthDates?: string;
  childrenList?: { id?: string; name: string; birthDate: string }[];
  workExperience?: WorkExperience[];

  // Employment Info
  dateHired?: string;
  dateStarted?: string;
  status: 'ACTIVE' | 'RESIGNED' | 'SEPARATED' | 'SUSPENDED' | 'ON LEAVE' | string;
  classification: string; // Regular, Probationary, Contractual, Project-Based, Casual, Part-Time, Executive, etc.
  employmentType?: 'Full-Time' | 'Part-Time' | string;
  dateOfRegularization?: string;
  regularizationDate?: string;
  probationStartDate?: string;
  probationEndDate?: string;
  regularizationStatus?: 'Pending' | 'Regularized' | 'Failed' | string;
  endOfContractDate?: string;
  separationDate?: string;
  separationReason?: 'Resignation' | 'End of Contract' | 'AWOL' | 'Termination' | 'Retirement' | 'Health Reasons' | string;
  lastPayScheduleDate?: string;
  lastPayStatus?: 'PENDING' | 'PROCESSED' | 'RELEASED' | string;
  lastPayAmount?: number | string; // How Much (hm) final pay amount
  tenures?: string;

  // Organizational Details
  department?: string;
  division?: string; // Business Unit
  position?: string;
  bioId?: string; // Biometric ID
  newBioId?: string; // New Biometric ID
  verifier?: string; // Verifier / HR Supervisor
  jobLevel?: string; // Grade
  employeeCategory?: 'Rank & File' | 'Supervisor' | 'Manager' | 'Executive' | string;
  immediateSupervisor?: string; // Reporting Line / Department Head
  reportsToId?: string; // Supervisor Employee ID for Org Chart tree
  locationBranch?: 'Mandaluyong' | 'Legazpi, Albay' | string;
  branchCode?: string;
  workLocationType?: 'Office' | 'Remote' | 'Hybrid' | string;
  costCenter?: string;
  orgLevel?: 'Executive' | 'Management' | 'Supervisor' | 'Team Lead' | 'Staff' | string;

  // Compensation & Benefits
  monthlySalary?: number | string;
  salaryGrade?: string;
  payrollNumber?: string;
  payRateType?: 'Monthly' | 'Daily' | 'Hourly' | string;
  salaryEffectiveDate?: string;
  allowances?: string; // e.g. Rice, Location/Branch, Transportation Allowance
  payrollSchedule?: string; // Semi-Monthly, Weekly, Monthly
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  sss?: string;
  pagibig?: string;
  philhealth?: string;
  tin?: string;
  benefitEnrollment?: string;
  hmoDetails?: string; // HMO Provider, Plan, Card #
  hmoProvider?: string; // Maxicare, Intellicare, Medicard, CareHealth Plus, PhilCare, etc.
  hmoCardNumber?: string; // Member / Card ID
  hmoCoverage?: string; // Principal, MBL, Dependents coverage
  salaryHistory?: SalaryRecord[];
  govLoans?: GovLoanRecord[];

  // Recruitment & Hiring Details
  applicantId?: string;
  recruitmentSource?: 'Referral' | 'Job Portal' | 'Walk-in' | 'Agency' | 'Direct' | string;
  positionAppliedFor?: string;
  applicationDate?: string;
  interviewResults?: string;
  hiringManager?: string;
  hiringStatus?: string;
  offerDate?: string;
  previousCompany?: string;

  // Attendance & Leave Records
  workSchedule?: string;
  shift?: string;
  timeInTimeOut?: string;
  leaveCredits?: string;
  leaveHistory?: string;
  absenceRecords?: string;
  latenessUndertime?: string;
  overtimeRecords?: string;
  officialBusinessRecords?: string;
  holidayCalendar?: string;
  leaveApprovalHistory?: string;
  attendanceRecords?: AttendanceRecord[];

  // Performance Management
  performanceRating?: string;
  evaluationDate?: string;
  appraisalResult?: string;
  competencyRating?: string;
  performanceReviewCycle?: string;
  reviewerSupervisor?: string;
  promotionRecommendation?: string;
  pipDetails?: string;
  goalsKpis?: string;
  developmentPlan?: string;
  perfReviews?: {
    month3Done?: boolean;
    month3Date?: string;
    month3Notes?: string;
    month5Done?: boolean;
    month5Date?: string;
    month5Notes?: string;
  };

  // Training & Development
  trainingName?: string;
  trainingDate?: string;
  provider?: string;
  trainingCost?: string;
  trainingHours?: string;
  trainingStatus?: string;
  certificates?: string;
  expiryDateOfCertification?: string;
  skillsCompetencies?: string;

  // Disciplinary Records
  caseNumber?: string;
  dateReported?: string;
  incidentDate?: string;
  incidentDescription?: string;
  violation?: string;
  employeeResponse?: string;
  investigatingOfficer?: string;
  actionTaken?: string;
  warningNoticeIssued?: string;
  resolution?: string;
  memos?: EmployeeMemo[];

  // Separation & Exit Records
  separationType?: 'Voluntary' | 'Involuntary' | 'End of Contract' | 'AWOL' | 'Retirement' | string;
  resignationDate?: string;
  noticeDate?: string;
  lastWorkingDay?: string;
  exitClearanceDate?: string;
  exitInterviewDate?: string;
  exitInterviewResult?: string;
  clearanceStatus?: string;
  reasonForLeaving?: string;
  rehireEligibility?: 'Yes' | 'No' | string;

  // Document Management
  documents?: Record<string, EmployeeDocument>;
  docExpiries?: Record<string, string>;
  signedPoliciesAcknowledgment?: boolean | string;
  employeeHandbookAcknowledgment?: boolean | string;
  dataPrivacyConsent?: boolean | string;

  createdAt?: string;
}

export interface CompanyConfig {
  key: CompanyKey;
  name: string;
  fullName: string;
  color: string;
  lightColor: string;
  cssClass: string;
}

export interface CollaboratorPresence {
  id: string;
  name: string;
  email: string;
  role?: UserRole;
  blocked?: boolean;
  verificationStatus?: string;
  company: CompanyKey;
  browser: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  lastActive: string;
  status: 'online' | 'idle' | 'editing';
  currentView?: string;
}
