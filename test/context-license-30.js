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

const subjects = {
  'الغذاء': ['غذاء', 'منتجات غذائية'], 'الأعلاف': ['أعلاف', 'منتجات أعلاف'],
  'منتجات التجميل': ['تجميل', 'منتجات تجميل'], 'المستحضرات البيطرية': ['بيطري', 'مستحضرات بيطرية'],
  'المستحضرات الصيدلانية والعشبية': ['أدوية', 'أدوية'], 'الأجهزة والمستلزمات الطبية': ['أجهزة طبية', 'أجهزة طبية']
};
const wait = () => new Promise(resolve => setTimeout(resolve, 0));

(async () => {
  await wait();
  const document = dom.window.document, sectors = Object.keys(subjects), failures = [];
  document.querySelector('#limit').value = '20';
  for (const host of sectors) for (const contained of sectors) {
    if (host === contained) continue;
    const query = `مستودع ${subjects[host][0]} لديه ${subjects[contained][1]} غير مسجلة`;
    document.querySelector('#query').value = query;
    document.querySelector('#search').click();
    const groups = [...document.querySelectorAll('.case-group')];
    const inferred = groups.find(group => group.textContent.includes('استدلال سياقي') && group.querySelector('h2')?.textContent.includes(contained));
    if (!inferred?.textContent.includes('نطاق التطبيق:') || !inferred.textContent.includes('مستودع'))
      failures.push({ host, contained, query, output: document.querySelector('#results').textContent.slice(0, 700) });
  }
  const report = { total: 30, passed: 30 - failures.length, failed: failures.length, failures };
  fs.writeFileSync(path.join(__dirname, 'context-license-30-report.json'), JSON.stringify(report, null, 2));
  if (failures.length) throw new Error(`فشل ${failures.length} من 30 اختبار ربط ترخيص`);
  console.log('Contextual license suite passed: 30/30.');
})().catch(error => { console.error(error); process.exit(1); });
