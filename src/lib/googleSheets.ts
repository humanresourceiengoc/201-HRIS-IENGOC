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

export const getAppsScriptUrl = (company: CompanyKey): string | null => {
  try {
    return localStorage.getItem(`gsheets_webapp_url_${company}`);
  } catch (e) {
    return null;
  }
};

export const setAppsScriptUrl = (company: CompanyKey, url: string | null): void => {
  try {
    if (url) {
      localStorage.setItem(`gsheets_webapp_url_${company}`, url.trim());
    } else {
      localStorage.removeItem(`gsheets_webapp_url_${company}`);
    }
    window.dispatchEvent(new CustomEvent('gsheets_sync_status_changed', { detail: { company } }));
  } catch (e) {}
};

export const syncViaAppsScript = async (
  company: CompanyKey,
  companyName: string,
  employees: Employee[],
  scriptUrl: string
): Promise<ExportToSheetResult> => {
  const cleanUrl = scriptUrl.trim();
  if (!cleanUrl.startsWith('http')) {
    throw new Error('Invalid Google Apps Script Web App URL. Must start with https://');
  }

  const payload = {
    company,
    companyName,
    syncedAt: new Date().toISOString(),
    employees: employees.map((emp, idx) => ({
      no: idx + 1,
      eeId: emp.empId || emp.employeeNumber || '',
      lastName: emp.lastName || '',
      firstName: emp.firstName || '',
      middleName: emp.middleName || '',
      birthday: emp.birthdate || '',
      address: emp.currentAddress || emp.permanentAddress || '',
      cellNo: emp.mobileNumber || '',
      email1: emp.companyEmail || '',
      email2: emp.personalEmail || '',
      email3: emp.email3 || '',
      nickname: emp.nickname || emp.preferredName || emp.firstName || '',
      companyName: emp.company === 'iencc' 
        ? 'Integrated and effective navigation Consultancy Corp' 
        : (emp.company === 'seb' ? 'SEB Equipment and Supply Corp' : companyName),
      dateHired: emp.dateHired || emp.dateStarted || '',
      department: emp.department || '',
      position: emp.position || '',
      bioId: emp.bioId || '',
      newBioId: emp.newBioId || '',
      status: emp.status || 'ACTIVE',
      verifier: emp.verifier || emp.immediateSupervisor || emp.hiringManager || 'HR Verified',
      sss: emp.sss || '',
      philhealth: emp.philhealth || '',
      hdmf: emp.pagibig || '',
      tin: emp.tin || '',
    }))
  };

  try {
    await fetch(cleanUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    const savedInfo = saveLinkedGoogleSheet(company, 'apps_script_linked', cleanUrl);
    setAppsScriptUrl(company, cleanUrl);

    return {
      spreadsheetId: 'apps_script_linked',
      spreadsheetUrl: cleanUrl,
      rowsCount: employees.length,
      lastSyncedAt: savedInfo.lastSyncedAt,
      isExisting: true
    };
  } catch (err: any) {
    throw new Error(`Failed to send data to Google Apps Script: ${err.message}`);
  }
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
              if (response.error === 'origin_mismatch' || response.error_description?.includes('origin')) {
                reject(new Error('ORIGIN_MISMATCH: The origin domain is not registered in Google OAuth origins. You can use the Apps Script Web App method below for 100% instant sync!'));
              } else {
                reject(new Error(response.error_description || response.error));
              }
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
  } catch (gsiErr: any) {
    if (gsiErr.message?.includes('ORIGIN_MISMATCH')) {
      throw gsiErr;
    }
    console.info('GIS OAuth notice:', gsiErr?.message || gsiErr);
  }

  // 2. Fallback to Firebase Auth signInWithPopup
  try {
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    const { getFirebaseAuth } = await import('./firebase');
    const firebaseAuth = await getFirebaseAuth();

    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/spreadsheets');
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    provider.addScope('https://www.googleapis.com/auth/drive.readonly');

    const result = await signInWithPopup(firebaseAuth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential?.accessToken) {
      throw new Error('Could not retrieve access token from Google authentication.');
    }

    cachedAccessToken = credential.accessToken;
    return cachedAccessToken;
  } catch (fbErr: any) {
    console.info('Firebase Auth notice:', fbErr?.message || fbErr);
    if (fbErr.code === 'auth/popup-blocked') {
      throw new Error('ORIGIN_MISMATCH: Google Sign-in popup was blocked by your browser. Please allow popups or use the 1-Click Apps Script Setup below!');
    }
    if (fbErr.code === 'auth/popup-closed-by-user' || fbErr.message?.includes('closed')) {
      throw new Error('ORIGIN_MISMATCH: Google Sign-in popup was closed. Please use the 1-Click Apps Script Setup below for instant sync!');
    }
    if (fbErr.code === 'auth/internal-error' || fbErr.message?.includes('internal-error')) {
      throw new Error('ORIGIN_MISMATCH: Google Sign-in requires domain authorization or Apps Script setup. Please use the Google Apps Script Web App setup below for 100% reliable direct sync!');
    }
    throw new Error(fbErr.message || 'Google Sign-In failed. Please try the Apps Script Web App method below.');
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

  // 2. Prepare Data Rows for Sheet 1 (201 Masterlist) - Exact 23-column format
  const masterlistHeadersRow1 = [
    'No.',
    '',
    'Name',
    '',
    '',
    'Birthday',
    'Address',
    'Contact Information',
    '',
    '',
    '',
    'Employment Information',
    '',
    '',
    '',
    '',
    '',
    '',
    'Verifier',
    'GOVERNMENT NUMBERS',
    '',
    '',
    '',
  ];

  const masterlistHeadersRow2 = [
    '',
    'EE ID',
    'Last',
    'First',
    'Middle',
    '',
    '',
    'Cell No.',
    'Email 1',
    'Email 2',
    'Email 3',
    'Nickname / Name',
    'Date Hired',
    'Department',
    'Position',
    'Bio ID',
    'New Bio ID',
    'Status',
    '',
    'SSS',
    'PHILHEALTH',
    'HDMF',
    'TIN',
  ];

  const masterlistRows = employees.map((emp, idx) => {
    const employeeNickname = emp.nickname || emp.preferredName || emp.firstName || '';

    return [
      idx + 1,
      emp.empId || emp.employeeNumber || '',
      emp.lastName || '',
      emp.firstName || '',
      emp.middleName || '',
      emp.birthdate || '',
      emp.currentAddress || emp.permanentAddress || '',
      emp.mobileNumber || '',
      emp.companyEmail || '',
      emp.personalEmail || '',
      emp.email3 || '',
      employeeNickname,
      emp.dateHired || emp.dateStarted || '',
      emp.department || '',
      emp.position || '',
      emp.bioId || '',
      emp.newBioId || '',
      emp.status || 'ACTIVE',
      emp.verifier || emp.immediateSupervisor || emp.hiringManager || 'HR Verified',
      emp.sss || '',
      emp.philhealth || '',
      emp.pagibig || '',
      emp.tin || '',
    ];
  });

  const masterlistValues = [masterlistHeadersRow1, masterlistHeadersRow2, ...masterlistRows];

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

  // 4. Formatting Header Rows & Merges
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          // Row 1 Styling: Navy Dark Background (#1E293B)
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 23,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.12, green: 0.16, blue: 0.23 },
                  textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          },
          // Row 2 Styling: Slate Background (#334155)
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 1,
                endRowIndex: 2,
                startColumnIndex: 0,
                endColumnIndex: 23,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.20, green: 0.25, blue: 0.33 },
                  textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          },
          // Merge A1:A2 (No.)
          {
            mergeCells: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 1 },
              mergeType: 'MERGE_ALL',
            },
          },
          // Merge C1:E1 (Name)
          {
            mergeCells: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 2, endColumnIndex: 5 },
              mergeType: 'MERGE_ALL',
            },
          },
          // Merge F1:F2 (Birthday)
          {
            mergeCells: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 5, endColumnIndex: 6 },
              mergeType: 'MERGE_ALL',
            },
          },
          // Merge G1:G2 (Address)
          {
            mergeCells: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 6, endColumnIndex: 7 },
              mergeType: 'MERGE_ALL',
            },
          },
          // Merge H1:K1 (Contact Information)
          {
            mergeCells: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 7, endColumnIndex: 11 },
              mergeType: 'MERGE_ALL',
            },
          },
          // Merge L1:R1 (Employment Information)
          {
            mergeCells: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 11, endColumnIndex: 18 },
              mergeType: 'MERGE_ALL',
            },
          },
          // Merge S1:S2 (Verifier)
          {
            mergeCells: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 18, endColumnIndex: 19 },
              mergeType: 'MERGE_ALL',
            },
          },
          // Merge T1:W1 (GOVERNMENT NUMBERS)
          {
            mergeCells: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 19, endColumnIndex: 23 },
              mergeType: 'MERGE_ALL',
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

  const scriptUrl = getAppsScriptUrl(company);
  const token = getGoogleAccessToken();

  if (autoSyncDebounceTimer) clearTimeout(autoSyncDebounceTimer);
  autoSyncDebounceTimer = setTimeout(() => {
    if (scriptUrl) {
      syncViaAppsScript(company, companyName, employees, scriptUrl)
        .then((res) => {
          console.log(`⚡ Auto-synced ${res.rowsCount} employees via Google Apps Script!`);
        })
        .catch((err) => {
          console.info('Auto Apps Script sync notice:', err?.message || err);
        });
    } else if (token) {
      exportEmployeesToGoogleSheets(company, companyName, employees, token, false)
        .then((res) => {
          console.log(`⚡ Auto-synced ${res.rowsCount} employees to Google Sheets!`);
        })
        .catch((err) => {
          console.info('Auto Google Sheets sync notice:', err?.message || err);
        });
    }
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

  // Detect if Row 0 is Category header and Row 1 is Sub-header
  const isMultiRowHeader = values.length >= 3 && values[1].some(c => {
    const s = (c || '').toLowerCase();
    return s.includes('ee id') || s.includes('last') || s.includes('first') || s.includes('cell no') || s.includes('email 1');
  });

  const headersRow = isMultiRowHeader ? values[1] : values[0];
  const combinedHeaders = headersRow.map((h, colIdx) => {
    const h1 = (values[0]?.[colIdx] || '').trim();
    const h2 = (h || '').trim();
    return `${h1} ${h2}`.toLowerCase();
  });

  const rows = isMultiRowHeader ? values.slice(2) : values.slice(1);

  const importedEmployees: Partial<Employee>[] = rows.map(row => {
    const getVal = (colNames: string[]) => {
      for (const name of colNames) {
        const idx = combinedHeaders.findIndex(h => h.includes(name.toLowerCase()));
        if (idx !== -1 && row[idx]) return row[idx].trim();
      }
      return '';
    };

    return {
      empId: getVal(['ee id', 'emp id', 'employee id', 'id']),
      lastName: getVal(['last', 'lastname']),
      firstName: getVal(['first', 'firstname']),
      middleName: getVal(['middle', 'middlename']),
      suffix: getVal(['suffix']),
      nickname: getVal(['nickname', 'preferred name']),
      preferredName: getVal(['nickname', 'preferred name']),
      department: getVal(['department']),
      position: getVal(['position', 'title', 'role']),
      bioId: getVal(['bio id', 'biometric id']),
      newBioId: getVal(['new bio id']),
      status: (getVal(['status']) || 'ACTIVE').toUpperCase() as any,
      verifier: getVal(['verifier']),
      classification: getVal(['classification', 'employment status']) || 'Regular',
      dateHired: getVal(['date hired', 'hired date', 'hired']),
      mobileNumber: getVal(['cell no', 'mobile', 'phone']),
      companyEmail: getVal(['email 1', 'company email']),
      personalEmail: getVal(['email 2', 'personal email', 'email']),
      email3: getVal(['email 3']),
      sss: getVal(['sss']),
      pagibig: getVal(['hdmf', 'pagibig', 'pag-ibig']),
      philhealth: getVal(['philhealth']),
      tin: getVal(['tin']),
      birthdate: getVal(['birthday', 'birthdate', 'birth date', 'dob']),
      currentAddress: getVal(['address', 'current address']),
      emergencyName: getVal(['emergency contact', 'emergency name']),
      emergencyRelation: getVal(['relationship', 'emergency relation']),
      emergencyContact: getVal(['emergency mobile', 'emergency phone']),
    };
  }).filter(e => e.empId || e.lastName || e.firstName);

  return importedEmployees;
};
