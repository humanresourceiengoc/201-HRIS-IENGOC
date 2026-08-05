import React, { useState } from 'react';
import { CompanyKey, DocumentRequirement, Employee, UserRole } from '../types';
import { saveEmployee } from '../lib/db';
import { Upload, Download, CheckCircle, FileSpreadsheet } from 'lucide-react';
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

export const ImportExport: React.FC<ImportExportProps> = ({
  company,
  userRole = 'admin',
  employees,
  filteredEmployees = employees,
  onRefreshData,
  onToast,
  compact = false
}) => {
  const [csvPreviewData, setCsvPreviewData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);

  const companyFullName = company === 'iencc'
    ? 'I-ENERGIES CONSTRUCTION CORPORATION'
    : 'SUPERIOR ENERGIES BUILDERS & DEVELOPMENT CORP.';

  // CSV Helper functions
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleCsvSelect = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        onToast('CSV file is empty or missing headers.', 'error');
        return;
      }

      const headers = parseCSVLine(lines[0]);
      const rows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const vals = parseCSVLine(lines[i]);
        const rowObj: any = {};
        (headers || []).forEach((h, idx) => {
          rowObj[h.trim()] = (vals[idx] || '').trim();
        });
        if (rowObj.empId || rowObj.lastName || rowObj.firstName) {
          rows.push(rowObj);
        }
      }

      setCsvHeaders(headers);
      setCsvPreviewData(rows);
      onToast(`Loaded ${rows.length} records for preview.`, 'info');
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (csvPreviewData.length === 0) return;

    let importedCount = 0;
    (csvPreviewData || []).forEach(row => {
      saveEmployee(company, {
        empId: row.empId || `EMP-${Date.now()}`,
        lastName: row.lastName || 'Unknown',
        firstName: row.firstName || 'Unknown',
        middleName: row.middleName || '',
        dateHired: row.dateHired || '',
        department: row.department || '',
        position: row.position || '',
        status: row.status || 'ACTIVE',
        classification: row.classification || 'Regular',
        mobileNumber: row.mobileNumber || '',
        companyEmail: row.companyEmail || '',
        sss: row.sss || '',
        pagibig: row.pagibig || '',
        philhealth: row.philhealth || '',
        tin: row.tin || ''
      });
      importedCount++;
    });

    setCsvPreviewData([]);
    setCsvHeaders([]);
    onRefreshData();
    onToast(`Successfully imported ${importedCount} employees!`, 'success');
  };

  const exportToCsv = (dataToExport: Employee[], filename: string) => {
    if (dataToExport.length === 0) {
      onToast('No employees to export.', 'warning');
      return;
    }

    const headers = [
      'empId', 'lastName', 'firstName', 'middleName', 'dateHired', 'department',
      'position', 'status', 'classification', 'monthlySalary', 'separationDate', 'tenures',
      'birthdate', 'age', 'civilStatus', 'gender', 'mobileNumber',
      'personalEmail', 'companyEmail', 'sss', 'pagibig', 'philhealth', 'tin'
    ];

    const escape = (val: any) => {
      const s = String(val ?? '').replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };

    const csvLines = [
      headers.join(','),
      ...dataToExport.map(r => headers.map(h => escape((r as any)[h])).join(','))
    ];

    const csvContent = "\uFEFF" + csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    onToast(`Downloaded ${filename}`, 'success');
  };

  return (
    <div className="space-y-4">
      {/* Google Sheets Live Integration Box */}
      <GoogleSheetsIntegration
        company={company}
        companyName={companyFullName}
        userRole={userRole}
        employees={employees}
        onRefreshData={onRefreshData}
        onToast={onToast}
      />

      {/* CSV File Tools Box */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-800">CSV Offline Data Tools</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Import CSV Button */}
            {userRole === 'admin' && (
              <>
                <button
                  onClick={() => document.getElementById('compactCsvFileInput')?.click()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Import CSV File
                </button>
                <input
                  id="compactCsvFileInput"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCsvSelect(file);
                    e.target.value = '';
                  }}
                />
              </>
            )}

            {/* Export Full CSV */}
            <button
              onClick={() => exportToCsv(employees, `${company.toUpperCase()}_All_Employees_${new Date().toISOString().slice(0, 10)}.csv`)}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV ({employees.length})
            </button>
          </div>
        </div>

        {/* CSV Preview (shown only when a file is picked) */}
        {csvPreviewData.length > 0 && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 mt-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span>CSV Preview ({csvPreviewData.length} records ready)</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleConfirmImport}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Confirm Import
                </button>
                <button
                  onClick={() => setCsvPreviewData([])}
                  className="px-2 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-36 border border-slate-200 rounded-lg bg-white">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-bold">
                    {csvHeaders.slice(0, 6).map((h, idx) => (
                      <th key={idx} className="p-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {csvPreviewData.slice(0, 5).map((row, idx) => (
                    <tr key={idx}>
                      {csvHeaders.slice(0, 6).map((h, i) => (
                        <td key={i} className="p-2 truncate max-w-[120px]">{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

