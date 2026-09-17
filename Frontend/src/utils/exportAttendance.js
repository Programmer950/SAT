import * as XLSX from 'xlsx';

/**
 * Sanitizes input strings for valid file names
 */
const sanitizeFileNamePart = (str) => {
  if (!str) return 'UNKNOWN';
  return str.toString().trim().replace(/[^a-zA-Z0-9_-]/g, '-');
};

/**
 * Builds standard file name: <COURSE_CODE>_<DATE>_<START_TIME>
 * Example: CS101_2026-09-15_08-30
 */
export const generateFileName = (session, extension) => {
  const course = sanitizeFileNamePart(session.course_code || session.course_name);
  const date = sanitizeFileNamePart(session.session_date);
  const startTime = sanitizeFileNamePart(session.start_time);
  return `${course}_${date}_${startTime}.${extension}`;
};

/**
 * Prepares consistent tabular data for exports
 */
export const prepareAttendanceData = (records) => {
  return records.map((record, index) => ({
    "S.No": index + 1,
    "Roll Number": record.roll_no,
    "Student Name": record.name,
    "Institutional Email": record.email,
    "Marked At": record.timestamp ? new Date(record.timestamp).toLocaleTimeString() : "N/A",
    "Platform": record.platform || "android",
    "Status": record.is_flagged ? "Flagged" : (record.verification_status === "VERIFIED" ? "Verified" : (record.selfie_url ? "Photo Verified" : "Clean")),
    "Flag Reasons": record.flag_reasons && record.flag_reasons.length > 0 ? record.flag_reasons.join(', ') : "None"
  }));
};

/**
 * Export Handlers
 */
export const exportToCSV = (session, records) => {
  const data = prepareAttendanceData(records);
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
  
  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, generateFileName(session, 'csv'));
};

export const exportToExcel = (session, records) => {
  const data = prepareAttendanceData(records);
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
  
  XLSX.writeFile(workbook, generateFileName(session, 'xlsx'));
};

export const exportToJSON = (session, records) => {
  const payload = {
    session_metadata: {
      course: session.course_code || session.course_name,
      room: session.room,
      date: session.session_date,
      start_time: session.start_time,
      end_time: session.end_time,
      total_students: records.length,
    },
    attendance: records.map(r => ({
      roll_no: r.roll_no,
      name: r.name,
      email: r.email,
      marked_at: r.timestamp,
      platform: r.platform,
      is_flagged: r.is_flagged,
      verification_status: r.verification_status,
      flag_reasons: r.flag_reasons,
      selfie_url: r.selfie_url
    }))
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, generateFileName(session, 'json'));
};

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
