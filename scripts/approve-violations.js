const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeDescription, OCR_FORBIDDEN_PATTERNS } = require('./normalize-violations');
const { activityScope } = require('./activity-scopes');

const root = path.join(__dirname, '..');
const approvedFile = path.join(root, 'public', 'data', 'violations.json');
const manifestFile = path.join(root, 'public', 'data', 'violations.manifest.json');
const inputArg = process.argv.find(arg => arg.startsWith('--input='));

if (!inputArg) {
  throw new Error('حدد ملف JSON المستخرج من PDF باستخدام --input=/absolute/path/violations.raw.json');
}

const inputFile = path.resolve(inputArg.slice('--input='.length));
if (!fs.existsSync(inputFile)) throw new Error(`ملف الاستيراد غير موجود: ${inputFile}`);

const rows = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
if (!Array.isArray(rows)) throw new Error('ملف الاستيراد يجب أن يحتوي على مصفوفة بنود JSON');

const expectedSectors = new Set([
  'الغذاء', 'الأعلاف', 'منتجات التجميل', 'المستحضرات البيطرية',
  'المستحضرات الصيدلانية والعشبية', 'الأجهزة والمستلزمات الطبية'
]);
const failures = [];
const approved = rows.map((row, index) => {
  const normalized = { ...row, description: normalizeDescription(row.description) };
  normalized.activity = activityScope(normalized);
  for (const field of ['id', 'sector', 'activity', 'category', 'code', 'description', 'source']) {
    if (!String(normalized[field] || '').trim()) failures.push(`الصف ${index + 1}: الحقل ${field} مفقود`);
  }
  if (!expectedSectors.has(normalized.sector)) failures.push(`الصف ${index + 1}: قطاع غير معتمد`);
  if (!Number.isFinite(Number(normalized.page)) || Number(normalized.page) < 1) failures.push(`الصف ${index + 1}: صفحة غير صحيحة`);
  const artifact = OCR_FORBIDDEN_PATTERNS.find(pattern => pattern.test(normalized.description));
  if (artifact) failures.push(`الصف ${index + 1}: بقي أثر PDF/OCR ${artifact}`);
  return normalized;
});

if (approved.length !== 1775) failures.push(`عدد البنود ${approved.length} بدلًا من 1775`);
if (new Set(approved.map(row => row.id)).size !== approved.length) failures.push('توجد معرفات بنود مكررة');
if (failures.length) throw new Error(`رفض اعتماد البيانات:\n${failures.slice(0, 30).join('\n')}`);

const canonical = `${JSON.stringify(approved, null, 2)}\n`;
const sha256 = crypto.createHash('sha256').update(canonical).digest('hex');
const sectors = Object.fromEntries([...expectedSectors].map(sector => [sector, approved.filter(row => row.sector === sector).length]));
const manifest = {
  format_version: 1,
  source_release: 'SFDA-2026-07',
  approved_rows: approved.length,
  sectors,
  data_file: 'violations.json',
  sha256
};

fs.writeFileSync(approvedFile, canonical);
fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Approved and locked ${approved.length} rows (${sha256.slice(0, 12)}…).`);
