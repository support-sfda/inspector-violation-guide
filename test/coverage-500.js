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
const wait = () => new Promise(resolve => setTimeout(resolve, 0));
const cleanText = s => (s || '').replace(/الإعالن|االعالن/g,'الإعلان').replace(/ال وصفي/g,'لا وصفي').replace(/الرتويج/g,'الترويج').replace(/الصيدالنية/g,'الصيدلانية').replace(/صيديل/g,'صيدلي').replace(/العالمني/g,'العاملين').replace(/األطباء/g,'الأطباء').replace(/ألخالقيات/g,'لأخلاقيات').replace(/سوا\s*ً?ء/g,'سواء').replace(/عليهدون/g,'عليه دون').replace(/عنمنتجات/g,'عن منتجات').replace(/المستحضراتالصيد/g,'المستحضرات الصيد').replace(/شهادةإذن/g,'شهادة إذن').replace(/\s+قيمة(?=\s|$)/g,'').replace(/مستلزم طيب/g,'مستلزم طبي').replace(/جهاز طيب/g,'جهاز طبي').replace(/خالل/g,'خلال').replace(/استرياد/g,'استيراد');
const sectorCue = {
  'المستحضرات البيطرية': 'مستحضرات بيطرية', 'الأعلاف': 'أعلاف', 'الغذاء': 'غذاء',
  'الأجهزة والمستلزمات الطبية': 'أجهزة طبية', 'المستحضرات الصيدلانية والعشبية': 'مستحضرات صيدلانية',
  'منتجات التجميل': 'منتجات تجميل'
};

(async () => {
  await wait();
  const document = dom.window.document;
  document.querySelector('#limit').value = '20';
  const sectors = Object.keys(sectorCue), selected = [];
  const pools = sectors.map(sector => [...new Map(data.filter(x => x.sector === sector && x.description.length >= 12)
    .map(x => [x.description, x])).values()]);
  for (let depth = 0; selected.length < 500; depth++) {
    let added = false;
    for (const pool of pools) if (pool[depth] && selected.length < 500) { selected.push(pool[depth]); added = true; }
    if (!added) break;
  }
  if (selected.length !== 500) throw new Error(`تعذر تكوين 500 سؤال: ${selected.length}`);
  const failures = [];
  const templates = [
    row => `خلال التفتيش على ${sectorCue[row.sector]} رصدت: ${row.description}`,
    row => `ما التصنيف المحتمل في ${sectorCue[row.sector]} عند ملاحظة ${row.description}`,
    row => `${sectorCue[row.sector]} — ${row.description}`
  ];
  selected.forEach((row, index) => {
    document.querySelector('#query').value = templates[index % templates.length](row);
    document.querySelector('#search').click();
    const cards = [...document.querySelectorAll('.card')];
    if (!cards.some(card => card.textContent.includes(cleanText(row.description)) && card.textContent.includes(row.sector)))
      failures.push({ index: index + 1, sector: row.sector, code: row.code, question: document.querySelector('#query').value });
  });
  const fieldCases = [
    ['مستودع اغذية منتهي ترخيصه وجدت فيه منتجات بيطرية وتجميلية منتهية كذلك احتمال اجهزة طبية مغشوشة ووجود مناديب دعاية', ['انتهاء ترخيص المنشأة','المستحضرات البيطرية','منتجات التجميل','منتج مغشوش أو مقلد','مندوبو التعريف بالمستحضرات']],
    ['ما لقيت تسجيل للحرارة في مستودع غذاء', ['سجلات ومراقبة الحرارة','الغذاء']],
    ['المنشأة رفضت دخول المفتش', ['إعاقة أو منع المفتش']],
    ['جهاز طبي مغشوش ولم يتم إبلاغ الهيئة', ['منتج مغشوش أو مقلد','الأجهزة والمستلزمات الطبية']],
    ['منتج تجميلي غير مدرج ومنتهي الصلاحية', ['غير مسجل أو غير مدرج','منتهية الصلاحية','منتجات التجميل']],
    ['مستحضر بيطري محظور ومغشوش', ['محظور أو محذر منه','مغشوش أو مقلد','المستحضرات البيطرية']],
    ['أغذية فاسدة داخل مستودع غير مرخص', ['فاسد أو تالف','دون ترخيص','الغذاء']],
    ['نقل دواء منتهي في سيارة غير مناسبة', ['النقل والتوزيع','منتهية الصلاحية','المستحضرات الصيدلانية والعشبية']],
    ['إعلان عن منتج تجميلي غير مدرج', ['الإعلان والدعاية','غير مسجل أو غير مدرج','منتجات التجميل']],
    ['لا توجد فواتير شراء للمستحضرات البيطرية', ['السجلات والتوثيق','المستحضرات البيطرية']],
    ['مستودع بيطري منتهي ترخيصه وجدت به منتجات تجميل محظورة كما ان مقاييس الحرارة في المستودع غير كافيه و مناديب الدعاية مخالفين', ['انتهاء ترخيص المنشأة','منتج محظور','سجلات ومراقبة الحرارة','المستحضرات البيطرية','مندوبو التعريف بالمستحضرات']],
    ['مستودع ادوية منتهي ترخيصه وعنده اجهزة طبية ماعندها شهاد اذن تسويق', ['انتهاء ترخيص المنشأة','المستحضرات الصيدلانية والعشبية','عدم وجود شهادة إذن تسويق','الأجهزة والمستلزمات الطبية']]
  ];
  for (const [question, expected] of fieldCases) {
    document.querySelector('#query').value = question;
    document.querySelector('#search').click();
    const text = document.querySelector('#results').textContent;
    if (!expected.every(term => text.includes(term))) failures.push({ question, missing: expected.filter(term => !text.includes(term)), output: text.slice(0, 800) });
  }
  const total = selected.length + fieldCases.length;
  const sector_distribution = Object.fromEntries(sectors.map(sector => [sector, selected.filter(x => x.sector === sector).length]));
  const report = { generated_at: new Date().toISOString(), total, systematic_questions: selected.length,
    field_questions: fieldCases.length, sector_distribution, passed: total - failures.length, failed: failures.length,
    pass_rate: ((total - failures.length) / total * 100).toFixed(2) + '%', failures };
  fs.writeFileSync(path.join(__dirname, 'coverage-report.json'), JSON.stringify(report, null, 2));
  if (failures.length) throw new Error(`فشل ${failures.length} من ${report.total} اختباراً. راجع test/coverage-report.json`);
  console.log(`Coverage suite passed: ${report.passed}/${report.total} (${report.pass_rate}).`);
})().catch(error => { console.error(error); process.exit(1); });
