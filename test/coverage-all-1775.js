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
dom.window.eval(`${app}\nwindow.__SEARCH_ENGINE_TEST__={detectCases,score,subjectSupported,canonical:s=>norm(cleanText(s))};`);

const sectorCue = {
  'المستحضرات البيطرية': 'المستحضرات البيطرية',
  'الأعلاف': 'الغذاء والأعلاف',
  'الغذاء': 'الغذاء والأعلاف',
  'الأجهزة والمستلزمات الطبية': 'الأجهزة والمستلزمات الطبية',
  'المستحضرات الصيدلانية والعشبية': 'المستحضرات الصيدلانية',
  'منتجات التجميل': 'منتجات التجميل'
};

const wait = () => new Promise(resolve => setTimeout(resolve, 0));

(async () => {
  await wait();
  const engine = dom.window.__SEARCH_ENGINE_TEST__;
  const document = dom.window.document;
  const failures = [];
  let exactRowMatches = 0;
  let equivalentTextMatches = 0;
  const started = Date.now();
  const limit = 20;

  for (const [index, row] of data.entries()) {
    const filter = [...document.querySelectorAll('#sectors .chip')]
      .find(button => button.textContent === sectorCue[row.sector]);
    if (!filter) throw new Error(`تعذر العثور على مرشح القطاع: ${row.sector}`);
    filter.click();
    const question = row.description;
    const cases = engine.detectCases(question);
    const perCase = Math.max(1, Math.min(3, Math.floor(limit / cases.length) || 1));
    const groups = cases.map(currentCase => {
      if (!currentCase.sector && !engine.subjectSupported(currentCase.text, currentCase.intent)) {
        return { case: currentCase, type: 'none', rows: [] };
      }
      const candidates = data
        .filter(candidate => !currentCase.sector || candidate.sector === currentCase.sector)
        .map(candidate => ({ row: candidate, ...engine.score(candidate, currentCase.text, currentCase.intent) }))
        .sort((a, b) => b.s - a.s);
      const direct = candidates.filter(candidate => candidate.match === 'direct');
      const near = candidates.filter(candidate => candidate.match === 'near');
      return {
        case: currentCase,
        type: direct.length ? 'direct' : near.length ? 'near' : 'none',
        rows: (direct.length ? direct : near).slice(0, perCase)
      };
    });
    const exactMatch = groups.some(group => group.rows.some(result =>
      result.row.id === row.id));
    const equivalentMatch = groups.some(group => group.rows.some(result =>
      engine.canonical(result.row.description) === engine.canonical(row.description)
      && result.row.sector === row.sector));
    const matched = exactMatch || equivalentMatch;
    if (exactMatch) exactRowMatches++;
    else if (equivalentMatch) equivalentTextMatches++;
    if (!matched) failures.push({
      index: index + 1,
      id: row.id,
      code: row.code,
      sector: row.sector,
      question,
      detected_cases: cases,
      returned: groups.flatMap(group => group.rows.map(result => ({
        id: result.row.id,
        code: result.row.code,
        sector: result.row.sector,
        description: result.row.description,
        match: result.match,
        score: result.s
      })))
    });
    if ((index + 1) % 250 === 0) console.log(`Exhaustive progress: ${index + 1}/${data.length}`);
  }

  const report = {
    generated_at: new Date().toISOString(),
    method: 'كل نص مخالفة اختُبر كسؤال مستقل داخل مرشح قطاعه الرسمي، ومر عبر محلل الحالات ومحرك المطابقة والترتيب الفعليين، مع حد 20 نتيجة وبحد أقصى 3 نتائج لكل حالة.',
    questions: data.length,
    passed: data.length - failures.length,
    failed: failures.length,
    exact_row_matches: exactRowMatches,
    equivalent_duplicate_text_matches: equivalentTextMatches,
    pass_rate: `${(((data.length - failures.length) / data.length) * 100).toFixed(2)}%`,
    duration_seconds: Number(((Date.now() - started) / 1000).toFixed(2)),
    sector_distribution: Object.fromEntries(Object.keys(sectorCue)
      .map(sector => [sector, data.filter(row => row.sector === sector).length])),
    failures
  };
  fs.writeFileSync(path.join(__dirname, 'coverage-all-1775-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  if (failures.length) throw new Error(`فشل ${failures.length} من ${data.length} سؤالًا. راجع test/coverage-all-1775-report.json`);
  console.log(`Exhaustive suite passed: ${report.passed}/${report.questions} (${report.pass_rate}) in ${report.duration_seconds}s.`);
})().catch(error => { console.error(error); process.exit(1); });
