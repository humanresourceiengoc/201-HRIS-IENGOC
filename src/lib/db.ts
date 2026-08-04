import { CompanyKey, CustomCalendarEvent, DocumentRequirement, Employee, EmployeeDocument, UserAccount, UserRole, CollaboratorPresence } from '../types';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, getDoc } from 'firebase/firestore';
import { db as firestoreDb } from './firebase';

const DB_NAME = 'Employee201DB';
const DB_VERSION = 1;
const FILE_STORE = 'file_blobs';

// Convert Base64 Data URL to Blob
export function dataUrlToBlob(dataUrl: string): Blob {
  try {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    return new Blob([], { type: 'application/octet-stream' });
  }
}

// Upload file blob to Firestore cloud collection (chunked if > 750KB)
export async function syncFileBlobToFirestore(
  fileId: string,
  dataUrl: string,
  filename: string,
  mimeType: string,
  size: number
): Promise<void> {
  try {
    if (dataUrl.length <= 750000) {
      await setDoc(
        doc(firestoreDb, 'file_blobs', fileId),
        {
          id: fileId,
          dataUrl,
          filename,
          mimeType,
          size,
          isChunked: false,
          createdAt: new Date().toISOString()
        },
        { merge: true }
      );
    } else {
      const chunkSize = 500000;
      const totalChunks = Math.ceil(dataUrl.length / chunkSize);
      await setDoc(
        doc(firestoreDb, 'file_blobs', fileId),
        {
          id: fileId,
          isChunked: true,
          totalChunks,
          filename,
          mimeType,
          size,
          createdAt: new Date().toISOString()
        },
        { merge: true }
      );

      const chunkPromises = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunkStr = dataUrl.substring(i * chunkSize, (i + 1) * chunkSize);
        chunkPromises.push(
          setDoc(doc(firestoreDb, 'file_blobs', fileId, 'chunks', `chunk_${i}`), {
            index: i,
            chunkData: chunkStr
          })
        );
      }
      await Promise.all(chunkPromises);
    }
  } catch (err) {
    console.warn('Firestore file blob upload warning:', err);
  }
}

// Fetch file blob from Firestore when missing in local IndexedDB
export async function fetchFileBlobFromFirestore(
  fileId: string
): Promise<{ blob: Blob; filename: string; mimeType: string; dataUrl: string } | null> {
  try {
    const docRef = doc(firestoreDb, 'file_blobs', fileId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    let dataUrl = '';
    if (data.isChunked) {
      const totalChunks = data.totalChunks || 0;
      const chunkSnaps = await getDocs(collection(firestoreDb, 'file_blobs', fileId, 'chunks'));
      const chunkMap = new Map<number, string>();
      chunkSnaps.forEach((cSnap) => {
        const cData = cSnap.data();
        chunkMap.set(cData.index, cData.chunkData);
      });
      let fullUrl = '';
      for (let i = 0; i < totalChunks; i++) {
        fullUrl += chunkMap.get(i) || '';
      }
      dataUrl = fullUrl;
    } else {
      dataUrl = data.dataUrl || '';
    }

    if (dataUrl) {
      const blob = dataUrlToBlob(dataUrl);
      const filename = data.filename || 'document';
      const mimeType = data.mimeType || blob.type;

      // Cache locally in IndexedDB for instant future access on this device
      openIndexedDB()
        .then((db) => {
          const tx = db.transaction(FILE_STORE, 'readwrite');
          tx.objectStore(FILE_STORE).put({
            id: fileId,
            blob,
            filename,
            mimeType,
            size: data.size || blob.size,
            createdAt: new Date().toISOString()
          });
        })
        .catch(() => {});

      return { blob, filename, mimeType, dataUrl };
    }
  } catch (err) {
    console.warn('Firestore file blob fetch error:', err);
  }
  return null;
}

// Standard Default Requirements
export const DEFAULT_REQUIREMENTS: DocumentRequirement[] = [
  { id: 'resume', name: 'Resume / Curriculum Vitae', required: true, isDefault: true },
  { id: 'diploma', name: 'Diploma', required: true, isDefault: true },
  { id: 'tor', name: 'Official Transcript of Records (TOR)', required: true, isDefault: true },
  { id: 'birthcert', name: 'PSA Birth Certificate', required: true, isDefault: true },
  { id: 'nbi', name: 'NBI / Police Clearance', required: true, isDefault: true },
  { id: 'medical', name: 'Medical Certificate / Fit to Work', required: true, isDefault: true },
];

// Clean undefined fields for Firestore (Firestore throws error on undefined properties)
export function cleanFirestoreData(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj
      .map(item => cleanFirestoreData(item))
      .filter(item => item !== undefined && item !== null);
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        cleaned[key] = cleanFirestoreData(val);
      }
    }
    return cleaned;
  }
  return obj;
}

// Open IndexedDB
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE, { keyPath: 'id' });
      }
    };
  });
}

// Save File Blob to IndexedDB & Sync to Firestore Cloud Storage
export async function saveFileToStorage(file: File | Blob, filename: string): Promise<{
  fileId: string;
  url: string;
  dataUrl: string;
  filename: string;
  mimeType: string;
  size: number;
}> {
  const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const mimeType = file.type || 'application/octet-stream';
  const size = file.size;

  // Read file as Data URL for Cloud sync and universal preview
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  // Save to IndexedDB locally for instant local performance
  try {
    const db = await openIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, 'readwrite');
      const store = tx.objectStore(FILE_STORE);
      const record = { id: fileId, blob: file, filename, mimeType, size, createdAt: new Date().toISOString() };
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB save warning:', err);
  }

  // Upload to Firestore file_blobs collection so it is viewable across ALL devices
  syncFileBlobToFirestore(fileId, dataUrl, filename, mimeType, size).catch(err => {
    console.warn('Firestore file sync warning:', err);
  });

  return { fileId, url: dataUrl, dataUrl, filename, mimeType, size };
}

// Retrieve Blob from IndexedDB or Firestore Cloud Storage
export async function getFileFromStorage(fileId: string): Promise<{ blob: Blob; filename: string; mimeType: string } | null> {
  // 1. Check local IndexedDB first
  try {
    const db = await openIndexedDB();
    const record = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, 'readonly');
      const store = tx.objectStore(FILE_STORE);
      const req = store.get(fileId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (record && record.blob) {
      return { blob: record.blob, filename: record.filename, mimeType: record.mimeType };
    }
  } catch (e) {
    console.warn('Error fetching file from IndexedDB:', e);
  }

  // 2. Fetch from Firestore Cloud Storage if not found locally
  const remoteFile = await fetchFileBlobFromFirestore(fileId);
  if (remoteFile) {
    return { blob: remoteFile.blob, filename: remoteFile.filename, mimeType: remoteFile.mimeType };
  }

  return null;
}

// Get Object URL or Data URL for a stored file
export async function getFileUrl(fileIdOrUrl: string): Promise<string> {
  if (!fileIdOrUrl) return '';
  if (fileIdOrUrl.startsWith('data:') || fileIdOrUrl.startsWith('http://') || fileIdOrUrl.startsWith('https://')) {
    return fileIdOrUrl;
  }

  const fileData = await getFileFromStorage(fileIdOrUrl);
  if (fileData) {
    return URL.createObjectURL(fileData.blob);
  }
  return fileIdOrUrl;
}

// Trigger browser download for a file
export async function triggerFileDownload(fileIdOrUrl: string, filename: string) {
  let downloadUrl = fileIdOrUrl;
  let revokeNeeded = false;

  if (fileIdOrUrl.startsWith('file_') || fileIdOrUrl.startsWith('blob:')) {
    const fileData = await getFileFromStorage(fileIdOrUrl);
    if (fileData) {
      downloadUrl = URL.createObjectURL(fileData.blob);
      revokeNeeded = true;
    }
  }

  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename || 'document';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (revokeNeeded) {
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);
  }
}

// Delete File Blob from IndexedDB & Firestore
export async function deleteFileFromStorage(fileId: string): Promise<void> {
  if (!fileId || !fileId.startsWith('file_')) return;
  try {
    const db = await openIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, 'readwrite');
      const store = tx.objectStore(FILE_STORE);
      const req = store.delete(fileId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Error deleting file from IndexedDB:', e);
  }

  try {
    await deleteDoc(doc(firestoreDb, 'file_blobs', fileId));
  } catch (e) {}
}

// LocalStorage Persistence Helpers
const STORAGE_KEYS = {
  employees: (company: CompanyKey) => `${company}_employees_v3`,
  requirements: (company: CompanyKey) => `${company}_requirements_v3`,
  users: (company: CompanyKey) => `${company}_users_v3`,
  customEvents: (company: CompanyKey) => `${company}_custom_events_v1`,
};

// Seed Employees
// Seed Employees (Official IENCC 201 Employee Database)
const SEED_IENCC_EMPLOYEES: Employee[] = [
  {
    id: 'emp_ien_2019001',
    empId: '2019001',
    firstName: 'Joan',
    lastName: 'Boncay',
    middleName: 'B.',
    company: 'iencc',
    dateHired: '2019-01-15',
    department: 'Executive Management',
    position: 'President',
    status: 'ACTIVE',
    classification: 'Regular',
    birthdate: '1980-04-12',
    gender: 'FEMALE',
    civilStatus: 'Married',
    mobileNumber: '+63 917 100 2019',
    companyEmail: 'j.boncay@iencc.ph',
    monthlySalary: 120000,
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
    salaryHistory: [
      {
        id: 'sal_2019001',
        effectiveDate: '2019-01-15',
        previousSalary: 0,
        newSalary: 120000,
        reason: 'Executive Appointment',
        approvedBy: 'Board of Directors'
      }
    ],
    memos: [],
    govLoans: [],
    attendanceRecords: [],
    workExperience: [],
    docExpiries: {},
    documents: {}
  },
  {
    id: 'emp_ien_2019002',
    empId: '2019002',
    firstName: 'Erickson',
    lastName: 'Emperado',
    middleName: 'M.',
    company: 'iencc',
    dateHired: '2019-02-01',
    department: 'Executive Management',
    position: 'Vice President',
    status: 'ACTIVE',
    classification: 'Regular',
    birthdate: '1982-08-20',
    gender: 'MALE',
    civilStatus: 'Married',
    mobileNumber: '+63 917 200 2019',
    companyEmail: 'e.emperado@iencc.ph',
    monthlySalary: 105000,
    salaryHistory: [
      {
        id: 'sal_2019002',
        effectiveDate: '2019-02-01',
        previousSalary: 0,
        newSalary: 105000,
        reason: 'Executive Appointment',
        approvedBy: 'Board of Directors'
      }
    ],
    memos: [],
    govLoans: [],
    attendanceRecords: [],
    workExperience: [],
    docExpiries: {},
    documents: {}
  },
  {
    id: 'emp_ien_2020004',
    empId: '2020004',
    firstName: 'Joselyn',
    lastName: 'Beguiras',
    middleName: 'V.',
    company: 'iencc',
    dateHired: '2020-03-01',
    department: 'Accounting',
    position: 'Accounting Officer',
    status: 'ACTIVE',
    classification: 'Regular',
    birthdate: '1988-11-14',
    gender: 'FEMALE',
    civilStatus: 'Married',
    mobileNumber: '+63 917 400 2020',
    companyEmail: 'j.beguiras@iencc.ph',
    monthlySalary: 45000,
    salaryHistory: [
      {
        id: 'sal_2020004',
        effectiveDate: '2020-03-01',
        previousSalary: 0,
        newSalary: 45000,
        reason: 'Regular Appointment',
        approvedBy: 'HR Director'
      }
    ],
    memos: [],
    govLoans: [],
    attendanceRecords: [],
    workExperience: [],
    docExpiries: {},
    documents: {}
  }
];

const SEED_SEB_EMPLOYEES: Employee[] = [
  {
    id: 'emp_seb_001',
    empId: 'SEB-2022-101',
    firstName: 'Antonio',
    lastName: 'Luna',
    middleName: 'Novicio',
    dateHired: '2021-05-10',
    department: 'Logistics',
    position: 'Heavy Equipment Operations Lead',
    status: 'ACTIVE',
    classification: 'Regular',
    birthdate: '1985-10-29',
    gender: 'MALE',
    civilStatus: 'Married',
    mobileNumber: '+63 917 444 5566',
    companyEmail: 'a.luna@sebequipment.ph',
    monthlySalary: 52000,
    salaryHistory: [
      {
        id: 'sal_seb_1',
        effectiveDate: '2021-05-10',
        previousSalary: 0,
        newSalary: 42000,
        reason: 'Hiring Rate',
        approvedBy: 'Plant Director'
      },
      {
        id: 'sal_seb_2',
        effectiveDate: '2023-01-01',
        previousSalary: 42000,
        newSalary: 52000,
        reason: 'Promotion to Operations Lead',
        approvedBy: 'General Manager'
      }
    ],
    memos: [],
    documents: {
      resume: { reqId: 'resume', filename: 'Antonio_Luna_Resume.pdf', uploadedAt: '2021-05-10T08:00:00.000Z' },
      diploma: { reqId: 'diploma', filename: 'Engineering_Diploma.pdf', uploadedAt: '2021-05-10T08:00:00.000Z' },
      nbi: { reqId: 'nbi', filename: 'NBI_Clearance.pdf', uploadedAt: '2024-05-10T08:00:00.000Z' }
    }
  },
  {
    id: 'emp_seb_002',
    empId: 'SEB-2023-102',
    firstName: 'Gabriela',
    lastName: 'Silang',
    middleName: 'Cariño',
    dateHired: '2023-01-15',
    department: 'Finance',
    position: 'Chief Accountant',
    status: 'ACTIVE',
    classification: 'Regular',
    birthdate: '1990-03-19',
    gender: 'FEMALE',
    civilStatus: 'Widowed',
    mobileNumber: '+63 928 111 2233',
    companyEmail: 'g.silang@sebequipment.ph',
    monthlySalary: 48000,
    salaryHistory: [
      {
        id: 'sal_seb_3',
        effectiveDate: '2023-01-15',
        previousSalary: 0,
        newSalary: 48000,
        reason: 'Executive Hire Base Rate',
        approvedBy: 'Board of Directors'
      }
    ],
    documents: {
      resume: { reqId: 'resume', filename: 'Gabriela_Silang_CPA_CV.pdf', uploadedAt: '2023-01-15T09:00:00.000Z' }
    }
  },
  {
    id: 'emp_seb_003',
    empId: 'SEB-2026-103',
    firstName: 'Melchora',
    lastName: 'Aquino',
    middleName: 'Ramos',
    dateHired: '2026-03-01', // Probationary 6-month regularization Sept 1, 2026 (~34 days left)
    department: 'Admin',
    position: 'Office Supervisor',
    status: 'ACTIVE',
    classification: 'Probationary',
    birthdate: '1987-01-06',
    gender: 'FEMALE',
    civilStatus: 'Single',
    mobileNumber: '+63 915 888 7766',
    companyEmail: 'm.aquino@sebequipment.ph',
    monthlySalary: 30000,
    docExpiries: {
      nbi: '2026-08-12', // Expiring soon!
      medical: '2026-08-01'
    },
    documents: {
      resume: { reqId: 'resume', filename: 'Melchora_Aquino_Resume.pdf', uploadedAt: '2026-03-01T08:00:00.000Z' }
    }
  }
];

export function getDeletedEmployees(company: CompanyKey): Set<string> {
  try {
    const raw = localStorage.getItem(`deleted_emps_${company}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (e) {}
  return new Set();
}

export function getEmployees(company?: CompanyKey | null | string): Employee[] {
  const targetCompany: CompanyKey = (company === 'iencc' || company === 'seb') ? company : 'iencc';
  const data = localStorage.getItem(STORAGE_KEYS.employees(targetCompany));
  const defaultSeed = targetCompany === 'seb' ? SEED_SEB_EMPLOYEES : SEED_IENCC_EMPLOYEES;
  const hasSeededEmps = localStorage.getItem('seeded_firestore_employees_' + targetCompany) === 'true';
  const deletedSet = getDeletedEmployees(targetCompany);

  if (!data && !hasSeededEmps) {
    return defaultSeed.filter(e => !deletedSet.has(e.id) && (!e.empId || !deletedSet.has(e.empId)));
  }
  try {
    const parsed = JSON.parse(data || '[]');
    if (!Array.isArray(parsed)) return [];

    const cleaned = parsed.filter(e =>
      e &&
      !deletedSet.has(e.id) &&
      (!e.empId || !deletedSet.has(e.empId)) &&
      e.id !== 'emp_ien_001' &&
      e.id !== 'emp_ien_002' &&
      e.id !== 'emp_ien_003' &&
      e.id !== 'emp_ien_004' &&
      e.empId !== 'IEN-2023-001' &&
      e.empId !== 'IEN-2023-002' &&
      e.empId !== 'IEN-2026-003' &&
      e.empId !== 'IEN-2026-004' &&
      !(e.firstName === 'Juan' && e.lastName === 'Dela Cruz')
    );

    return cleaned;
  } catch (e) {
    return [];
  }
}

export function saveEmployee(company: CompanyKey, employee: Partial<Employee>): Employee {
  const employees = getEmployees(company);
  let savedEmp: Employee;

  if (employee.id) {
    const index = employees.findIndex(e => e.id === employee.id);
    if (index >= 0) {
      savedEmp = { ...employees[index], ...employee, company } as Employee;
      employees[index] = savedEmp;
    } else {
      savedEmp = { id: employee.id, ...employee, company } as Employee;
      employees.push(savedEmp);
    }
  } else {
    const newId = `emp_${company}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    savedEmp = {
      id: newId,
      status: 'ACTIVE',
      classification: 'Regular',
      createdAt: new Date().toISOString(),
      ...employee,
      company
    } as Employee;
    employees.push(savedEmp);
  }

  // Remove from deleted set if re-saved
  const deletedSet = getDeletedEmployees(company);
  if (deletedSet.has(savedEmp.id) || (savedEmp.empId && deletedSet.has(savedEmp.empId))) {
    deletedSet.delete(savedEmp.id);
    if (savedEmp.empId) deletedSet.delete(savedEmp.empId);
    localStorage.setItem(`deleted_emps_${company}`, JSON.stringify(Array.from(deletedSet)));
  }

  localStorage.setItem(STORAGE_KEYS.employees(company), JSON.stringify(employees));
  try {
    const cleanEmp = cleanFirestoreData({ ...savedEmp, company });
    setDoc(doc(firestoreDb, 'employees', savedEmp.id), cleanEmp, { merge: true }).catch(err => {
      console.warn('Firestore employee save warning:', err);
    });
  } catch (err) {
    console.warn('Firestore employee save error:', err);
  }
  return savedEmp;
}

export function deleteEmployee(company: CompanyKey, id: string): void {
  const employees = getEmployees(company);
  const targetEmp = employees.find(e => e.id === id || e.empId === id);
  const empIdToDelete = targetEmp?.id || id;
  const customEmpId = targetEmp?.empId;

  const filtered = employees.filter(e => e.id !== empIdToDelete && e.id !== id && e.empId !== id);
  localStorage.setItem(STORAGE_KEYS.employees(company), JSON.stringify(filtered));

  const deletedSet = getDeletedEmployees(company);
  deletedSet.add(empIdToDelete);
  if (customEmpId) deletedSet.add(customEmpId);
  deletedSet.add(id);
  localStorage.setItem(`deleted_emps_${company}`, JSON.stringify(Array.from(deletedSet)));

  try {
    deleteDoc(doc(firestoreDb, 'employees', empIdToDelete)).catch(err => {
      console.warn('Firestore employee delete warning:', err);
    });
    if (id !== empIdToDelete) {
      deleteDoc(doc(firestoreDb, 'employees', id)).catch(() => {});
    }
    if (customEmpId && customEmpId !== id && customEmpId !== empIdToDelete) {
      deleteDoc(doc(firestoreDb, 'employees', customEmpId)).catch(() => {});
    }
  } catch (err) {}
}

export function saveAllEmployees(company: CompanyKey, employees: Employee[]): void {
  localStorage.setItem(STORAGE_KEYS.employees(company), JSON.stringify(employees));
  try {
    employees.forEach(emp => {
      const cleanEmp = cleanFirestoreData({ ...emp, company });
      setDoc(doc(firestoreDb, 'employees', emp.id), cleanEmp, { merge: true }).catch(() => {});
    });
  } catch (err) {}
}

// Requirements Management
export function getRequirements(company?: CompanyKey | null | string): DocumentRequirement[] {
  const targetCompany: CompanyKey = (company === 'iencc' || company === 'seb') ? company : 'iencc';
  const data = localStorage.getItem(STORAGE_KEYS.requirements(targetCompany));
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.requirements(targetCompany), JSON.stringify(DEFAULT_REQUIREMENTS));
    return DEFAULT_REQUIREMENTS;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : DEFAULT_REQUIREMENTS;
  } catch (e) {
    return DEFAULT_REQUIREMENTS;
  }
}

export function saveRequirement(company: CompanyKey, reqName: string): DocumentRequirement[] {
  const reqs = getRequirements(company);
  const exists = reqs.some(r => r.name.toLowerCase() === reqName.toLowerCase());
  if (exists) return reqs;

  const newReq: DocumentRequirement = {
    id: `req_custom_${Date.now()}`,
    name: reqName,
    required: false,
    isDefault: false
  };

  const updated = [...reqs, newReq];
  localStorage.setItem(STORAGE_KEYS.requirements(company), JSON.stringify(updated));
  try {
    const cleanReq = cleanFirestoreData({ ...newReq, company });
    setDoc(doc(firestoreDb, 'requirements', `${company}_${newReq.id}`), cleanReq, { merge: true }).catch(() => {});
  } catch (err) {}
  return updated;
}

export function updateRequirement(company: CompanyKey, reqId: string, newName: string): DocumentRequirement[] {
  const reqs = getRequirements(company);
  const updated = reqs.map(r => r.id === reqId ? { ...r, name: newName } : r);
  localStorage.setItem(STORAGE_KEYS.requirements(company), JSON.stringify(updated));
  try {
    const updatedReq = updated.find(r => r.id === reqId);
    if (updatedReq) {
      const cleanReq = cleanFirestoreData({ ...updatedReq, company });
      setDoc(doc(firestoreDb, 'requirements', `${company}_${reqId}`), cleanReq, { merge: true }).catch(() => {});
    }
  } catch (err) {}
  return updated;
}

export function deleteRequirement(company: CompanyKey, reqId: string): DocumentRequirement[] {
  const reqs = getRequirements(company);
  const filtered = reqs.filter(r => r.id !== reqId);
  localStorage.setItem(STORAGE_KEYS.requirements(company), JSON.stringify(filtered));
  try {
    deleteDoc(doc(firestoreDb, 'requirements', `${company}_${reqId}`)).catch(() => {});
  } catch (err) {}
  return filtered;
}

// Custom Calendar Events Management
export function getCustomEvents(company?: CompanyKey | null | string): CustomCalendarEvent[] {
  const targetCompany: CompanyKey = (company === 'iencc' || company === 'seb') ? company : 'iencc';
  const data = localStorage.getItem(STORAGE_KEYS.customEvents(targetCompany));
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveCustomEvent(company: CompanyKey, event: Partial<CustomCalendarEvent>): CustomCalendarEvent[] {
  const events = getCustomEvents(company);
  let updated: CustomCalendarEvent[];
  if (event.id) {
    updated = events.map(e => e.id === event.id ? { ...e, ...event } as CustomCalendarEvent : e);
  } else {
    const newEv: CustomCalendarEvent = {
      id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: event.title || 'Untitled Event',
      dateStr: event.dateStr || new Date().toISOString().split('T')[0],
      type: event.type || 'event',
      description: event.description || '',
      company,
      createdAt: new Date().toISOString()
    };
    updated = [...events, newEv];
  }
  localStorage.setItem(STORAGE_KEYS.customEvents(company), JSON.stringify(updated));
  return updated;
}

export function deleteCustomEvent(company: CompanyKey, eventId: string): CustomCalendarEvent[] {
  const events = getCustomEvents(company);
  const filtered = events.filter(e => e.id !== eventId);
  localStorage.setItem(STORAGE_KEYS.customEvents(company), JSON.stringify(filtered));
  return filtered;
}

// Users Management
const DEFAULT_USERS: Record<CompanyKey, UserAccount[]> = {
  iencc: [
    {
      id: 'usr_admin_hr_ien',
      name: 'HR Admin',
      email: 'humanresource.iengoc@gmail.com',
      role: 'admin',
      company: 'iencc',
      emailVerified: true,
      blocked: false,
      verificationStatus: 'approved'
    },
    {
      id: 'usr_admin_ien_2',
      name: 'IENCC HR Admin',
      email: 'admn.iencc@gmail.com',
      role: 'admin',
      company: 'iencc',
      emailVerified: true,
      blocked: false,
      verificationStatus: 'approved'
    }
  ],
  seb: [
    {
      id: 'usr_admin_hr_seb',
      name: 'HR Admin',
      email: 'humanresource.iengoc@gmail.com',
      role: 'admin',
      company: 'seb',
      emailVerified: true,
      blocked: false,
      verificationStatus: 'approved'
    },
    {
      id: 'usr_admin_seb_2',
      name: 'IENCC HR Admin',
      email: 'admn.iencc@gmail.com',
      role: 'admin',
      company: 'seb',
      emailVerified: true,
      blocked: false,
      verificationStatus: 'approved'
    }
  ]
};

export function getDeletedUserEmails(): string[] {
  try {
    return JSON.parse(localStorage.getItem('deleted_user_emails_v1') || '[]');
  } catch {
    return [];
  }
}

export async function deleteUserFromFirestore(email: string): Promise<void> {
  try {
    const cleanEmailId = email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    await Promise.all([
      deleteDoc(doc(firestoreDb, 'users', cleanEmailId)).catch(() => {}),
      deleteDoc(doc(firestoreDb, 'hris_users', cleanEmailId)).catch(() => {}),
      deleteDoc(doc(firestoreDb, 'presence', cleanEmailId)).catch(() => {}),
      deleteDoc(doc(firestoreDb, 'presence', `usr_presence_${email.trim().toLowerCase()}`)).catch(() => {})
    ]);
  } catch (err) {
    console.warn('Firestore user delete warning (offline fallback):', err);
  }
}

export async function syncUserToFirestore(user: UserAccount): Promise<void> {
  try {
    const cleanEmailId = user.email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const payload = cleanFirestoreData({
      ...user,
      email: user.email.trim().toLowerCase(),
      updatedAt: new Date().toISOString()
    });
    await Promise.all([
      setDoc(doc(firestoreDb, 'users', cleanEmailId), payload, { merge: true }).catch(() => {}),
      setDoc(doc(firestoreDb, 'hris_users', cleanEmailId), payload, { merge: true }).catch(() => {})
    ]);
  } catch (err) {
    console.warn('Firestore user save warning (offline fallback):', err);
  }
}

export async function fetchUsersFromFirestore(company?: CompanyKey | null | string): Promise<UserAccount[]> {
  const targetCompany: CompanyKey = (company === 'iencc' || company === 'seb') ? company : 'seb';
  try {
    const [usersSnap, hrisSnap] = await Promise.all([
      getDocs(collection(firestoreDb, 'users')).catch(() => null),
      getDocs(collection(firestoreDb, 'hris_users')).catch(() => null)
    ]);

    const mergedMap = new Map<string, UserAccount>();
    const localUsers = getUsers(targetCompany);
    localUsers.forEach(lu => {
      if (!lu || !lu.email) return;
      mergedMap.set(lu.email.toLowerCase(), lu);
    });

    const addFromSnap = (snap: any) => {
      if (!snap) return;
      snap.forEach((docSnap: any) => {
        const data = docSnap.data() as UserAccount;
        if (data && data.email) {
          const key = data.email.toLowerCase();
          const existing = mergedMap.get(key);
          mergedMap.set(key, existing ? { ...existing, ...data } : data);
        }
      });
    };

    addFromSnap(usersSnap);
    addFromSnap(hrisSnap);

    const removedEmails = [
      'viewer@iencc.ph',
      'admin@sebequipment.ph',
      ...getDeletedUserEmails()
    ];

    const updatedList = Array.from(mergedMap.values()).filter(
      u => !removedEmails.includes(u.email.toLowerCase())
    );

    const primaryAdminEmail = 'humanresource.iengoc@gmail.com';
    updatedList.forEach(u => {
      if (u && u.email && u.email.toLowerCase() === primaryAdminEmail) {
        u.role = 'admin';
        u.verificationStatus = 'approved';
        u.blocked = false;
      }
    });

    const existingIdx = updatedList.findIndex(u => u && u.email && u.email.toLowerCase() === primaryAdminEmail);
    if (existingIdx < 0) {
      updatedList.unshift({
        id: `usr_admin_hr_${targetCompany}`,
        name: 'HR Admin',
        email: primaryAdminEmail,
        role: 'admin',
        company: targetCompany,
        emailVerified: true,
        blocked: false,
        verificationStatus: 'approved'
      });
    }

    localStorage.setItem(STORAGE_KEYS.users('iencc'), JSON.stringify(updatedList));
    localStorage.setItem(STORAGE_KEYS.users('seb'), JSON.stringify(updatedList));
    localStorage.setItem('global_hris_users_v4', JSON.stringify(updatedList));

    return updatedList;
  } catch (err) {
    console.warn('fetchUsersFromFirestore warning (offline fallback):', err);
    return getUsers(targetCompany);
  }
}

export function getUsers(company?: CompanyKey | null | string): UserAccount[] {
  const targetCompany: CompanyKey = (company === 'iencc' || company === 'seb') ? company : 'seb';
  const companyData = localStorage.getItem(STORAGE_KEYS.users(targetCompany));
  const globalData = localStorage.getItem('global_hris_users_v4');
  const otherCompany: CompanyKey = targetCompany === 'iencc' ? 'seb' : 'iencc';
  const otherData = localStorage.getItem(STORAGE_KEYS.users(otherCompany));

  const mapByEmail = new Map<string, UserAccount>();

  // Seed default users safely for both companies
  (DEFAULT_USERS['iencc'] || []).forEach(u => {
    if (u && u.email) mapByEmail.set(u.email.toLowerCase(), { ...u });
  });
  (DEFAULT_USERS['seb'] || []).forEach(u => {
    if (u && u.email) mapByEmail.set(u.email.toLowerCase(), { ...u });
  });

  const mergeFromJSON = (jsonStr: string | null) => {
    if (!jsonStr) return;
    try {
      const parsed = JSON.parse(jsonStr) as UserAccount[];
      if (Array.isArray(parsed)) {
        parsed.forEach(u => {
          if (!u || !u.email) return;
          const key = u.email.toLowerCase();
          const existing = mapByEmail.get(key);
          if (existing) {
            mapByEmail.set(key, { ...existing, ...u });
          } else {
            mapByEmail.set(key, u);
          }
        });
      }
    } catch (e) {
      // Ignore JSON parse error
    }
  };

  mergeFromJSON(otherData);
  mergeFromJSON(globalData);
  mergeFromJSON(companyData);

  let usersList = Array.from(mapByEmail.values());

  // Remove old demo users and removed accounts
  const removeEmails = [
    'viewer@iencc.ph',
    'admin@sebequipment.ph',
    ...getDeletedUserEmails()
  ];
  usersList = usersList.filter(u => !removeEmails.includes(u.email.toLowerCase()));

  // Ensure ONLY humanresource.iengoc@gmail.com is forced to admin
  const primaryAdminEmail = 'humanresource.iengoc@gmail.com';
  usersList.forEach(u => {
    if (u && u.email && u.email.toLowerCase() === primaryAdminEmail) {
      u.role = 'admin';
      u.verificationStatus = 'approved';
      u.blocked = false;
    }
  });

  const targetEmail = 'humanresource.iengoc@gmail.com';
  const existingIdx = usersList.findIndex(u => u && u.email && u.email.toLowerCase() === targetEmail);
  if (existingIdx < 0) {
    usersList.unshift({
      id: `usr_admin_hr_${targetCompany}`,
      name: 'HR Admin',
      email: targetEmail,
      role: 'admin',
      company: targetCompany,
      emailVerified: true,
      blocked: false,
      verificationStatus: 'approved'
    });
  }

  // Persist merged user list across both companies and global storage
  localStorage.setItem(STORAGE_KEYS.users('iencc'), JSON.stringify(usersList));
  localStorage.setItem(STORAGE_KEYS.users('seb'), JSON.stringify(usersList));
  localStorage.setItem('global_hris_users_v4', JSON.stringify(usersList));

  return usersList;
}

export function saveUser(company: CompanyKey, user: UserAccount): UserAccount[] {
  const users = getUsers(company);
  const idx = users.findIndex(u => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...user };
  } else {
    users.push(user);
  }
  localStorage.setItem(STORAGE_KEYS.users('iencc'), JSON.stringify(users));
  localStorage.setItem(STORAGE_KEYS.users('seb'), JSON.stringify(users));
  localStorage.setItem('global_hris_users_v4', JSON.stringify(users));

  syncUserToFirestore(user);

  return users;
}

export function toggleUserBlock(company: CompanyKey, userId: string, blocked: boolean): UserAccount[] {
  const users = getUsers(company);
  const updated = users.map(u => u.id === userId ? { ...u, blocked } : u);
  localStorage.setItem(STORAGE_KEYS.users('iencc'), JSON.stringify(updated));
  localStorage.setItem(STORAGE_KEYS.users('seb'), JSON.stringify(updated));
  localStorage.setItem('global_hris_users_v4', JSON.stringify(updated));

  const changed = updated.find(u => u.id === userId);
  if (changed) syncUserToFirestore(changed);

  return updated;
}

export function deleteUser(company: CompanyKey, userId: string): UserAccount[] {
  const users = getUsers(company);
  const target = users.find(u => u.id === userId || u.email.toLowerCase() === userId.toLowerCase());
  const targetEmail = target ? target.email.toLowerCase() : (userId.includes('@') ? userId.toLowerCase() : '');

  const filtered = users.filter(u => u.id !== userId && (!targetEmail || u.email.toLowerCase() !== targetEmail));
  localStorage.setItem(STORAGE_KEYS.users('iencc'), JSON.stringify(filtered));
  localStorage.setItem(STORAGE_KEYS.users('seb'), JSON.stringify(filtered));
  localStorage.setItem('global_hris_users_v4', JSON.stringify(filtered));

  if (targetEmail) {
    try {
      const prevDeleted = JSON.parse(localStorage.getItem('deleted_user_emails_v1') || '[]');
      if (!prevDeleted.includes(targetEmail)) {
        prevDeleted.push(targetEmail);
        localStorage.setItem('deleted_user_emails_v1', JSON.stringify(prevDeleted));
      }
    } catch (e) {}

    deleteUserFromFirestore(targetEmail).catch(() => {});
  }

  if (target) {
    removePresence(target.id);
  }
  removePresence(userId);
  if (targetEmail) {
    removePresence(`usr_presence_${targetEmail}`);
  }

  return filtered;
}

export function updateUserRole(company: CompanyKey, userId: string, role: UserRole): UserAccount[] {
  const users = getUsers(company);
  const updated = users.map(u => u.id === userId ? { ...u, role } : u);
  localStorage.setItem(STORAGE_KEYS.users('iencc'), JSON.stringify(updated));
  localStorage.setItem(STORAGE_KEYS.users('seb'), JSON.stringify(updated));
  localStorage.setItem('global_hris_users_v4', JSON.stringify(updated));

  const changed = updated.find(u => u.id === userId);
  if (changed) syncUserToFirestore(changed);

  return updated;
}

export async function syncAllLocalDataToFirestore(company: CompanyKey): Promise<{ employees: number; requirements: number; users: number }> {
  const legacyDummyIds = ['emp_ien_001', 'emp_ien_002', 'emp_ien_003', 'emp_ien_004'];
  for (const dummyId of legacyDummyIds) {
    try {
      await deleteDoc(doc(firestoreDb, 'employees', dummyId));
    } catch (err) {}
  }

  const emps = getEmployees(company);
  const reqs = getRequirements(company);
  const users = getUsers(company);
  const events = getCustomEvents(company);

  let empCount = 0;
  let reqCount = 0;
  let userCount = 0;

  for (const emp of emps) {
    try {
      const cleanEmp = cleanFirestoreData({ ...emp, company });
      await setDoc(doc(firestoreDb, 'employees', emp.id), cleanEmp, { merge: true });
      empCount++;
    } catch (err) {}
  }

  for (const req of reqs) {
    try {
      const cleanReq = cleanFirestoreData({ ...req, company });
      await setDoc(doc(firestoreDb, 'requirements', `${company}_${req.id}`), cleanReq, { merge: true });
      reqCount++;
    } catch (err) {}
  }

  for (const user of users) {
    if (user && user.email) {
      try {
        await syncUserToFirestore(user);
        userCount++;
      } catch (err) {}
    }
  }

  for (const ev of events) {
    try {
      const cleanEv = cleanFirestoreData({ ...ev, company });
      await setDoc(doc(firestoreDb, 'custom_events', `${company}_${ev.id}`), cleanEv, { merge: true });
    } catch (err) {}
  }

  return { employees: empCount, requirements: reqCount, users: userCount };
}

// Fetch Public Verified Employee from Firestore and Local Storage Cache across browsers
export async function fetchPublicVerifiedEmployee(verifyParam: string): Promise<{ employee: Employee; company: CompanyKey } | null> {
  if (!verifyParam) return null;
  const cleanParam = verifyParam.trim().toLowerCase();

  // 1. First check local cached storage for instant response
  for (const comp of ['iencc', 'seb'] as CompanyKey[]) {
    const local = getEmployees(comp);
    const found = local.find(e => 
      e.id.toLowerCase() === cleanParam ||
      (e.empId && e.empId.toLowerCase() === cleanParam) ||
      `${comp}_${e.empId}`.toLowerCase() === cleanParam ||
      `${comp}_${e.id}`.toLowerCase() === cleanParam ||
      cleanParam.endsWith((e.empId || '___').toLowerCase())
    );
    if (found) {
      return { employee: found, company: comp };
    }
  }

  // 2. Fetch directly from Firestore Cloud Database
  try {
    const colRef = collection(firestoreDb, 'employees');
    const snapshot = await getDocs(colRef);
    let matchedEmp: Employee | null = null;
    let matchedCompany: CompanyKey = 'iencc';

    snapshot.forEach(docSnap => {
      const data = docSnap.data() as Employee & { company?: CompanyKey };
      if (!data) return;
      const docId = docSnap.id.toLowerCase();
      const empId = (data.empId || '').toLowerCase();
      const comp = data.company || (docId.includes('seb') || empId.startsWith('seb') ? 'seb' : 'iencc');

      const matches = 
        docId === cleanParam ||
        empId === cleanParam ||
        (data.id && data.id.toLowerCase() === cleanParam) ||
        `${comp}_${empId}` === cleanParam ||
        `${comp}_${docId}` === cleanParam ||
        cleanParam.includes(empId && empId.length >= 3 ? empId : '___') ||
        cleanParam.includes(docId && docId.length >= 3 ? docId : '___');

      if (matches) {
        matchedEmp = { ...data, id: data.id || docSnap.id };
        matchedCompany = comp;
      }
    });

    if (matchedEmp) {
      return { employee: matchedEmp, company: matchedCompany };
    }
  } catch (err) {
    console.warn('Firestore public fetch error:', err);
  }

  return null;
}

// Real-Time Firestore onSnapshot Listeners
export function subscribeToEmployees(
  company: CompanyKey,
  onUpdate: (employees: Employee[]) => void
): () => void {
  const colRef = collection(firestoreDb, 'employees');

  return onSnapshot(colRef, (snapshot) => {
    const remoteEmployeesMap = new Map<string, Employee>();
    const deletedSet = getDeletedEmployees(company);

    snapshot.forEach(docSnap => {
      const data = docSnap.data() as Employee & { company?: CompanyKey };
      const docId = docSnap.id;

      const isLegacyDummy = data.id === 'emp_ien_001' ||
        data.id === 'emp_ien_002' ||
        data.id === 'emp_ien_003' ||
        data.id === 'emp_ien_004' ||
        data.empId === 'IEN-2023-001' ||
        data.empId === 'IEN-2023-002' ||
        data.empId === 'IEN-2026-003' ||
        data.empId === 'IEN-2026-004' ||
        (data.firstName === 'Juan' && data.lastName === 'Dela Cruz');

      if (isLegacyDummy) {
        deleteDoc(docSnap.ref).catch(() => {});
        return;
      }

      const empId = data.id || docId;
      if (deletedSet.has(empId) || (data.empId && deletedSet.has(data.empId)) || deletedSet.has(docId)) {
        deleteDoc(docSnap.ref).catch(() => {});
        return;
      }

      // Robust Company Determination for multi-device sync
      const docIdLower = docId.toLowerCase();
      const empIdLower = (data.empId || '').toLowerCase();
      const idLower = (data.id || '').toLowerCase();
      let empCompany: CompanyKey = data.company as CompanyKey;

      if (!empCompany || (empCompany !== 'iencc' && empCompany !== 'seb')) {
        if (docIdLower.includes('seb') || idLower.includes('_seb_') || empIdLower.startsWith('seb')) {
          empCompany = 'seb';
        } else if (docIdLower.includes('ien') || idLower.includes('_ien_') || empIdLower.startsWith('ien')) {
          empCompany = 'iencc';
        } else {
          empCompany = company; // default to active company
        }
      }

      if (data && empCompany === company) {
        const empRecord: Employee = {
          ...data,
          id: empId,
          company: empCompany
        };
        remoteEmployeesMap.set(empRecord.id, empRecord);
      }
    });

    const hasSeededEmps = localStorage.getItem('seeded_firestore_employees_' + company) === 'true';
    const remoteEmployees = Array.from(remoteEmployeesMap.values()).sort((a, b) =>
      (a.empId || '').localeCompare(b.empId || '')
    );

    if (remoteEmployees.length > 0 || hasSeededEmps) {
      localStorage.setItem('seeded_firestore_employees_' + company, 'true');
      localStorage.setItem(STORAGE_KEYS.employees(company), JSON.stringify(remoteEmployees));
      onUpdate(remoteEmployees);
    } else {
      // First time initialization ONLY if Firestore has no records for this company and has never been seeded
      const defaultSeed = company === 'seb' ? SEED_SEB_EMPLOYEES : SEED_IENCC_EMPLOYEES;
      const validSeed = defaultSeed.filter(e => !deletedSet.has(e.id) && (!e.empId || !deletedSet.has(e.empId)));

      validSeed.forEach(emp => {
        const cleanEmp = cleanFirestoreData({ ...emp, company });
        setDoc(doc(firestoreDb, 'employees', emp.id), cleanEmp, { merge: true }).catch(() => {});
      });

      localStorage.setItem('seeded_firestore_employees_' + company, 'true');
      localStorage.setItem(STORAGE_KEYS.employees(company), JSON.stringify(validSeed));
      onUpdate(validSeed);
    }
  }, (err) => {
    console.warn('subscribeToEmployees warning (offline fallback):', err);
    onUpdate(getEmployees(company));
  });
}

export function subscribeToRequirements(
  company: CompanyKey,
  onUpdate: (requirements: DocumentRequirement[]) => void
): () => void {
  const colRef = collection(firestoreDb, 'requirements');
  return onSnapshot(colRef, (snapshot) => {
    const remoteReqs: DocumentRequirement[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as DocumentRequirement & { company?: CompanyKey };
      const isTargetCompany = data.company === company || docSnap.id.startsWith(`${company}_`);
      if (data && isTargetCompany) {
        const { company: _comp, ...cleanReq } = data;
        remoteReqs.push(cleanReq as DocumentRequirement);
      }
    });

    const remoteMap = new Map<string, DocumentRequirement>();
    remoteReqs.forEach(rr => {
      if (rr && rr.id) remoteMap.set(rr.id, rr);
    });
    const mergedReqs = Array.from(remoteMap.values());

    const hasSeededReqs = localStorage.getItem('seeded_firestore_requirements_' + company) === 'true';

    if (mergedReqs.length > 0 || hasSeededReqs) {
      localStorage.setItem(STORAGE_KEYS.requirements(company), JSON.stringify(mergedReqs));
      localStorage.setItem('seeded_firestore_requirements_' + company, 'true');
      onUpdate(mergedReqs);
    } else {
      DEFAULT_REQUIREMENTS.forEach(req => {
        const cleanReq = cleanFirestoreData({
          ...req,
          company
        });
        setDoc(doc(firestoreDb, 'requirements', `${company}_${req.id}`), cleanReq, { merge: true }).catch(() => {});
      });
      localStorage.setItem('seeded_firestore_requirements_' + company, 'true');
      localStorage.setItem(STORAGE_KEYS.requirements(company), JSON.stringify(DEFAULT_REQUIREMENTS));
      onUpdate(DEFAULT_REQUIREMENTS);
    }
  }, (err) => {
    console.warn('subscribeToRequirements warning (offline fallback):', err);
  });
}

export function subscribeToUsers(
  company: CompanyKey,
  onUpdate: (users: UserAccount[]) => void
): () => void {
  const targetCompany: CompanyKey = (company === 'iencc' || company === 'seb') ? company : 'seb';
  
  let remoteUsersA: UserAccount[] = [];
  let remoteUsersB: UserAccount[] = [];

  const handleUpdate = () => {
    localStorage.setItem('seeded_firestore_users', 'true');
    const mergedMap = new Map<string, UserAccount>();
    const localUsers = getUsers(targetCompany);
    localUsers.forEach(lu => {
      if (!lu || !lu.email) return;
      mergedMap.set(lu.email.toLowerCase(), lu);
    });
    remoteUsersA.forEach(ru => {
      if (!ru || !ru.email) return;
      mergedMap.set(ru.email.toLowerCase(), { ...mergedMap.get(ru.email.toLowerCase()), ...ru });
    });
    remoteUsersB.forEach(ru => {
      if (!ru || !ru.email) return;
      mergedMap.set(ru.email.toLowerCase(), { ...mergedMap.get(ru.email.toLowerCase()), ...ru });
    });

    const removedEmails = [
      'viewer@iencc.ph',
      'admin@sebequipment.ph'
    ];
    removedEmails.forEach(em => {
      deleteUserFromFirestore(em).catch(() => {});
    });

    const updatedList = Array.from(mergedMap.values()).filter(
      u => !removedEmails.includes(u.email.toLowerCase())
    );

    const primaryAdminEmail = 'humanresource.iengoc@gmail.com';
    updatedList.forEach(u => {
      if (u && u.email && u.email.toLowerCase() === primaryAdminEmail) {
        u.role = 'admin';
        u.verificationStatus = 'approved';
        u.blocked = false;
      }
    });

    const existingIdx = updatedList.findIndex(u => u && u.email && u.email.toLowerCase() === primaryAdminEmail);
    if (existingIdx < 0) {
      updatedList.unshift({
        id: `usr_admin_hr_${targetCompany}`,
        name: 'HR Admin',
        email: primaryAdminEmail,
        role: 'admin',
        company: targetCompany,
        emailVerified: true,
        blocked: false,
        verificationStatus: 'approved'
      });
    }

    localStorage.setItem(STORAGE_KEYS.users('iencc'), JSON.stringify(updatedList));
    localStorage.setItem(STORAGE_KEYS.users('seb'), JSON.stringify(updatedList));
    localStorage.setItem('global_hris_users_v4', JSON.stringify(updatedList));

    onUpdate(updatedList);
  };

  const unsub1 = onSnapshot(collection(firestoreDb, 'users'), (snapshot) => {
    remoteUsersA = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as UserAccount;
      if (data && data.email) {
        remoteUsersA.push(data);
      }
    });
    handleUpdate();
  }, (err) => {
    console.warn('subscribeToUsers users warning:', err);
  });

  const unsub2 = onSnapshot(collection(firestoreDb, 'hris_users'), (snapshot) => {
    remoteUsersB = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as UserAccount;
      if (data && data.email) {
        remoteUsersB.push(data);
      }
    });
    handleUpdate();
  }, (err) => {
    console.warn('subscribeToUsers hris_users warning:', err);
  });

  return () => {
    unsub1();
    unsub2();
  };
}

// Real-Time Collaborator Presence & Device Tracking (Chrome, Edge, Mobile, Safari)
export function subscribeToPresence(
  company: CompanyKey,
  onUpdate: (presenceList: CollaboratorPresence[]) => void
): () => void {
  const colRef = collection(firestoreDb, 'presence');
  return onSnapshot(colRef, (snapshot) => {
    const remotePresence: CollaboratorPresence[] = [];
    const now = Date.now();

    snapshot.forEach(docSnap => {
      const data = docSnap.data() as CollaboratorPresence;
      if (data && data.lastActive) {
        // Only show presence active within the last 15 minutes
        const activeTimestamp = new Date(data.lastActive).getTime();
        if (now - activeTimestamp < 15 * 60 * 1000) {
          remotePresence.push(data);
        }
      }
    });

    // Sort active collaborators by name
    remotePresence.sort((a, b) => a.name.localeCompare(b.name));
    onUpdate(remotePresence);
  }, (err) => {
    console.warn('subscribeToPresence warning:', err);
  });
}

export function detectBrowserAndDevice(): { browser: string; deviceType: 'Desktop' | 'Mobile' | 'Tablet' } {
  const ua = navigator.userAgent;
  let browser = 'Chrome';
  if (ua.includes('Edg')) {
    browser = 'Edge';
  } else if (ua.includes('Firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    browser = 'Safari';
  } else if (ua.includes('Chrome')) {
    browser = 'Chrome';
  }

  let deviceType: 'Desktop' | 'Mobile' | 'Tablet' = 'Desktop';
  if (/iPad|Tablet/i.test(ua)) {
    deviceType = 'Tablet';
  } else if (/iPhone|Android.*Mobile|Mobile/i.test(ua)) {
    deviceType = 'Mobile';
  }

  return { browser, deviceType };
}

export function updatePresence(
  user: UserAccount,
  company: CompanyKey,
  status: 'online' | 'idle' | 'editing',
  currentView: string = 'dashboard'
): void {
  try {
    const { browser, deviceType } = detectBrowserAndDevice();
    const presenceData: CollaboratorPresence = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      blocked: user.blocked,
      verificationStatus: user.verificationStatus,
      company,
      browser,
      deviceType,
      lastActive: new Date().toISOString(),
      status,
      currentView
    };

    const cleanData = cleanFirestoreData(presenceData);
    setDoc(doc(firestoreDb, 'presence', user.id), cleanData, { merge: true }).catch(err => {
      console.warn('Presence update warning:', err);
    });
  } catch (err) {
    console.warn('Presence update error:', err);
  }
}

export function removePresence(userId: string): void {
  try {
    deleteDoc(doc(firestoreDb, 'presence', userId)).catch(() => {});
  } catch (err) {
    console.warn('Presence remove error:', err);
  }
}

// Real-time custom calendar events subscriber
export function subscribeToCustomEvents(
  company: CompanyKey,
  onUpdate: (events: CustomCalendarEvent[]) => void
): () => void {
  const colRef = collection(firestoreDb, 'custom_events');
  return onSnapshot(colRef, (snapshot) => {
    const remoteEvents: CustomCalendarEvent[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as CustomCalendarEvent;
      if (data && (data.company === company || docSnap.id.startsWith(`${company}_`))) {
        remoteEvents.push(data);
      }
    });

    const localFallback = getCustomEvents(company);
    const eventMap = new Map<string, CustomCalendarEvent>();
    localFallback.forEach(e => eventMap.set(e.id, e));
    remoteEvents.forEach(e => eventMap.set(e.id, e));

    const merged = Array.from(eventMap.values());
    localStorage.setItem(STORAGE_KEYS.customEvents(company), JSON.stringify(merged));
    onUpdate(merged);
  }, (err) => {
    console.warn('subscribeToCustomEvents warning:', err);
  });
}
