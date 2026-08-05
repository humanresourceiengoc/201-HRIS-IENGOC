import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from './firebase';
import { Employee, CompanyKey } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

let cachedAccessToken: string | null = null;

export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setGoogleAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

const loadGsiScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.getElementById('google-gsi-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (err) => reject(err));
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(new Error('Failed to load Google Identity Services SDK'));
    document.head.appendChild(script);
  });
};

export const signInWithGoogleForSheets = async (): Promise<string> => {
  const clientId = (firebaseConfig as any).oAuthClientId || '582123280265-34dbb55glui7el5rd7prbtp5u6ci00us.apps.googleusercontent.com';

  // 1. Try Google Identity Services (GIS) Token Client first
  try {
    await loadGsiScript();
    if ((window as any).google?.accounts?.oauth2) {
      const token = await new Promise<string>((resolve, reject) => {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
          callback: (response: any) => {
            if (response.error) {
              reject(new Error(response.error_description || response.error));
            } else if (response.access_token) {
              resolve(response.access_token);
            } else {
              reject(new Error('No access token returned from Google OAuth'));
            }
          },
          error_callback: (error: any) => {
            reject(new Error(error?.message || 'Google OAuth prompt error'));
          }
        });
        client.requestAccessToken();
      });

      if (token) {
        cachedAccessToken = token;
        return token;
      }
    }
  } catch (gsiErr) {
    console.warn('Google Identity Services attempt failed, trying Firebase Auth fallback:', gsiErr);
  }

  // 2. Fallback to Firebase Auth signInWithPopup
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/spreadsheets');
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    provider.addScope('https://www.googleapis.com/auth/drive.readonly');

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential?.accessToken) {
      throw new Error('Could not retrieve access token from Google authentication.');
    }

    cachedAccessToken = credential.accessToken;
    return cachedAccessToken;
  } catch (fbErr: any) {
    console.error('Firebase Auth sign-in failed:', fbErr);
    throw new Error(fbErr.message || 'Google Sign-In failed. Please ensure popups are allowed or try reconnecting.');
  }
};

export interface LinkedSheetInfo {
  spreadsheetId: string;
  spreadsheetUrl: string;
  lastSyncedAt: string;
}

export const getLinkedGoogleSheet = (company: CompanyKey): LinkedSheetInfo | null => {
  try {
    const raw = localStorage.getItem(`gsheets_linked_${company}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
};

export const saveLinkedGoogleSheet = (company: CompanyKey, spreadsheetId: string, spreadsheetUrl: string): LinkedSheetInfo => {
  const info: LinkedSheetInfo = {
    spreadsheetId,
    spreadsheetUrl,
    lastSyncedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
  try {
    localStorage.setItem(`gsheets_linked_${company}`, JSON.stringify(info));
    window.dispatchEvent(new CustomEvent('gsheets_sync_status_changed', { detail: { company, info } }));
  } catch (e) {}
  return info;
};

export const unlinkGoogleSheet = (company: CompanyKey): void => {
  try {
    localStorage.removeItem(`gsheets_linked_${company}`);
    window.dispatchEvent(new CustomEvent('gsheets_sync_status_changed', { detail: { company, info: null } }));
  } catch (e) {}
};

export const isAutoSyncEnabled = (company: CompanyKey): boolean => {
  try {
    const val = localStorage.getItem(`gsheets_autosync_enabled_${company}`);
    return val !== 'false'; // Defaults to true
  } catch (e) {
    return true;
  }
};

export const setAutoSyncEnabled = (company: CompanyKey, enabled: boolean): void => {
  try {
    localStorage.setItem(`gsheets_autosync_enabled_${company}`, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('gsheets_sync_status_changed', { detail: { company } }));
  } catch (e) {}
};

export interface ExportToSheetResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  rowsCount: number;
  lastSyncedAt: string;
  isExisting: boolean;
}

export const exportEmployeesToGoogleSheets = async (
  company: CompanyKey,
  companyName: string,
  employees: Employee[],
  tokenOverride?: string,
  forceNewSheet: boolean = false
): Promise<ExportToSheetResult> => {
  const token = tokenOverride || cachedAccessToken;
  if (!token) {
    throw new Error('Google authentication required. Please connect Google Drive first.');
  }

  let linked = getLinkedGoogleSheet(company);
  let spreadsheetId = linked?.spreadsheetId;
  let spreadsheetUrl = linked?.spreadsheetUrl;
  let isExisting = false;

  // 1. Create a new Spreadsheet if not linked or force new sheet
  if (!spreadsheetId || forceNewSheet) {
    const title = `${companyName.toUpperCase()} — 201 Employee Records (Live HRIS Sync)`;
    const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: title,
        },
        sheets: [
          { properties: { title: '201 Employee Masterlist' } },
          { properties: { title: 'Government Loans Summary' } },
        ],
      }),
    });

    if (!createResponse.ok) {
      const errJson = await createResponse.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `Failed to create Google Sheet (${createResponse.status})`);
    }

    const createData = await createResponse.json();
    spreadsheetId = createData.spreadsheetId;
    spreadsheetUrl = createData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  } else {
    isExisting = true;
  }

  // 2. Prepare Data Rows for Sheet 1 (201 Masterlist)
  const masterlistHeaders = [
    'Emp ID',
    'Last Name',
    'First Name',
    'Middle Name',
    'Suffix',
    'Department',
    'Position',
    'Division',
    'Branch',
    'Status',
    'Classification',
    'Date Hired',
    'Monthly Salary',
    'Mobile Number',
    'Personal Email',
    'Company Email',
    'SSS Number',
    'PAG-IBIG MID',
    'PhilHealth No',
    'TIN',
    'Payroll Bank',
    'Account Number',
    'Birthdate',
    'Civil Status',
    'Gender',
    'Current Address',
    'Emergency Contact Name',
    'Emergency Relationship',
    'Emergency Mobile',
  ];

  const masterlistRows = employees.map(emp => [
    emp.empId || '',
    emp.lastName || '',
    emp.firstName || '',
    emp.middleName || '',
    emp.suffix || '',
    emp.department || '',
    emp.position || '',
    emp.division || '',
    emp.locationBranch || '',
    emp.status || 'ACTIVE',
    emp.classification || 'Regular',
    emp.dateHired || '',
    emp.monthlySalary ? Number(emp.monthlySalary).toLocaleString('en-US', { style: 'currency', currency: 'PHP' }) : '',
    emp.mobileNumber || '',
    emp.personalEmail || '',
    emp.companyEmail || '',
    emp.sss || '',
    emp.pagibig || '',
    emp.philhealth || '',
    emp.tin || '',
    emp.bankName || 'BDO',
    emp.bankAccountNumber || '',
    emp.birthdate || '',
    emp.civilStatus || '',
    emp.gender || '',
    emp.currentAddress || '',
    emp.emergencyName || '',
    emp.emergencyRelation || '',
    emp.emergencyContact || '',
  ]);

  const masterlistValues = [masterlistHeaders, ...masterlistRows];

  // Populate Sheet 1 (Clear existing values first if updating existing)
  if (isExisting) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'201 Employee Masterlist'!A1:Z1000:clear`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }
    ).catch(() => {});
  }

  const updateMasterResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'201 Employee Masterlist'!A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: "'201 Employee Masterlist'!A1",
        majorDimension: 'ROWS',
        values: masterlistValues,
      }),
    }
  );

  // Fallback if existing sheet was deleted or inaccessible: recreate new sheet
  if (!updateMasterResponse.ok && isExisting) {
    console.warn('Linked sheet invalid or deleted, creating fresh Google Sheet...');
    return exportEmployeesToGoogleSheets(company, companyName, employees, token, true);
  }

  // 3. Prepare Data Rows for Sheet 2 (Gov Loans Summary)
  const loanHeaders = ['Employee ID', 'Employee Name', 'Loan Type', 'Reference No', 'Principal Amount', 'Monthly Deduction', 'Start Date', 'End Date', 'Status'];
  const loanRows: any[][] = [];

  employees.forEach(emp => {
    if (emp.govLoans && emp.govLoans.length > 0) {
      emp.govLoans.forEach(loan => {
        loanRows.push([
          emp.empId || '',
          `${emp.firstName} ${emp.lastName}`,
          loan.type || '',
          loan.referenceNo || '',
          loan.loanAmount || 0,
          loan.monthlyDeduction || 0,
          loan.startDate || '',
          loan.endDate || '',
          loan.status || 'Active',
        ]);
      });
    }
  });

  const loanValues = [loanHeaders, ...loanRows];

  if (isExisting) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Government Loans Summary'!A1:Z1000:clear`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }
    ).catch(() => {});
  }

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Government Loans Summary'!A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: "'Government Loans Summary'!A1",
        majorDimension: 'ROWS',
        values: loanValues,
      }),
    }
  );

  // 4. Formatting Header Rows
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.08, green: 0.38, blue: 0.28 },
                  textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 1, green: 1, blue: 1 } },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
        ],
      }),
    });
  } catch (e) {
    console.warn('Google Sheets formatting request failed non-critically:', e);
  }

  // Save linked info
  const savedInfo = saveLinkedGoogleSheet(company, spreadsheetId, spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);

  return {
    spreadsheetId,
    spreadsheetUrl: savedInfo.spreadsheetUrl,
    rowsCount: employees.length,
    lastSyncedAt: savedInfo.lastSyncedAt,
    isExisting,
  };
};

let autoSyncDebounceTimer: any = null;

export const triggerAutoGoogleSheetsSync = (
  company: CompanyKey,
  companyName: string,
  employees: Employee[]
) => {
  if (!isAutoSyncEnabled(company)) return;
  const token = getGoogleAccessToken();
  if (!token) return; // Will sync automatically once connected

  if (autoSyncDebounceTimer) clearTimeout(autoSyncDebounceTimer);
  autoSyncDebounceTimer = setTimeout(() => {
    exportEmployeesToGoogleSheets(company, companyName, employees, token, false)
      .then((res) => {
        console.log(`⚡ Auto-synced ${res.rowsCount} employees to Google Sheets!`);
      })
      .catch((err) => {
        console.warn('Auto Google Sheets sync background warning:', err);
      });
  }, 1500);
};

export const fetchEmployeesFromGoogleSheet = async (
  spreadsheetIdOrUrl: string,
  tokenOverride?: string
): Promise<Partial<Employee>[]> => {
  const token = tokenOverride || cachedAccessToken;
  if (!token) {
    throw new Error('Google authentication required. Please sign in with Google first.');
  }

  // Extract Spreadsheet ID from full URL if provided
  let spreadsheetId = spreadsheetIdOrUrl.trim();
  const match = spreadsheetIdOrUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) {
    spreadsheetId = match[1];
  }

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'201 Employee Masterlist'!A1:Z500`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Failed to read Google Sheet (${response.status})`);
  }

  const data = await response.json();
  const values: string[][] = data.values || [];

  if (values.length < 2) {
    throw new Error('Google Sheet is empty or missing data rows.');
  }

  const headers = values[0].map(h => h.trim().toLowerCase());
  const rows = values.slice(1);

  const importedEmployees: Partial<Employee>[] = rows.map(row => {
    const getVal = (colNames: string[]) => {
      for (const name of colNames) {
        const idx = headers.findIndex(h => h.includes(name.toLowerCase()));
        if (idx !== -1 && row[idx]) return row[idx].trim();
      }
      return '';
    };

    return {
      empId: getVal(['emp id', 'employee id', 'id']),
      lastName: getVal(['last name', 'lastname']),
      firstName: getVal(['first name', 'firstname']),
      middleName: getVal(['middle name', 'middlename']),
      suffix: getVal(['suffix']),
      department: getVal(['department']),
      position: getVal(['position', 'title', 'role']),
      division: getVal(['division']),
      locationBranch: getVal(['branch', 'location']),
      status: (getVal(['status']) || 'ACTIVE').toUpperCase() as any,
      classification: getVal(['classification', 'employment status']) || 'Regular',
      dateHired: getVal(['date hired', 'hired date', 'hired']),
      mobileNumber: getVal(['mobile', 'phone']),
      personalEmail: getVal(['personal email', 'email']),
      companyEmail: getVal(['company email']),
      sss: getVal(['sss']),
      pagibig: getVal(['pagibig', 'pag-ibig']),
      philhealth: getVal(['philhealth']),
      tin: getVal(['tin']),
      bankName: getVal(['bank', 'payroll bank']) || 'BDO',
      bankAccountNumber: getVal(['account number', 'account no']),
      birthdate: getVal(['birthdate', 'birth date', 'dob']),
      civilStatus: getVal(['civil status']) as any,
      gender: getVal(['gender']) as any,
      currentAddress: getVal(['address', 'current address']),
      emergencyName: getVal(['emergency contact', 'emergency name']),
      emergencyRelation: getVal(['relationship', 'emergency relation']),
      emergencyContact: getVal(['emergency mobile', 'emergency phone']),
    };
  }).filter(e => e.empId || e.lastName || e.firstName);

  return importedEmployees;
};
