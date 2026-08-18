import { Employee, DocumentRequirement } from '../types';

export interface CompletenessResult {
  total: number;
  submitted: number;
  percentage: number;
  missingReqs: DocumentRequirement[];
  isComplete: boolean;
}

export function calculate201Completeness(
  employee: Employee,
  requirements: DocumentRequirement[]
): CompletenessResult {
  if (!requirements || !Array.isArray(requirements) || requirements.length === 0) {
    return { total: 0, submitted: 0, percentage: 100, missingReqs: [], isComplete: true };
  }

  const docs = (employee && employee.documents) ? employee.documents : {};
  let submittedCount = 0;
  const missingReqs: DocumentRequirement[] = [];

  requirements.forEach(req => {
    if (docs[req.id] && docs[req.id].filename) {
      submittedCount++;
    } else {
      missingReqs.push(req);
    }
  });

  const percentage = Math.round((submittedCount / requirements.length) * 100);

  return {
    total: requirements.length,
    submitted: submittedCount,
    percentage,
    missingReqs,
    isComplete: submittedCount === requirements.length,
  };
}

export interface ProbationaryStatus {
  isProbationary: boolean;
  dateHired: string;
  regularizationDate: string;
  daysRemaining: number;
  statusText: string;
  statusSeverity: 'urgent' | 'warning' | 'normal' | 'passed';
  month1Due: string;
  month2Due: string;
  month3Due: string;
  month4Due: string;
  month5Due: string;
  month6Due: string;
}

export function getProbationaryStatus(employee: Employee): ProbationaryStatus | null {
  if (
    employee.classification?.toLowerCase() !== 'probationary' ||
    !employee.dateHired ||
    employee.status === 'RESIGNED' ||
    employee.status === 'SEPARATED' ||
    employee.status === 'AWOL' ||
    employee.status === 'INACTIVE'
  ) {
    return null;
  }

  const hiredDate = new Date(employee.dateHired);
  if (isNaN(hiredDate.getTime())) return null;

  // 1 to 6 months review dates
  const m1Date = new Date(hiredDate);
  m1Date.setMonth(m1Date.getMonth() + 1);

  const m2Date = new Date(hiredDate);
  m2Date.setMonth(m2Date.getMonth() + 2);

  const m3Date = new Date(hiredDate);
  m3Date.setMonth(m3Date.getMonth() + 3);

  const m4Date = new Date(hiredDate);
  m4Date.setMonth(m4Date.getMonth() + 4);

  const m5Date = new Date(hiredDate);
  m5Date.setMonth(m5Date.getMonth() + 5);

  const m6Date = new Date(hiredDate);
  m6Date.setMonth(m6Date.getMonth() + 6);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = m6Date.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let statusSeverity: 'urgent' | 'warning' | 'normal' | 'passed' = 'normal';
  let statusText = `${daysRemaining} days remaining until 6-month evaluation`;

  if (daysRemaining <= 0) {
    statusSeverity = 'urgent';
    statusText = '6-Month Probation Period Elapsed - Evaluation Overdue!';
  } else if (daysRemaining <= 30) {
    statusSeverity = 'urgent';
    statusText = `Critical: Only ${daysRemaining} days left until regularization decision!`;
  } else if (daysRemaining <= 60) {
    statusSeverity = 'warning';
    statusText = `5th Month Review Due (${daysRemaining} days left)`;
  }

  return {
    isProbationary: true,
    dateHired: employee.dateHired,
    regularizationDate: m6Date.toISOString().split('T')[0],
    daysRemaining,
    statusText,
    statusSeverity,
    month1Due: m1Date.toISOString().split('T')[0],
    month2Due: m2Date.toISOString().split('T')[0],
    month3Due: m3Date.toISOString().split('T')[0],
    month4Due: m4Date.toISOString().split('T')[0],
    month5Due: m5Date.toISOString().split('T')[0],
    month6Due: m6Date.toISOString().split('T')[0],
  };
}

export interface DocumentExpiryAlert {
  employeeId: string;
  employeeName: string;
  reqId: string;
  docName: string;
  expiryDate: string;
  daysLeft: number;
  status: 'EXPIRED' | 'EXPIRING_SOON' | 'VALID';
}

export interface EmployeeTenure {
  hiredDate: string;
  days: number;
  months: number;
  years: number;
  formattedText: string;
  isNewHire: boolean; // hired within last 90 days / 3 months
}

export function getEmployeeTenure(dateHiredStr?: string): EmployeeTenure | null {
  if (!dateHiredStr) return null;
  const hiredDate = new Date(dateHiredStr);
  if (isNaN(hiredDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - hiredDate.getTime();
  if (diffMs < 0) {
    return {
      hiredDate: dateHiredStr,
      days: 0,
      months: 0,
      years: 0,
      formattedText: 'Starts in future',
      isNewHire: true,
    };
  }

  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  let years = today.getFullYear() - hiredDate.getFullYear();
  let months = today.getMonth() - hiredDate.getMonth();
  let days = today.getDate() - hiredDate.getDate();

  if (days < 0) {
    months -= 1;
    // days in previous month
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  let formattedText = '';
  if (years > 0) {
    formattedText = `${years}y ${months}m (${totalDays} days)`;
  } else if (months > 0) {
    formattedText = `${months} ${months === 1 ? 'Month' : 'Months'} ${days > 0 ? `${days}d` : ''} (${totalDays} days)`;
  } else {
    formattedText = `${totalDays} ${totalDays === 1 ? 'Day' : 'Days'}`;
  }

  return {
    hiredDate: dateHiredStr,
    days: totalDays,
    months: years * 12 + months,
    years,
    formattedText: formattedText.trim(),
    isNewHire: totalDays <= 90, // hired within 90 days
  };
}

export interface LastPayScheduleItem {
  employee: Employee;
  separationDate: string;
  scheduledPayDate: string;
  daysRemaining: number;
  isOverdue: boolean;
  status: string;
  amount?: string | number;
}

export function getLastPaySchedules(employees: Employee[]): LastPayScheduleItem[] {
  const list: LastPayScheduleItem[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  (employees || []).forEach(emp => {
    if (!emp) return;
    const isSeparated = emp.status === 'RESIGNED' || emp.status === 'SEPARATED' || Boolean(emp.separationDate);
    if (!isSeparated) return;

    const sepDateStr = emp.separationDate;
    let targetPayDate: Date;

    if (emp.lastPayScheduleDate) {
      targetPayDate = new Date(emp.lastPayScheduleDate);
    } else if (sepDateStr) {
      const sepD = new Date(sepDateStr);
      if (!isNaN(sepD.getTime())) {
        targetPayDate = new Date(sepD);
        targetPayDate.setDate(targetPayDate.getDate() + 30); // 30-day DOLE rule
      } else {
        return;
      }
    } else {
      return;
    }

    if (isNaN(targetPayDate.getTime())) return;

    const diffMs = targetPayDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    list.push({
      employee: emp,
      separationDate: sepDateStr || '',
      scheduledPayDate: targetPayDate.toISOString().split('T')[0],
      daysRemaining,
      isOverdue: daysRemaining < 0 && emp.lastPayStatus !== 'RELEASED',
      status: emp.lastPayStatus || 'PENDING',
      amount: emp.lastPayAmount,
    });
  });

  return list.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export function checkDocumentExpiries(
  employees: Employee[],
  requirements: DocumentRequirement[]
): DocumentExpiryAlert[] {
  const alerts: DocumentExpiryAlert[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const reqList = Array.isArray(requirements) ? requirements : [];
  const empList = Array.isArray(employees) ? employees : [];

  const reqMap = new Map(reqList.map(r => [r.id, r.name]));

  empList.forEach(emp => {
    if (!emp || emp.status !== 'ACTIVE') return;
    const expiries = emp.docExpiries || {};
    if (expiries && typeof expiries === 'object') {
      Object.entries(expiries).forEach(([reqId, expDateStr]) => {
        if (!expDateStr) return;
        const expDate = new Date(expDateStr);
        if (isNaN(expDate.getTime())) return;

        const diffMs = expDate.getTime() - today.getTime();
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (daysLeft < 0) {
          alerts.push({
            employeeId: emp.id,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            reqId,
            docName: reqMap.get(reqId) || reqId.toUpperCase(),
            expiryDate: expDateStr,
            daysLeft,
            status: 'EXPIRED',
          });
        } else if (daysLeft <= 30) {
          alerts.push({
            employeeId: emp.id,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            reqId,
            docName: reqMap.get(reqId) || reqId.toUpperCase(),
            expiryDate: expDateStr,
            daysLeft,
            status: 'EXPIRING_SOON',
          });
        }
      });
    }
  });

  return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function checkMissingGovIds(employee: Partial<Employee>): string[] {
  const missing: string[] = [];
  const clean = (val?: string) => (val || '').trim().replace(/[-–\s]/g, '');

  const sss = clean(employee.sss);
  if (!sss || sss === '0' || sss.toLowerCase() === 'na' || sss.toLowerCase() === 'none' || sss.toLowerCase() === 'pending') {
    missing.push('SSS');
  }

  const tin = clean(employee.tin);
  if (!tin || tin === '0' || tin.toLowerCase() === 'na' || tin.toLowerCase() === 'none' || tin.toLowerCase() === 'pending') {
    missing.push('TIN');
  }

  const philhealth = clean(employee.philhealth);
  if (!philhealth || philhealth === '0' || philhealth.toLowerCase() === 'na' || philhealth.toLowerCase() === 'none' || philhealth.toLowerCase() === 'pending') {
    missing.push('PhilHealth');
  }

  const pagibig = clean(employee.pagibig);
  if (!pagibig || pagibig === '0' || pagibig.toLowerCase() === 'na' || pagibig.toLowerCase() === 'none' || pagibig.toLowerCase() === 'pending') {
    missing.push('Pag-IBIG');
  }

  return missing;
}

/**
 * Automatically compresses and resizes any image File, Blob, or base64 Data URL
 * to fit comfortably inside Firestore's 1MB document limit (~15KB-30KB compressed JPEG).
 * Ensures cross-device and cross-browser realtime cloud synchronization without document size errors.
 */
export async function compressImageToDataUrl(
  source: File | Blob | string,
  maxDimension = 360,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve) => {
    let srcUrl: string;
    let revokeNeeded = false;

    if (typeof source === 'string') {
      if (source.startsWith('http://') || source.startsWith('https://')) {
        // External URLs are already tiny strings, return directly
        return resolve(source);
      }
      srcUrl = source;
    } else {
      srcUrl = URL.createObjectURL(source);
      revokeNeeded = true;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          if (revokeNeeded) URL.revokeObjectURL(srcUrl);
          return resolve(srcUrl);
        }

        // Fill white background for transparent PNGs converted to JPEG
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        if (revokeNeeded) URL.revokeObjectURL(srcUrl);
        resolve(compressedDataUrl);
      } catch (err) {
        if (revokeNeeded) URL.revokeObjectURL(srcUrl);
        resolve(srcUrl);
      }
    };
    img.onerror = () => {
      if (revokeNeeded) URL.revokeObjectURL(srcUrl);
      resolve(typeof source === 'string' ? source : srcUrl);
    };
    img.src = srcUrl;
  });
}

