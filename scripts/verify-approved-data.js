const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeDescription, OCR_FORBIDDEN_PATTERNS } = require('./normalize-violations');
const { activityScope } = require('./activity-scopes');

const root = path.join(__dirname, '..');
const dataFile = path.join(root, 'public', 'data', 'violations.json');
const manifestFile = path.join(root, 'public', 'data', 'violations.manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const raw = fs.readFileSync(dataFile, 'utf8');
const rows = JSON.parse(raw);
const sha256 = crypto.createHash('sha256').update(raw).digest('hex');

if (sha256 !== manifest.sha256) throw new Error('فشل قفل البيانات: تغير violations.json دون إعادة الاعتماد');
if (rows.length !== manifest.approved_rows) throw new Error('عدد البنود لا يطابق بيان الاعتماد');

for (const [index, row] of rows.entries()) {
  if (!row.activity) throw new Error(`البند ${index + 1} لا يحتوي نطاق التطبيق`);
  if (row.activity !== activityScope(row)) throw new Error(`البند ${index + 1} لا يطابق نطاق القسم الرسمي`);
  if (row.description !== normalizeDescription(row.description)) throw new Error(`البند ${index + 1} غير مطبع نصيًا`);
  const artifact = OCR_FORBIDDEN_PATTERNS.find(pattern => pattern.test(row.description));
  if (artifact) throw new Error(`البند ${index + 1} يحتوي أثر PDF/OCR: ${artifact}`);
}

const sectors = Object.fromEntries(Object.keys(manifest.sectors).map(sector => [sector, rows.filter(row => row.sector === sector).length]));
if (JSON.stringify(sectors) !== JSON.stringify(manifest.sectors)) throw new Error('توزيع القطاعات لا يطابق بيان الاعتماد');
console.log(`Approved data verified: ${rows.length} rows (${sha256.slice(0, 12)}…).`);
