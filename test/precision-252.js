const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8')
  .replace(/<link[^>]+>/g, '').replace(/<script src=[^>]+><\/script>/g, '');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'violations.json'), 'utf8'));
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/' });
dom.window.fetch = async () => ({ json: async () => data });
dom.window.eval(app);

const cues = {
  'الغذاء': 'منتج غذائي', 'الأعلاف': 'منتج أعلاف', 'منتجات التجميل': 'مستحضر تجميل',
  'المستحضرات البيطرية': 'مستحضر بيطري', 'المستحضرات الصيدلانية والعشبية': 'دواء',
  'الأجهزة والمستلزمات الطبية': 'جهاز طبي'
};
const intents = [
  { label: 'منتجات منتهية الصلاحية', forms: s => [`${s} منتهي الصلاحية`,`${s} انتهت صلاحيته`,`${s} صلاحيته خلصت`,`${s} منقضي الصلاحية`, `لقينا ${s} منتهي`, `لوحظ تداول ${s} بعد انتهاء صلاحيته`] },
  { label: 'منتج مغشوش أو مقلد', forms: s => [`${s} مغشوش`,`${s} مقلد`,`${s} مزور`,`${s} مزيف`, `اشتباه غش في ${s}`, `تم ضبط ${s} غير أصلي ومقلد`] },
  { label: 'منتج محظور أو محذر منه', forms: s => [`${s} محظور`,`${s} ممنوع`,`${s} محذر منه`,`${s} صادر عليه تحذير`, `تم منع تداول ${s}`, `لوحظ بيع ${s} موقوف تداوله`] },
  { label: 'منتج غير مسجل أو غير مدرج', forms: s => [`${s} غير مسجل`,`${s} غير مدرج`,`${s} بدون تسجيل`,`${s} مو مسجل`, `ما لقينا تسجيل ${s}`, `تداول ${s} دون تسجيل`] },
  { label: 'منتج فاسد أو تالف', forms: s => [`${s} فاسد`,`${s} تالف`,`${s} غير صالح`,`${s} خربان`, `لوحظ فساد ${s}`, `تم تخزين ${s} متعفن وتالف`] }
];

const wait = () => new Promise(resolve => setTimeout(resolve, 0));
(async () => {
  await wait();
  const document = dom.window.document, failures = [], cases = [];
  document.querySelector('#limit').value = '20';
  for (const [sector, subject] of Object.entries(cues)) for (const intent of intents)
    for (const query of intent.forms(subject)) cases.push({ query, sector, expected: intent.label, kind: 'language' });

  const activities = [...new Map(data.map(row => [`${row.sector}|${row.activity}`, row])).values()];
  for (const row of activities.slice(0, 36)) {
    cases.push({ query: `${row.activity} يمارس النشاط دون ترخيص`, sector: row.sector, activity: row.activity, kind: 'scope' });
    cases.push({ query: `مخالفة ترخيص لدى ${row.activity}`, sector: row.sector, activity: row.activity, kind: 'scope' });
  }
  if (cases.length !== 252) throw new Error(`عدد الاختبارات ${cases.length} بدلًا من 252`);

  for (const test of cases) {
    document.querySelector('#query').value = test.query;
    document.querySelector('#search').click();
    const groups = [...document.querySelectorAll('.case-group')];
    const relevant = groups.find(group => group.querySelector('h2')?.textContent.includes(test.sector));
    const ok = relevant && (test.kind === 'language'
      ? relevant.querySelector('h2').textContent.includes(test.expected)
      : relevant.querySelector('.card') && relevant.textContent.includes(test.activity));
    if (!ok) failures.push({ ...test, status: document.querySelector('#status')?.textContent, output: document.querySelector('#results')?.textContent.slice(0, 500) });
  }
  const report = { generated_at: new Date().toISOString(), total: cases.length, passed: cases.length - failures.length,
    failed: failures.length, pass_rate: `${((cases.length-failures.length)/cases.length*100).toFixed(2)}%`, failures };
  fs.writeFileSync(path.join(__dirname, 'precision-252-report.json'), JSON.stringify(report, null, 2));
  if (failures.length) throw new Error(`فشل ${failures.length} من ${cases.length} اختبار دقة`);
  console.log(`Precision suite passed: ${report.passed}/${report.total} (${report.pass_rate}).`);
})().catch(error => { console.error(error); process.exit(1); });
