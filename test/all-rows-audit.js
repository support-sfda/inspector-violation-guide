const fs = require('fs');
const path = require('path');
const { normalizeDescription, OCR_FORBIDDEN_PATTERNS } = require('../scripts/normalize-violations');
const { activityScope } = require('../scripts/activity-scopes');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'violations.json'), 'utf8'));
const expectedSectors = [
  'الغذاء', 'الأعلاف', 'منتجات التجميل', 'المستحضرات البيطرية',
  'المستحضرات الصيدلانية والعشبية', 'الأجهزة والمستلزمات الطبية'
];
const failures = [];
const allowedLongWords = new Set(['والإكلينيكية', 'والمؤتمرات', 'بالمستحضرات']);
const scenarios = data.map((row, index) => {
  for (const field of ['sector', 'activity', 'category', 'code', 'description', 'source']) {
    if (!String(row[field] || '').trim()) failures.push({ index: index + 1, field, reason: 'missing' });
  }
  if (!Number.isFinite(Number(row.page)) || Number(row.page) < 1) failures.push({ index: index + 1, field: 'page', reason: 'invalid' });
  if (!expectedSectors.includes(row.sector)) failures.push({ index: index + 1, field: 'sector', reason: row.sector });
  if (row.activity !== activityScope(row)) failures.push({ index: index + 1, field: 'activity', reason: 'section-mismatch' });
  if (row.description !== normalizeDescription(row.description)) failures.push({ index: index + 1, field: 'description', reason: 'not-normalized' });
  const forbidden = OCR_FORBIDDEN_PATTERNS.find(pattern => pattern.test(row.description));
  if (forbidden) failures.push({ index: index + 1, field: 'description', reason: `known-pdf-ocr-artifact: ${forbidden}` });
  const suspiciousLongWords = row.description.split(/\s+/).filter(word => word.length >= 12 && !allowedLongWords.has(word));
  if (suspiciousLongWords.length) failures.push({ index: index + 1, field: 'description', reason: `possible-joined-words: ${suspiciousLongWords.join(', ')}` });
  return `خلال التفتيش على ${row.sector} لوحظ: ${row.description}`;
});
const distribution = Object.fromEntries(expectedSectors.map(sector => [sector, data.filter(row => row.sector === sector).length]));
const report = {
  generated_at: new Date().toISOString(),
  rows_audited: data.length,
  scenarios_generated: scenarios.length,
  sectors: distribution,
  failed: failures.length,
  failures
};
fs.writeFileSync(path.join(__dirname, 'all-rows-report.json'), JSON.stringify(report, null, 2));
if (data.length !== 1775) throw new Error(`عدد البنود غير متوقع: ${data.length}`);
if (failures.length) throw new Error(`فشل تدقيق ${failures.length} حقلاً في قاعدة المخالفات`);
console.log(`All-rows audit passed: ${data.length} rows and ${scenarios.length} generated scenarios across ${expectedSectors.length} sectors.`);
