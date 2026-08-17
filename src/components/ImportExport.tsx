import React, { useState, useRef } from 'react';
import { CompanyKey, DocumentRequirement, Employee, UserRole } from '../types';
import { saveEmployee } from '../lib/db';
import {
  Upload,
  Download,
  CheckCircle2,
  FileSpreadsheet,
  FileJson,
  FileText,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  Table,
  Check,
  Building,
  UserCheck,
  Users,
  CreditCard,
  DownloadCloud,
  UploadCloud,
  FileUp,
  SlidersHorizontal
} from 'lucide-react';
import { GoogleSheetsIntegration } from './GoogleSheetsIntegration';

interface ImportExportProps {
  company: CompanyKey;
  userRole?: UserRole;
  requirements?: DocumentRequirement[];
  employees: Employee[];
  filteredEmployees?: Employee[];
  onRefreshData: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  compact?: boolean;
}

interface ParsedEmployeeRow {
  empId: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  suffix?: string;
  department?: string;
  position?: string;
  division?: string;
  locationBranch?: string;
  status?: string;
  classification?: string;
  dateHired?: string;
  monthlySalary?: number;
  mobileNumber?: string;
  companyEmail?: string;
  personalEmail?: string;
  email3?: string;
  bioId?: string;
  newBioId?: string;
  verifier?: string;
  sss?: string;
  pagibig?: string;
  philhealth?: string;
  tin?: string;
  bankName?: string;
  bankAccountNumber?: string;
  birthdate?: string;
  civilStatus?: string;
  gender?: string;
  currentAddress?: string;
  emergencyName?: string;
  emergencyRelation?: string;
  emergencyContact?: string;
  isExisting?: boolean;
}

export const ImportExport: React.FC<ImportExportProps> = ({
  company,
  userRole = 'admin',
  requirements = [],
  employees,
  filteredEmployees = employees,
  onRefreshData,
  onToast,
  compact = false
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'sheets'>('export');
  const [showGoogleSheets, setShowGoogleSheets] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(true);

  // Import file parsing state
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedEmployeeRow[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [importFormat, setImportFormat] = useState<'masterlist' | 'standard' | 'json'>('masterlist');
  const [importStats, setImportStats] = useState<{ total: number; newCount: number; updateCount: number }>({
    total: 0,
    newCount: 0,
    updateCount: 0
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const companyFullName = company === 'iencc'
    ? 'I-ENERGIES CONSTRUCTION CORPORATION'
    : 'SUPERIOR ENERGIES BUILDERS & DEVELOPMENT CORP.';

  // Helper CSV parser supporting quoted commas and multi-line strings
  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentCell += '"';
          i++; // skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  };

  // Helper to escape CSV values
  const escapeCSV = (val: any): string => {
    const s = String(val ?? '').replace(/"/g, '""');
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s}"`;
    }
    return s;
  };

  // Download Trigger Helper
  const triggerDownload = (content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onToast(`Downloaded ${filename}`, 'success');
  };

  // 1. EXPORT 23-COLUMN CORPORATE MASTERLIST CSV
  const exportMasterlistCSV = (dataList: Employee[] = employees, label: string = 'All') => {
    if (dataList.length === 0) {
      onToast('No employee records to export.', 'warning');
      return;
    }

    // Row 1: Super Headers
    const superHeaders = [
      'No.', '', 'Name', '', '', 'Birthday', 'Address', 'Contact Information', '', '', '',
      'Employment Information', '', '', '', '', '', '', 'Verifier', 'GOVERNMENT NUMBERS', '', '', ''
    ];

    // Row 2: Sub Headers
    const subHeaders = [
      '', 'EE ID', 'Last', 'First', 'Middle', '', '', 'Cell No.', 'Email 1', 'Email 2', 'Email 3',
      'Name', 'Date Hired', 'Department', 'Position', 'Bio ID', 'New Bio ID', 'Status', '',
      'SSS', 'PHILHEALTH', 'HDMF', 'TIN'
    ];

    const dataRows = dataList.map((emp, index) => {
      return [
        index + 1,
        emp.empId || '',
        emp.lastName || '',
        emp.firstName || '',
        emp.middleName || '',
        emp.birthdate || '',
        emp.currentAddress || '',
        emp.mobileNumber || '',
        emp.companyEmail || '',
        emp.personalEmail || '',
        emp.email3 || '',
        emp.company ? emp.company.toUpperCase() : company.toUpperCase(),
        emp.dateHired || '',
        emp.department || '',
        emp.position || '',
        emp.bioId || '',
        emp.newBioId || '',
        emp.status || 'ACTIVE',
        emp.verifier || '',
        emp.sss || '',
        emp.philhealth || '',
        emp.pagibig || '',
        emp.tin || ''
      ].map(escapeCSV).join(',');
    });

    const csvContent = '\uFEFF' + [
      superHeaders.map(escapeCSV).join(','),
      subHeaders.map(escapeCSV).join(','),
      ...dataRows
    ].join('\n');

    const dateStr = new Date().toISOString().slice(0, 10);
    triggerDownload(csvContent, `${company.toUpperCase()}_Masterlist_23Col_${label}_${dateStr}.csv`);
  };

  // 2. EXPORT COMPLETE STANDARD HRIS CSV (All 30+ Fields)
  const exportCompleteHRISCSV = (dataList: Employee[] = employees, label: string = 'Complete') => {
    if (dataList.length === 0) {
      onToast('No employee records to export.', 'warning');
      return;
    }

    const headers = [
      'empId', 'lastName', 'firstName', 'middleName', 'suffix', 'gender', 'birthdate', 'civilStatus',
      'currentAddress', 'mobileNumber', 'personalEmail', 'companyEmail', 'email3',
      'department', 'position', 'division', 'locationBranch', 'dateHired', 'status', 'classification',
      'monthlySalary', 'bioId', 'newBioId', 'verifier',
      'sss', 'philhealth', 'pagibig', 'tin', 'bankName', 'bankAccountNumber',
      'emergencyName', 'emergencyRelation', 'emergencyContact', 'separationDate', 'tenures'
    ];

    const dataRows = dataList.map(emp => {
      return headers.map(h => escapeCSV((emp as any)[h] ?? '')).join(',');
    });

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...dataRows
    ].join('\n');

    const dateStr = new Date().toISOString().slice(0, 10);
    triggerDownload(csvContent, `${company.toUpperCase()}_Full_HRIS_${label}_${dateStr}.csv`);
  };

  // 3. EXPORT GOVERNMENT COMPLIANCE & VERIFIER CSV
  const exportGovNumbersCSV = () => {
    if (employees.length === 0) {
      onToast('No employee records to export.', 'warning');
      return;
    }

    const headers = ['No.', 'Employee ID', 'Full Name', 'Department', 'Position', 'SSS No.', 'PhilHealth No.', 'Pag-IBIG (HDMF) No.', 'TIN No.', 'Verifier', 'Status'];
    const rows = employees.map((emp, idx) => [
      idx + 1,
      emp.empId,
      `${emp.lastName}, ${emp.firstName} ${emp.middleName || ''}`.trim(),
      emp.department || '',
      emp.position || '',
      emp.sss || 'MISSING',
      emp.philhealth || 'MISSING',
      emp.pagibig || 'MISSING',
      emp.tin || 'MISSING',
      emp.verifier || 'N/A',
      emp.status || 'ACTIVE'
    ].map(escapeCSV).join(','));

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    triggerDownload(csvContent, `${company.toUpperCase()}_Gov_Compliance_Report_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // 4. EXPORT FULL CLOUD BACKUP (JSON)
  const exportFullJSONBackup = () => {
    const backupData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      company: company,
      companyFullName: companyFullName,
      totalEmployees: employees.length,
      employees: employees,
      requirements: requirements
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    triggerDownload(jsonString, `${company.toUpperCase()}_Full_Cloud_Backup_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  };

  // 5. DOWNLOAD TEMPLATES
  const downloadSample23ColTemplate = () => {
    const superHeaders = [
      'No.', '', 'Name', '', '', 'Birthday', 'Address', 'Contact Information', '', '', '',
      'Employment Information', '', '', '', '', '', '', 'Verifier', 'GOVERNMENT NUMBERS', '', '', ''
    ];
    const subHeaders = [
      '', 'EE ID', 'Last', 'First', 'Middle', '', '', 'Cell No.', 'Email 1', 'Email 2', 'Email 3',
      'Name', 'Date Hired', 'Department', 'Position', 'Bio ID', 'New Bio ID', 'Status', '',
      'SSS', 'PHILHEALTH', 'HDMF', 'TIN'
    ];
    const sampleRow = [
      '1', 'EMP-2024-001', 'Dela Cruz', 'Juan', 'Santos', '1990-05-15', '123 Rizal St, Mandaluyong City',
      '09171234567', 'juan.delacruz@company.com', 'juan.personal@gmail.com', '', company.toUpperCase(),
      '2024-01-15', 'Engineering', 'Civil Engineer', 'BIO-101', 'NB-101', 'ACTIVE', 'HR Officer',
      '04-1234567-8', '12-345678901-2', '1234-5678-9012', '123-456-789-000'
    ];

    const csvContent = '\uFEFF' + [
      superHeaders.map(escapeCSV).join(','),
      subHeaders.map(escapeCSV).join(','),
      sampleRow.map(escapeCSV).join(',')
    ].join('\n');

    triggerDownload(csvContent, `Masterlist_23Columns_Sample_Template.csv`);
  };

  const downloadBlankTemplate = () => {
    const superHeaders = [
      'No.', '', 'Name', '', '', 'Birthday', 'Address', 'Contact Information', '', '', '',
      'Employment Information', '', '', '', '', '', '', 'Verifier', 'GOVERNMENT NUMBERS', '', '', ''
    ];
    const subHeaders = [
      '', 'EE ID', 'Last', 'First', 'Middle', '', '', 'Cell No.', 'Email 1', 'Email 2', 'Email 3',
      'Name', 'Date Hired', 'Department', 'Position', 'Bio ID', 'New Bio ID', 'Status', '',
      'SSS', 'PHILHEALTH', 'HDMF', 'TIN'
    ];

    const csvContent = '\uFEFF' + [
      superHeaders.map(escapeCSV).join(','),
      subHeaders.map(escapeCSV).join(',')
    ].join('\n');

    triggerDownload(csvContent, `Masterlist_23Columns_Blank_Template.csv`);
  };

  // HANDLE CSV / FILE UPLOAD PARSING
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportedFile(file);

    if (file.name.endsWith('.json')) {
      handleJSONFile(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        onToast('The uploaded file is empty.', 'error');
        return;
      }

      const allRows = parseCSV(text);
      if (allRows.length < 2) {
        onToast('The CSV file does not contain enough data rows.', 'error');
        return;
      }

      // Check if 2-row multi-level masterlist header exists
      let is2RowMasterlist = false;
      let dataStartIdx = 1;
      let headers: string[] = allRows[0];

      if (allRows.length >= 3) {
        const row0 = allRows[0].map(s => s.toLowerCase());
        const row1 = allRows[1].map(s => s.toLowerCase());
        if (
          row0.some(h => h.includes('government') || h.includes('contact') || h.includes('employment')) ||
          row1.some(h => h.includes('ee id') || h.includes('last') || h.includes('bio id') || h.includes('sss'))
        ) {
          is2RowMasterlist = true;
          dataStartIdx = 2;
          headers = [
            'No.', 'EE ID', 'Last', 'First', 'Middle', 'Birthday', 'Address', 'Cell No.', 'Email 1', 'Email 2', 'Email 3',
            'Name', 'Date Hired', 'Department', 'Position', 'Bio ID', 'New Bio ID', 'Status', 'Verifier',
            'SSS', 'PHILHEALTH', 'HDMF', 'TIN'
          ];
        }
      }

      const parsedRecords: ParsedEmployeeRow[] = [];
      const existingEmpIds = new Set(employees.map(e => (e.empId || '').trim().toLowerCase()));

      let newC = 0;
      let updateC = 0;

      for (let i = dataStartIdx; i < allRows.length; i++) {
        const row = allRows[i];
        if (!row || row.length === 0 || row.every(c => !c.trim())) continue;

        let record: ParsedEmployeeRow;

        if (is2RowMasterlist || row.length >= 18) {
          // Column index mapping for 23-column masterlist:
          // 0: No., 1: EE ID, 2: Last, 3: First, 4: Middle, 5: Birthday, 6: Address, 7: Cell No.,
          // 8: Email 1, 9: Email 2, 10: Email 3, 11: Company/Name, 12: Date Hired, 13: Department,
          // 14: Position, 15: Bio ID, 16: New Bio ID, 17: Status, 18: Verifier, 19: SSS, 20: PHILHEALTH, 21: HDMF, 22: TIN
          const empId = row[1]?.trim() || `EMP-${Date.now()}-${parsedRecords.length + 1}`;
          const isExisting = existingEmpIds.has(empId.toLowerCase());

          record = {
            empId,
            lastName: row[2]?.trim() || 'Unknown',
            firstName: row[3]?.trim() || 'Unknown',
            middleName: row[4]?.trim() || '',
            birthdate: row[5]?.trim() || '',
            currentAddress: row[6]?.trim() || '',
            mobileNumber: row[7]?.trim() || '',
            companyEmail: row[8]?.trim() || '',
            personalEmail: row[9]?.trim() || '',
            email3: row[10]?.trim() || '',
            dateHired: row[12]?.trim() || '',
            department: row[13]?.trim() || '',
            position: row[14]?.trim() || '',
            bioId: row[15]?.trim() || '',
            newBioId: row[16]?.trim() || '',
            status: row[17]?.trim() || 'ACTIVE',
            verifier: row[18]?.trim() || '',
            sss: row[19]?.trim() || '',
            philhealth: row[20]?.trim() || '',
            pagibig: row[21]?.trim() || '',
            tin: row[22]?.trim() || '',
            isExisting
          };
        } else {
          // Standard CSV mapping by header name
          const headerMap: { [key: string]: number } = {};
          headers.forEach((h, idx) => {
            headerMap[h.trim().toLowerCase()] = idx;
          });

          const getVal = (possibleKeys: string[]) => {
            for (const k of possibleKeys) {
              const idx = headerMap[k.toLowerCase()];
              if (idx !== undefined && row[idx] !== undefined) {
                return row[idx].trim();
              }
            }
            return '';
          };

          const empId = getVal(['empid', 'ee id', 'employee id', 'id']) || `EMP-${Date.now()}-${parsedRecords.length + 1}`;
          const isExisting = existingEmpIds.has(empId.toLowerCase());

          record = {
            empId,
            lastName: getVal(['lastname', 'last name', 'last', 'surname']) || 'Unknown',
            firstName: getVal(['firstname', 'first name', 'first']) || 'Unknown',
            middleName: getVal(['middlename', 'middle name', 'middle']),
            suffix: getVal(['suffix']),
            department: getVal(['department', 'dept']),
            position: getVal(['position', 'job title', 'title']),
            division: getVal(['division']),
            locationBranch: getVal(['locationbranch', 'location', 'branch']),
            status: getVal(['status', 'employment status']) || 'ACTIVE',
            classification: getVal(['classification', 'class']) || 'Regular',
            dateHired: getVal(['datehired', 'date hired', 'hired date']),
            monthlySalary: parseFloat(getVal(['monthlysalary', 'salary', 'basic salary'])) || 0,
            mobileNumber: getVal(['mobilenumber', 'mobile', 'cell no.', 'cell no', 'phone']),
            companyEmail: getVal(['companyemail', 'company email', 'email 1', 'email']),
            personalEmail: getVal(['personalemail', 'personal email', 'email 2']),
            email3: getVal(['email3', 'email 3']),
            bioId: getVal(['bioid', 'bio id']),
            newBioId: getVal(['newbioid', 'new bio id']),
            verifier: getVal(['verifier']),
            sss: getVal(['sss', 'sss no', 'sss number']),
            pagibig: getVal(['pagibig', 'pag-ibig', 'hdmf', 'pagibig no']),
            philhealth: getVal(['philhealth', 'phic', 'philhealth no']),
            tin: getVal(['tin', 'tin no', 'tin number']),
            bankName: getVal(['bankname', 'bank']),
            bankAccountNumber: getVal(['bankaccountnumber', 'bank account', 'account number']),
            birthdate: getVal(['birthdate', 'birthday', 'dob']),
            civilStatus: getVal(['civilstatus', 'civil status', 'marital status']),
            gender: getVal(['gender', 'sex']),
            currentAddress: getVal(['currentaddress', 'address']),
            emergencyName: getVal(['emergencyname', 'emergency contact person']),
            emergencyRelation: getVal(['emergencyrelation', 'relationship']),
            emergencyContact: getVal(['emergencycontact', 'emergency number']),
            isExisting
          };
        }

        if (record.isExisting) {
          updateC++;
        } else {
          newC++;
        }

        parsedRecords.push(record);
      }

      setPreviewHeaders(headers);
      setPreviewRows(parsedRecords);
      setImportFormat(is2RowMasterlist ? 'masterlist' : 'standard');
      setImportStats({
        total: parsedRecords.length,
        newCount: newC,
        updateCount: updateC
      });

      onToast(`Loaded ${parsedRecords.length} records ready for preview!`, 'info');
    };

    reader.readAsText(file);
  };

  // HANDLE JSON FULL RESTORE
  const handleJSONFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!json.employees || !Array.isArray(json.employees)) {
          onToast('Invalid JSON Backup file format.', 'error');
          return;
        }

        const existingEmpIds = new Set(employees.map(emp => (emp.empId || '').trim().toLowerCase()));
        let newC = 0;
        let updateC = 0;

        const rows: ParsedEmployeeRow[] = json.employees.map((emp: any) => {
          const isExisting = existingEmpIds.has((emp.empId || '').trim().toLowerCase());
          if (isExisting) updateC++;
          else newC++;
          return {
            ...emp,
            isExisting
          };
        });

        setPreviewHeaders(['empId', 'lastName', 'firstName', 'department', 'position', 'status', 'dateHired']);
        setPreviewRows(rows);
        setImportFormat('json');
        setImportStats({
          total: rows.length,
          newCount: newC,
          updateCount: updateC
        });
        onToast(`Loaded JSON Backup with ${rows.length} employee records!`, 'info');
      } catch (err) {
        onToast('Failed to parse JSON file.', 'error');
      }
    };
    reader.readAsText(file);
  };

  // CONFIRM IMPORT TO FIRESTORE PERMANENT STORAGE
  const handleConfirmImport = async () => {
    if (previewRows.length === 0) {
      onToast('No parsed records to import.', 'warning');
      return;
    }

    setIsImporting(true);
    let imported = 0;

    try {
      for (const row of previewRows) {
        // If employee exists and user disabled overwrite, skip
        if (row.isExisting && !overwriteExisting) {
          continue;
        }

        const existingEmp = employees.find(e => (e.empId || '').trim().toLowerCase() === (row.empId || '').trim().toLowerCase());

        const cleanEmp: Partial<Employee> = {
          ...(existingEmp?.id ? { id: existingEmp.id } : {}),
          empId: row.empId || `EMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          lastName: row.lastName || 'Unknown',
          firstName: row.firstName || 'Unknown',
          middleName: row.middleName || '',
          suffix: row.suffix || '',
          department: row.department || '',
          position: row.position || '',
          division: row.division || '',
          locationBranch: row.locationBranch || 'Mandaluyong',
          status: (row.status as any) || 'ACTIVE',
          classification: (row.classification as any) || 'Regular',
          dateHired: row.dateHired || '',
          monthlySalary: row.monthlySalary || 0,
          mobileNumber: row.mobileNumber || '',
          companyEmail: row.companyEmail || '',
          personalEmail: row.personalEmail || '',
          email3: row.email3 || '',
          bioId: row.bioId || '',
          newBioId: row.newBioId || '',
          verifier: row.verifier || '',
          sss: row.sss || '',
          pagibig: row.pagibig || '',
          philhealth: row.philhealth || '',
          tin: row.tin || '',
          bankName: row.bankName || 'BDO',
          bankAccountNumber: row.bankAccountNumber || '',
          birthdate: row.birthdate || '',
          civilStatus: (row.civilStatus as any) || 'Single',
          gender: (row.gender as any) || 'Male',
          currentAddress: row.currentAddress || '',
          emergencyName: row.emergencyName || '',
          emergencyRelation: row.emergencyRelation || '',
          emergencyContact: row.emergencyContact || '',
        };

        saveEmployee(company, cleanEmp);
        imported++;
      }

      onRefreshData();
      onToast(`Successfully saved and imported ${imported} records permanently to Cloud Database!`, 'success');
      setPreviewRows([]);
      setImportedFile(null);
    } catch (err: any) {
      onToast(`Import failed: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-sm">
            <DownloadCloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-900">HRIS Import & Export Center</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                {company.toUpperCase()} Records ({employees.length})
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Securely import batch employee data or export 23-column masterlists, complete HRIS reports, and cloud backups.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'export'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export Reports</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'import'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            <span>Import CSV / Backup</span>
          </button>
          <button
            onClick={() => setActiveTab('sheets')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'sheets'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Google Sheets Live</span>
          </button>
        </div>
      </div>

      {/* TAB 1: EXPORT SECTION */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          {/* Main 23-Column Masterlist Card (Primary) */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-3xl border border-slate-700 text-white shadow-md space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Official Format
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">2-Row Categorized Layout</span>
                </div>
                <h3 className="text-base font-extrabold text-white">23-Column Employee Masterlist (CSV / Spreadsheet)</h3>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Export employee records structured into 23 corporate columns with categorized super-headers (No, EE ID, Name, Birthday, Address, Contact Information, Employment Info, Verifier, Government Numbers).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => exportMasterlistCSV(employees, 'All')}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Masterlist CSV ({employees.length})</span>
                </button>
                {filteredEmployees.length !== employees.length && (
                  <button
                    onClick={() => exportMasterlistCSV(filteredEmployees, 'Filtered')}
                    className="px-3.5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                    <span>Filtered List ({filteredEmployees.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* 23 Columns Pill Preview */}
            <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-700/60 text-[10px] space-y-1.5">
              <span className="text-slate-400 font-bold block">Included Masterlist Headers:</span>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-semibold border border-slate-700">1. No.</span>
                <span className="px-2 py-0.5 bg-blue-900/70 text-blue-200 rounded font-bold border border-blue-700/60">2. EE ID</span>
                <span className="px-2 py-0.5 bg-blue-900/70 text-blue-200 rounded font-bold border border-blue-700/60">3. Last</span>
                <span className="px-2 py-0.5 bg-blue-900/70 text-blue-200 rounded font-bold border border-blue-700/60">4. First</span>
                <span className="px-2 py-0.5 bg-blue-900/70 text-blue-200 rounded font-bold border border-blue-700/60">5. Middle</span>
                <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-semibold border border-slate-700">6. Birthday</span>
                <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-semibold border border-slate-700">7. Address</span>
                <span className="px-2 py-0.5 bg-indigo-900/70 text-indigo-200 rounded font-bold border border-indigo-700/60">8. Cell No.</span>
                <span className="px-2 py-0.5 bg-indigo-900/70 text-indigo-200 rounded font-bold border border-indigo-700/60">9. Email 1</span>
                <span className="px-2 py-0.5 bg-indigo-900/70 text-indigo-200 rounded font-bold border border-indigo-700/60">10. Email 2</span>
                <span className="px-2 py-0.5 bg-indigo-900/70 text-indigo-200 rounded font-bold border border-indigo-700/60">11. Email 3</span>
                <span className="px-2 py-0.5 bg-purple-900/70 text-purple-200 rounded font-bold border border-purple-700/60">12. Name</span>
                <span className="px-2 py-0.5 bg-purple-900/70 text-purple-200 rounded font-bold border border-purple-700/60">13. Date Hired</span>
                <span className="px-2 py-0.5 bg-purple-900/70 text-purple-200 rounded font-bold border border-purple-700/60">14. Department</span>
                <span className="px-2 py-0.5 bg-purple-900/70 text-purple-200 rounded font-bold border border-purple-700/60">15. Position</span>
                <span className="px-2 py-0.5 bg-purple-900/70 text-purple-200 rounded font-bold border border-purple-700/60">16. Bio ID</span>
                <span className="px-2 py-0.5 bg-purple-900/70 text-purple-200 rounded font-bold border border-purple-700/60">17. New Bio ID</span>
                <span className="px-2 py-0.5 bg-purple-900/70 text-purple-200 rounded font-bold border border-purple-700/60">18. Status</span>
                <span className="px-2 py-0.5 bg-amber-900/70 text-amber-200 rounded font-bold border border-amber-700/60">19. Verifier</span>
                <span className="px-2 py-0.5 bg-emerald-900/70 text-emerald-200 rounded font-bold border border-emerald-700/60">20. SSS</span>
                <span className="px-2 py-0.5 bg-emerald-900/70 text-emerald-200 rounded font-bold border border-emerald-700/60">21. PHILHEALTH</span>
                <span className="px-2 py-0.5 bg-emerald-900/70 text-emerald-200 rounded font-bold border border-emerald-700/60">22. HDMF</span>
                <span className="px-2 py-0.5 bg-emerald-900/70 text-emerald-200 rounded font-bold border border-emerald-700/60">23. TIN</span>
              </div>
            </div>
          </div>

          {/* Export Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Complete Full HRIS Dataset */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h4 className="font-extrabold text-sm text-slate-900">Complete HRIS Data (All 30+ Fields)</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Includes bank accounts, compensation, emergency contacts, 201 tenure, and complete HR record details.
                </p>
              </div>
              <button
                onClick={() => exportCompleteHRISCSV(employees, 'All')}
                className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-blue-200 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Export Complete CSV
              </button>
            </div>

            {/* Government IDs Compliance */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h4 className="font-extrabold text-sm text-slate-900">Government Numbers Report</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Export SSS, PhilHealth, Pag-IBIG (HDMF), TIN, and Verifier names for auditing and mandatory government remittances.
                </p>
              </div>
              <button
                onClick={exportGovNumbersCSV}
                className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-amber-200 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Export Gov IDs CSV
              </button>
            </div>

            {/* Full Cloud Backup (JSON) */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <FileJson className="w-5 h-5" />
                </div>
                <h4 className="font-extrabold text-sm text-slate-900">Full Cloud JSON Backup</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Download a complete, portable offline snapshot containing all employee objects and requirement configurations.
                </p>
              </div>
              <button
                onClick={exportFullJSONBackup}
                className="w-full py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-purple-200 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download JSON Backup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: IMPORT SECTION */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* Top Info & Template Download Bar */}
          <div className="bg-blue-50/80 p-4 rounded-3xl border border-blue-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-blue-900">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Need a sample file or blank template to fill out?</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={downloadSample23ColTemplate}
                className="px-3 py-1.5 bg-white hover:bg-blue-100 text-blue-800 rounded-xl font-bold border border-blue-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3 h-3 text-blue-600" /> Sample 23-Col CSV
              </button>
              <button
                onClick={downloadBlankTemplate}
                className="px-3 py-1.5 bg-white hover:bg-blue-100 text-blue-800 rounded-xl font-bold border border-blue-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3 h-3 text-blue-600" /> Blank Template CSV
              </button>
            </div>
          </div>

          {/* Upload Dropzone Box */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Upload CSV or JSON Backup File</h3>
                <p className="text-xs text-slate-500">Supports standard CSV, 23-Column Masterlist CSV, and JSON cloud backups.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.json"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose File to Import</span>
                </button>
              </div>
            </div>

            {/* Drag & Drop Visual Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/20 rounded-2xl p-8 text-center transition-all cursor-pointer space-y-2"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <FileUp className="w-6 h-6" />
              </div>
              <p className="font-bold text-sm text-slate-800">
                {importedFile ? importedFile.name : 'Click to Browse or Drag & Drop your file here'}
              </p>
              <p className="text-xs text-slate-400">
                Supported formats: <strong>.csv</strong> (23 Columns or standard HRIS), <strong>.json</strong> (Full backup)
              </p>
            </div>
          </div>

          {/* PREVIEW & CONFIRMATION SECTION */}
          {previewRows.length > 0 && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-900">Parsed Preview</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                      {importFormat === 'masterlist' ? '23-Column Masterlist Format' : importFormat === 'json' ? 'JSON Cloud Snapshot' : 'Standard HRIS Format'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span>Total Rows: <strong className="font-bold text-slate-900">{importStats.total}</strong></span>
                    <span className="text-emerald-700">New Records: <strong className="font-bold">{importStats.newCount}</strong></span>
                    <span className="text-amber-700">Existing Records: <strong className="font-bold">{importStats.updateCount}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overwriteExisting}
                      onChange={(e) => setOverwriteExisting(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <span>Update existing EE IDs</span>
                  </label>

                  <button
                    onClick={() => {
                      setPreviewRows([]);
                      setImportedFile(null);
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleConfirmImport}
                    disabled={isImporting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>{isImporting ? 'Saving to Cloud...' : `Confirm & Save ${previewRows.length} to Cloud`}</span>
                  </button>
                </div>
              </div>

              {/* Table Preview */}
              <div className="overflow-x-auto max-h-64 border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-600 text-[11px]">
                      <th className="py-2.5 px-3">STATUS</th>
                      <th className="py-2.5 px-3">EE ID</th>
                      <th className="py-2.5 px-3">NAME</th>
                      <th className="py-2.5 px-3">DEPARTMENT</th>
                      <th className="py-2.5 px-3">POSITION</th>
                      <th className="py-2.5 px-3">DATE HIRED</th>
                      <th className="py-2.5 px-3">SSS</th>
                      <th className="py-2.5 px-3">TIN</th>
                      <th className="py-2.5 px-3">VERIFIER</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3">
                          {row.isExisting ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md">Update</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">New</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">{row.empId}</td>
                        <td className="py-2 px-3 font-semibold text-slate-800">
                          {row.lastName}, {row.firstName} {row.middleName || ''}
                        </td>
                        <td className="py-2 px-3 text-slate-600">{row.department || '-'}</td>
                        <td className="py-2 px-3 text-slate-600">{row.position || '-'}</td>
                        <td className="py-2 px-3 text-slate-600">{row.dateHired || '-'}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-600">{row.sss || '-'}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-600">{row.tin || '-'}</td>
                        <td className="py-2 px-3 text-slate-600">{row.verifier || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GOOGLE SHEETS LIVE INTEGRATION */}
      {activeTab === 'sheets' && (
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 text-white shadow-xl space-y-4">
          <GoogleSheetsIntegration
            company={company}
            companyName={companyFullName}
            userRole={userRole}
            employees={employees}
            onRefreshData={onRefreshData}
            onToast={onToast}
          />
        </div>
      )}
    </div>
  );
};
