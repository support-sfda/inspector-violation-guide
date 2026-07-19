const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8')
  .replace('<link rel="stylesheet" href="styles.css">', '')
  .replace('<script src="app.js"></script>', '');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'violations.json'), 'utf8'));

const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/' });
dom.window.fetch = async () => ({ json: async () => data });
dom.window.eval(app);

function expect(value, message) { if (!value) throw new Error(message); }
function wait() { return new Promise(resolve => setTimeout(resolve, 0)); }

(async () => {
  await wait();
  const { document, KeyboardEvent } = dom.window;
  expect(data.length === 1775, 'قاعدة التصنيفات كاملة');
  expect(document.querySelector('.hero p').textContent.includes('1,775 بند مخالفة'), 'إجمالي البنود ظاهر ضمن النص التعريفي');
  expect(document.querySelector('.brand small').textContent === 'أداة ذكية مساندة للمفتش', 'النص التعريفي العلوي محدث');
  expect(document.querySelector('.eyebrow').textContent === 'البحث الذكي في بنود المخالفات', 'عنوان البحث محدث');
  expect(document.querySelector('.hero h1').textContent === 'صِف الحالة المرصودة أثناء الزيارة التفتيشية', 'عنوان وصف الحالة محدث');
  expect(document.querySelector('.hero p').textContent === 'اكتب وصفًا دقيقًا للحالة المرصودة، وسيحلل الدليل الوصف ويطابقه مع 1,775 بند مخالفة وفق جداول تصنيف المخالفات المعتمدة، ثم يعرض البنود الأكثر صلة.', 'النص التعريفي المدمج محدث');
  expect(!document.querySelector('.stat'), 'عدد البنود غير مكرر في عنصر منفصل');
  expect(document.querySelector('#search').textContent === 'عرض المخالفات المحتملة', 'نص زر البحث محدث');
  expect(document.querySelector('.search-advisory').textContent.includes('النتائج المعروضة استرشادية'), 'التنبيه الاسترشادي ظاهر');
  expect(document.documentElement.dir === 'rtl', 'اتجاه الواجهة من اليمين إلى اليسار');
  const sectorLabels = [...document.querySelectorAll('.chip')].map(x => x.textContent);
  expect(JSON.stringify(sectorLabels) === JSON.stringify(['الكل','الغذاء والأعلاف','المستحضرات الصيدلانية','المستحضرات البيطرية','منتجات التجميل','الأجهزة والمستلزمات الطبية']), 'مسميات قطاعات البحث موحدة');
  [...document.querySelectorAll('.chip')].find(x => x.textContent === 'الغذاء والأعلاف').click();
  document.querySelector('#query').value = 'ممارسة النشاط دون ترخيص';
  document.querySelector('#search').click();
  const foodFeedText = document.querySelector('#results').textContent;
  expect(foodFeedText.includes('الغذاء') && foodFeedText.includes('الأعلاف'), 'مرشح الغذاء والأعلاف يشمل القطاعين');
  [...document.querySelectorAll('.chip')].find(x => x.textContent === 'الكل').click();
  const allOfficialSectors = ['الغذاء','الأعلاف','المستحضرات الصيدلانية والعشبية','المستحضرات البيطرية','منتجات التجميل','الأجهزة والمستلزمات الطبية'];
  for (const genericQuery of ['بطاقة تعريفية','مغشوش','منتهي','تالف','تحذير']) {
    document.querySelector('#query').value = genericQuery;
    document.querySelector('#search').click();
    const genericGroups = [...document.querySelectorAll('.case-group')];
    expect(genericGroups.length === allOfficialSectors.length, `العبارة العامة «${genericQuery}» تُبحث في جميع القطاعات`);
    expect(allOfficialSectors.every(sector => genericGroups.some(group => group.querySelector('h2').textContent.includes(sector))), `نتائج «${genericQuery}» تغطي مسميات القطاعات الستة`);
  }
  document.querySelector('#query').value = 'بطاقة تعريفية تجميل';
  document.querySelector('#search').click();
  expect(document.querySelectorAll('.case-group').length === 1 && document.querySelector('.case-group h2').textContent.includes('منتجات التجميل'), 'ذكر التجميل يحصر البطاقة التعريفية في قطاع التجميل');
  document.querySelector('#query').value = 'بطاقة تعريفية غذاء';
  document.querySelector('#search').click();
  expect(document.querySelectorAll('.case-group').length === 1 && document.querySelector('.case-group h2').textContent.includes('الغذاء'), 'ذكر الغذاء يحصر البطاقة التعريفية في قطاع الغذاء');
  document.querySelector('#limit').value = '10';
  document.querySelector('#query').value = 'متابعة بلاغات الأجهزة و المستلزمات الطبية';
  document.querySelector('#search').click();
  const proceduralGroups = [...document.querySelectorAll('.case-group')];
  const proceduralCards = [...document.querySelectorAll('.card')];
  expect(proceduralGroups.length === 1, 'العبارة الإجرائية المرتبطة بقطاع واضح لا تتوسع إلى قطاعات أخرى');
  expect(proceduralGroups[0].querySelector('h2').textContent.includes('البلاغات والمتابعة والإجراءات') && proceduralGroups[0].querySelector('h2').textContent.includes('الأجهزة والمستلزمات الطبية'), 'يلتقط اسم قطاع الأجهزة الكامل ومسار البلاغات والمتابعة');
  expect(!proceduralGroups[0].classList.contains('none') && proceduralCards.length >= 1, 'يعرض أقرب بنود الإجراءات والبلاغات بدل رسالة عدم وجود نص');
  expect(proceduralCards.every(card => card.textContent.includes('الأجهزة والمستلزمات الطبية')), 'لا يخلط البحث الإجرائي الواضح بقطاعات الغذاء أو الدواء أو التجميل أو الأعلاف');
  expect(new Set(proceduralCards.map(card => card.querySelector('.badge.activity')?.textContent)).size > 1, 'ينوّع النتائج الإجرائية ذات الصلة بحسب نطاق التطبيق ولا يحصرها في المصانع');
  for (const [query, sector] of [
    ['متابعة البلاغات للمستحضرات البيطرية','المستحضرات البيطرية'],
    ['إجراءات عمل منتجات التجميل','منتجات التجميل'],
    ['تقارير الأعلاف','الأعلاف'],
    ['إجراءات الغذاء','الغذاء'],
    ['بلاغات المستحضرات الصيدلانية والعشبية','المستحضرات الصيدلانية والعشبية']
  ]) {
    document.querySelector('#query').value = query;
    document.querySelector('#search').click();
    const scoped = [...document.querySelectorAll('.case-group')];
    expect(scoped.length === 1 && scoped[0].querySelector('h2').textContent.includes(sector), `يحصر البحث الإجرائي في قطاعه الصريح: ${sector}`);
  }
  document.querySelector('#query').value = 'التعديل على تاريخ صلاحية الغذاء في المستودعات';
  document.querySelector('#search').click();
  const foodExpiryGroups = [...document.querySelectorAll('.case-group')];
  const foodExpiryCards = [...document.querySelectorAll('.card')];
  expect(foodExpiryGroups.length === 1 && foodExpiryGroups[0].querySelector('h2').textContent.includes('الغذاء'), 'القطاع الصريح يتقدم على استدلال نطاق المنشأة العام');
  expect(foodExpiryCards.length >= 1 && foodExpiryCards.every(card => card.textContent.includes('الغذاء') && !card.textContent.includes('الأجهزة والمستلزمات الطبية')), 'تعديل تاريخ صلاحية الغذاء لا يُنسب إلى الأجهزة الطبية بسبب كلمة المستودعات');
  expect(foodExpiryCards.some(card => card.textContent.includes('التعديل على تاريخ') && card.textContent.includes('الموافقة الكتابية')), 'يعرض النص المباشر لتعديل تاريخ صلاحية الغذاء');
  document.querySelector('#query').value = 'ترويج';
  document.querySelector('#search').click();
  const promotionCards = [...document.querySelectorAll('.card')];
  expect(document.querySelector('#status').textContent.includes('بحث شامل عن المصطلح'), 'الكلمة الموضوعية المفردة تفعّل البحث الشامل');
  expect(promotionCards.some(card => card.textContent.includes('منتجات التجميل') && card.textContent.includes('نطاق التطبيق: منفذ البيع') && card.textContent.includes('للترويج')), 'البحث عن الترويج يشمل بند منفذ بيع منتجات التجميل');
  expect(promotionCards.filter(card => card.textContent.includes('منتجات التجميل') && card.textContent.includes('للترويج')).length >= 4, 'يعرض جميع نطاقات تطبيق الترويج في جدول التجميل دون الاكتفاء بأعلى نتيجة');
  for (const [keyword, expected] of [['ادعاء','ادعاء'],['صيانة','الصيانة'],['فاسد','فاسد']]) {
    document.querySelector('#query').value = keyword;
    document.querySelector('#search').click();
    const keywordCards = [...document.querySelectorAll('.card')];
    expect(keywordCards.length > 1 && keywordCards.some(card => card.textContent.includes(expected)), `البحث المفرد الشامل يعرض جميع البنود المرتبطة بمصطلح: ${keyword}`);
  }
  document.querySelector('#query').value = 'وجدت منتجات منتهية الصلاحية معروضة للبيع';
  document.querySelector('#search').click();
  expect(document.querySelectorAll('.card').length >= 1, 'زر البحث يعرض نتائج');
  expect(document.querySelector('.card').textContent.includes('منتهي'), 'تظهر مخالفة منتهية الصلاحية');
  expect(document.querySelector('.card .badge.activity')?.textContent.includes('نطاق التطبيق:'), 'تظهر جهة أو نوع المنشأة التي ينطبق عليها البند');
  document.querySelector('#query').value = 'رفضت المنشأة دخول المفتش';
  document.querySelector('#query').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(document.querySelectorAll('.card').length >= 1, 'البحث بزر Enter يعمل');
  document.querySelector('#query').value = 'ما لقيت تسجيل للحرارة في مستودع غذاء';
  document.querySelector('#search').click();
  const cards = [...document.querySelectorAll('.card')];
  expect(cards.length >= 1, 'عبارة المفتش الميدانية تعيد نتائج');
  expect(cards.every(card => card.textContent.includes('الغذاء')), 'ذكر الغذاء يقصر النتائج على قطاع الغذاء');
  expect(cards[0].textContent.includes('حرار') || cards[0].textContent.includes('رطوب'), 'النتيجة الأولى مرتبطة بسجلات الحرارة');
  expect(document.querySelector('#status').textContent.includes('تم تحليل 1 حالة'), 'الواجهة توضح تحليل الحالة المستقلة');
  expect(!cards[0].textContent.includes('اإل'), 'النص العربي لا يحتوي على ترتيب همزات مستخرج بصورة معكوسة');
  expect(document.querySelectorAll('mark').length === 0, 'التظليل لا يقطع اتصال الحروف العربية');
  document.querySelector('#limit').value = '10';
  document.querySelector('#query').value = 'مستودع اغذية منتهي ترخيصه وجدت فيه منتجات بيطرية وتجميلية منتهية';
  document.querySelector('#search').click();
  const groups = [...document.querySelectorAll('.case-group')];
  expect(groups.length >= 3, 'الوصف المركب يحافظ على الحالات الأصلية ويضيف متطلبات الترخيص السياقية');
  expect(groups[0].textContent.includes('انتهاء ترخيص') && groups[0].textContent.includes('الغذاء'), 'الحالة الأولى تخص انتهاء ترخيص منشأة الغذاء');
  expect(groups[0].textContent.includes('ممارسة النشاط بعد انتهاء الترخيص'), 'ترشيح انتهاء ترخيص مستودع الغذاء ظاهر');
  expect(groups[1].textContent.includes('المستحضرات البيطرية') && groups[1].textContent.includes('منتهي الصلاحية'), 'الحالة الثانية تخص المنتجات البيطرية المنتهية');
  expect(groups[2].textContent.includes('منتجات التجميل') && groups[2].textContent.includes('منتهي الصلاحية'), 'الحالة الثالثة تخص منتجات التجميل المنتهية');
  document.querySelector('#query').value = 'مستودع اغذية منتهي ترخيصه وجدت فيه منتجات بيطرية وتجميلية منتهية كذلك احتمال اجهزة طبية مغشوشة ووجود مناديب دعاية';
  document.querySelector('#search').click();
  const comprehensive = [...document.querySelectorAll('.case-group')];
  expect(comprehensive.length >= 5, 'الوصف الموسع يحافظ على الوقائع المستقلة ويضيف متطلبات الترخيص السياقية');
  expect(comprehensive.some(g => g.textContent.includes('منتج مغشوش أو مقلد') && g.textContent.includes('الأجهزة والمستلزمات الطبية')), 'مخالفة الأجهزة الطبية المغشوشة لم تُسقط');
  expect(comprehensive.some(g => g.textContent.includes('مندوبو التعريف بالمستحضرات ومتطلبات التوطين')), 'واقعة مندوبي التعريف بالمستحضرات لم تُسقط');
  document.querySelector('#query').value = 'وجود مناديب دعاية داخل المنشأة';
  document.querySelector('#search').click();
  expect(document.querySelector('.case-group.direct')?.textContent.includes('الدعاية والتعريف بالمستحضرات'), 'مندوبو التعريف بالمستحضرات يعيدون النص المباشر المخصص لهم');
  expect(document.querySelector('.case-group.direct')?.textContent.includes('المستحضرات الصيدلانية والعشبية'), 'مندوبو التعريف لا يختلطون بقطاع الإعلان البيطري أو التجميلي');
  document.querySelector('#query').value = 'مندوب التعريف بالمستحضرات غير سعودي ومخالف للتوطين';
  document.querySelector('#search').click();
  expect(document.querySelector('.card')?.textContent.includes('سعودي'), 'مخالفة توطين مندوب التعريف ترشح شرط الجنسية السعودية');
  document.querySelector('#query').value = 'إعلان عن مستحضر بيطري دون موافقة الهيئة';
  document.querySelector('#search').click();
  expect(document.querySelector('.case-group')?.textContent.includes('الإعلان والدعاية'), 'الإعلان عن المنتج يبقى مفهوماً مستقلاً');
  expect(!document.querySelector('.case-group')?.textContent.includes('مندوبو التعريف'), 'الإعلان لا يصنف على أنه مندوب تعريف');
  expect(!document.querySelector('#results').textContent.includes('الإعالن'), 'تصحيح أخطاء النص المستخرج قبل عرضه');
  expect(!document.querySelector('#results').textContent.includes('ال وصفي'), 'تصحيح كتابة اللاوصفي قبل عرضه');
  document.querySelector('#limit').value = '10';
  document.querySelector('#query').value = 'مستودع بيطري منتهي ترخيصه وجدت به منتجات تجميل محظورة كما ان مقاييس الحرارة في المستودع غير كافيه و مناديب الدعاية مخالفين';
  document.querySelector('#search').click();
  const contextual = [...document.querySelectorAll('.case-group')];
  expect(contextual.length >= 4, 'الجملة المركبة تحافظ على الوقائع وتضيف متطلبات الترخيص السياقية');
  expect(contextual.some(g => g.textContent.includes('انتهاء ترخيص المنشأة') && g.textContent.includes('المستحضرات البيطرية')), 'انتهاء ترخيص المستودع مرتبط بالقطاع البيطري');
  expect(contextual.some(g => g.textContent.includes('منتج محظور') && g.textContent.includes('منتجات التجميل')), 'المنتجات المحظورة مرتبطة بقطاع التجميل');
  expect(contextual.some(g => g.textContent.includes('سجلات ومراقبة الحرارة') && g.textContent.includes('المستحضرات البيطرية') && g.textContent.includes('مقاييس')), 'مقاييس الحرارة تعود إلى المستودع البيطري لا منتجات التجميل');
  expect(contextual.some(g => g.textContent.includes('مندوبو التعريف بالمستحضرات') && g.textContent.includes('الدعاية والتعريف بالمستحضرات')), 'مخالفة مندوبي التعريف تظهر كنص مستقل');
  const contextualVariants = [
    'في مستودع مستحضرات بيطرية انتهت الرخصة، ولوحظ أن منتجات تجميل محظورة موجودة، إضافة إلى ذلك لم تكن مقاييس الحرارة موزعة بشكل كاف، ومناديب التعريف مخالفون',
    'المنشأة البيطرية ترخيصها منتهي؛ بداخلها تجميليات محظورة؛ كما أن المستودع تنقصه مقاييس الحرارة ويوجد مندوب دعاية مخالف',
    'مخزن بيطري يعمل بعد انتهاء الترخيص وتم ضبط مستحضرات تجميل ممنوعة، والمخزن لا تتوفر فيه مقاييس كافية للحرارة، ومناديب التعريف بالمستحضرات مخالفون'
  ];
  for (const phrase of contextualVariants) {
    document.querySelector('#query').value = phrase;
    document.querySelector('#search').click();
    const text = document.querySelector('#results').textContent;
    expect(text.includes('انتهاء ترخيص المنشأة') && text.includes('منتج محظور'), 'يفهم إعادة صياغة الترخيص والمنتج المحظور');
    expect(text.includes('سجلات ومراقبة الحرارة — المستحضرات البيطرية'), 'يربط الحرارة بالمنشأة في صيغ لغوية متعددة');
    expect(text.includes('مندوبو التعريف بالمستحضرات'), 'يفصل مندوبي التعريف في صيغ لغوية متعددة');
  }
  document.querySelector('#query').value = 'مستودع بيطري منتهي ترخيصه وجدت به منتجات تجميل محظورة كما ان مقاييس الحرارة في المستودع غير كافيه و مناديب الدعاية مخالفين كما يوجد اطارات منتهية الصلاحية';
  document.querySelector('#search').click();
  const withUnknown = [...document.querySelectorAll('.case-group')];
  expect(withUnknown.at(-1)?.classList.contains('none'), 'الواقعة غير الموجودة تظهر أخيراً كحالة غير مطابقة');
  expect(withUnknown.at(-1)?.textContent.includes('اطارات') && withUnknown.at(-1)?.textContent.includes('إنفاذ الأنظمة'), 'الإطارات المنتهية لا تتحول إلى منتج خاضع وتظهر داخل الإطار الأحمر');
  expect(withUnknown.at(-1)?.querySelectorAll('.card').length === 0, 'لا تعرض نص مخالفة غير صحيح للواقعة غير المنظمة');
  for (const phrase of ['أثاث المكتب تالف', 'أقلام منتهية الصلاحية', 'ستائر المستودع محظورة']) {
    document.querySelector('#query').value = phrase;
    document.querySelector('#search').click();
    expect(document.querySelector('.case-group.none'), `الموضوع غير الموجود في الجداول لا يُحوّل إلى مخالفة: ${phrase}`);
  }
  document.querySelector('#query').value = 'مستودع ادوية منتهي ترخيصه وعنده اجهزة طبية ماعندها شهاد اذن تسويق';
  document.querySelector('#search').click();
  const authorization = [...document.querySelectorAll('.case-group')];
  expect(authorization.length >= 2, 'يفصل منشأة الأدوية عن الأجهزة الموجودة لديها ويستنتج ترخيص تخزين الأجهزة');
  expect(authorization[0].textContent.includes('انتهاء ترخيص المنشأة') && authorization[0].textContent.includes('المستحضرات الصيدلانية والعشبية'), 'انتهاء الترخيص يخص مستودع الأدوية فقط');
  expect(authorization[1].textContent.includes('عدم وجود شهادة إذن تسويق') && authorization[1].textContent.includes('الأجهزة والمستلزمات الطبية'), 'يستخرج شهادة إذن تسويق الأجهزة كواقعة مستقلة');
  expect(authorization[1].textContent.includes('غير حاصل') && authorization[1].textContent.includes('الإذن بالتسويق'), 'يعرض نص مخالفة شهادة إذن التسويق من الجدول');
  for (const phrase of ['دواء منتهي صلاحيته و ادوات كهربائية مجهولة', 'دواء منتهي صلاحيته وكذلك ادوات كهربائية مجهولة']) {
    document.querySelector('#query').value = phrase;
    document.querySelector('#search').click();
    const groups = [...document.querySelectorAll('.case-group')];
    expect(groups.length === 2, `يفصل الواقعتين مع اختلاف أداة الربط: ${phrase}`);
    expect(groups[0].textContent.includes('منتهية الصلاحية') && groups[0].textContent.includes('المستحضرات الصيدلانية'), 'يرشح مخالفة الدواء المنتهي');
    expect(groups[1].classList.contains('none') && groups[1].textContent.includes('ادوات كهربائية مجهولة'), 'يحفظ الأدوات الكهربائية كواقعة غير مطابقة داخل إطار أحمر');
  }
  document.querySelector('#query').value = 'جهاز طبي منتهي الصلاحية و ادوات تنظيف منتهية الصلاحية';
  document.querySelector('#search').click();
  const cleaningTools = [...document.querySelectorAll('.case-group')];
  expect(cleaningTools.length === 2, 'يفصل الجهاز الطبي عن أدوات التنظيف رغم اشتراكهما في وصف انتهاء الصلاحية');
  expect(cleaningTools[0].textContent.includes('الأجهزة والمستلزمات الطبية') && cleaningTools[0].textContent.includes('جهاز أو مستلزم طبي منتهي الصلاحية'), 'يرشح بند الجهاز الطبي المنتهي في قطاع الأجهزة');
  expect(cleaningTools[1].classList.contains('none') && cleaningTools[1].textContent.includes('ادوات تنظيف منتهية الصلاحية'), 'يعرض أدوات التنظيف غير المطابقة داخل الإطار الأحمر');
  for (const [phrase, unknown, regulated, sector] of [
    ['معدات حلاقة منتهية ومستحضرات تجميل محظورة', 'معدات حلاقة منتهية', 'منتج محظور', 'منتجات التجميل'],
    ['ادوات كهربائية منتهية الصلاحية ومنتجات بيطرية محظورة', 'ادوات كهربائية منتهية الصلاحية', 'منتج محظور', 'المستحضرات البيطرية']
  ]) {
    document.querySelector('#query').value = phrase;
    document.querySelector('#search').click();
    const groups = [...document.querySelectorAll('.case-group')];
    expect(groups.length === 2, `يفصل الشيء غير الخاضع عن المنتج المنظم: ${phrase}`);
    expect(groups.some(g => g.classList.contains('none') && g.textContent.includes(unknown)), `يضع الشيء غير الخاضع في الإطار الأحمر: ${unknown}`);
    expect(groups.some(g => g.textContent.includes(regulated) && g.textContent.includes(sector)), `يرشح المنتج المنظم في قطاعه الصحيح: ${sector}`);
  }
  document.querySelector('#limit').value = '10';
  document.querySelector('#query').value = 'وجدت في مستودع اغذية منتهي ترخيصه جهاز طبي محظور و منتجات تجميل منتهية الصلاحية و معدات كهربائية وأدوية مغشوشة ومنتجات بيطرية صادر بحقها قرار سحب';
  document.querySelector('#search').click();
  const fullSectorScenario = [...document.querySelectorAll('.case-group')];
  expect(fullSectorScenario.length >= 6, 'يفكك السيناريو متعدد القطاعات ويحافظ على الوقائع الأصلية');
  expect(fullSectorScenario[0].textContent.includes('انتهاء ترخيص المنشأة') && fullSectorScenario[0].textContent.includes('الغذاء'), 'يربط انتهاء الترخيص بمستودع الغذاء فقط');
  expect(!fullSectorScenario.some((g, index) => index > 0 && g.textContent.includes('انتهاء ترخيص المنشأة')), 'لا ينقل انتهاء الترخيص إلى القطاعات اللاحقة');
  expect(fullSectorScenario[1].classList.contains('near') && fullSectorScenario[1].textContent.includes('الأجهزة والمستلزمات الطبية') && fullSectorScenario[1].textContent.includes('إيقاف تداول'), 'يعرض أقرب نص لإيقاف تداول الجهاز المحظور مع توضيح أنه نص قريب');
  expect(fullSectorScenario[2].textContent.includes('منتجات التجميل') && fullSectorScenario[2].textContent.includes('منتهية الصلاحية'), 'يربط انتهاء الصلاحية بمنتجات التجميل');
  expect(fullSectorScenario.some(g => g.classList.contains('none') && g.textContent.includes('معدات كهربائية')), 'يعرض المعدات الكهربائية في الإطار الأحمر');
  expect(fullSectorScenario.some(g => g.textContent.includes('المستحضرات الصيدلانية والعشبية') && g.textContent.includes('مغشوش')), 'يربط الأدوية المغشوشة بقطاع الدواء');
  expect(fullSectorScenario.some(g => g.textContent.includes('المستحضرات البيطرية') && g.textContent.includes('سحب')), 'يربط قرار السحب بالمنتجات البيطرية');
  for (const [query, sector, expectedType, expectedText] of [
    ['غذاء مغشوش', 'الغذاء', 'direct', 'تداول غذاء مغشوش'],
    ['أعلاف مغشوشة', 'الأعلاف', 'direct', 'تداول الأعلاف مغشوشة'],
    ['مستحضر بيطري مغشوش', 'المستحضرات البيطرية', 'direct', 'تداول مستحضر بيطري مغشوش'],
    ['منتج تجميلي مغشوش', 'منتجات التجميل', 'direct', 'تداول منتج تجميلي مغشوش'],
    ['جهاز طبي مغشوش', 'الأجهزة والمستلزمات الطبية', 'near', 'عدم إبلاغ الهيئة'],
    ['دواء مغشوش', 'المستحضرات الصيدلانية والعشبية', 'near', 'ملاحظات تخص جودة المستحضرات']
  ]) {
    document.querySelector('#query').value = query;
    document.querySelector('#search').click();
    const group = document.querySelector('.case-group');
    expect(group?.classList.contains(expectedType), `نوع المطابقة للغش صحيح في قطاع ${sector}`);
    expect(group?.textContent.includes(sector) && group?.textContent.includes(expectedText), `يعرض بند الغش أو أقرب نص له في قطاع ${sector}`);
  }
  document.querySelector('#query').value = 'وجدت ادوية مخدرة فاسده في مستودع اغذية منتهي الصلاحية';
  document.querySelector('#search').click();
  const scopedExpiry = [...document.querySelectorAll('.case-group')];
  expect(scopedExpiry.length >= 2, 'يفصل الدواء الفاسد عن مستودع الغذاء ويضيف ترخيص تخزين الدواء');
  expect(scopedExpiry[0].classList.contains('near') && scopedExpiry[0].textContent.includes('المستحضرات الصيدلانية والعشبية') && scopedExpiry[0].textContent.includes('تالف'), 'يرشح أقرب بند للمستحضر الدوائي الفاسد كنص قريب في قطاع الدواء');
  expect(scopedExpiry[1].classList.contains('near') && scopedExpiry[1].textContent.includes('احتمال انتهاء ترخيص المنشأة') && scopedExpiry[1].textContent.includes('الغذاء'), 'يفهم انتهاء صلاحية مستودع الغذاء كاحتمال انتهاء ترخيص');
  expect(!scopedExpiry.some(g => g.textContent.includes('منتجات منتهية الصلاحية — الغذاء')), 'لا يحول المستودع نفسه إلى منتج غذائي منتهي الصلاحية');
  for (const [query, firstSector, facilitySector] of [
    ['منتج تجميلي فاسد في مستودع أعلاف منتهي الصلاحية', 'منتجات التجميل', 'الأعلاف'],
    ['جهاز طبي تالف في مستودع بيطري منتهي الصلاحية', 'الأجهزة والمستلزمات الطبية', 'المستحضرات البيطرية'],
    ['غذاء فاسد في مستودع أدوية منتهي الصلاحية', 'الغذاء', 'المستحضرات الصيدلانية والعشبية']
  ]) {
    document.querySelector('#query').value = query;
    document.querySelector('#search').click();
    const groups = [...document.querySelectorAll('.case-group')];
    expect(groups.length >= 2, `يفصل المنتج عن المنشأة مختلفة القطاع ويستنتج ترخيص التخزين: ${query}`);
    expect(groups[0].textContent.includes(firstSector), `يحفظ قطاع المنتج: ${firstSector}`);
    expect(groups[1].textContent.includes('احتمال انتهاء ترخيص المنشأة') && groups[1].textContent.includes(facilitySector), `يحفظ قطاع المنشأة: ${facilitySector}`);
  }
  document.querySelector('#query').value = 'مستودع غذاء غير مرخص لديه منتجات تجميل غير مدرجه';
  document.querySelector('#search').click();
  const contextualLicenses = [...document.querySelectorAll('.case-group')];
  expect(contextualLicenses.some(g => g.textContent.includes('ممارسة النشاط دون ترخيص') && g.textContent.includes('الغذاء')), 'يعرض مخالفة ترخيص مستودع الغذاء');
  expect(contextualLicenses.some(g => g.textContent.includes('غير مسجل أو غير مدرج') && g.textContent.includes('منتجات التجميل')), 'يعرض مخالفة إدراج منتج التجميل');
  const inferredCosmeticLicense = contextualLicenses.find(g => g.textContent.includes('ممارسة النشاط دون ترخيص') && g.textContent.includes('منتجات التجميل') && g.textContent.includes('استدلال سياقي'));
  expect(inferredCosmeticLicense?.textContent.includes('نطاق التطبيق: مستودع منتجات التجميل'), 'يستنتج ضرورة التحقق من ترخيص مستودع التجميل بنطاقه الصحيح');
  document.querySelector('#query').value = 'منتجات تجميلية غير مدرجة و اجهزة طبية منتهية الصلاحية في مستودع بيطري غير مرخص';
  document.querySelector('#search').click();
  const noManagerAssumption = [...document.querySelectorAll('.case-group')];
  expect(noManagerAssumption.some(g => g.textContent.includes('غير مسجل أو غير مدرج') && g.textContent.includes('منتجات التجميل')), 'يحفظ واقعة منتجات التجميل غير المدرجة');
  expect(noManagerAssumption.some(g => g.textContent.includes('منتهية الصلاحية') && g.textContent.includes('الأجهزة والمستلزمات الطبية')), 'يحفظ واقعة الأجهزة الطبية المنتهية');
  expect(noManagerAssumption.some(g => g.textContent.includes('ممارسة النشاط دون ترخيص') && g.textContent.includes('المستحضرات البيطرية')), 'يحفظ واقعة المستودع البيطري غير المرخص');
  expect(!noManagerAssumption.some(g => g.querySelector('h2')?.textContent.includes('التخزين') || g.textContent.includes('عدم تعيين صيدلي')), 'لا يستنتج مخالفة التخزين أو تعيين المدير من كلمة مستودع وحدها');
  for (const facility of ['غذاء','أعلاف','تجميل','أدوية','بيطري','أجهزة طبية']) {
    document.querySelector('#query').value = `مستودع ${facility} غير مرخص`;
    document.querySelector('#search').click();
    const groups = [...document.querySelectorAll('.case-group')];
    expect(groups.some(g => g.textContent.includes('ممارسة النشاط دون ترخيص')), `يستخرج الترخيص للقطاع: ${facility}`);
    expect(!groups.some(g => g.querySelector('h2')?.textContent.startsWith('التخزين')), `لا ينشئ مخالفة تخزين عامة للقطاع: ${facility}`);
  }
  document.querySelector('#query').value = 'مستودع بيطري لا يوجد لديه صيدلي أو طبيب بيطري مرخص مديراً للمستودع';
  document.querySelector('#search').click();
  expect(document.querySelector('.case-group')?.textContent.includes('مدير المستودع أو المسؤول الفني') && document.querySelector('#results').textContent.includes('عدم تعيين صيدلي'), 'يظهر بند المدير فقط عند ذكر واقعة صريحة تخص المدير المختص');
  document.querySelector('#query').value = 'سوء تخزين المستحضرات البيطرية وعدم عزل المنتجات التالفة';
  document.querySelector('#search').click();
  expect([...document.querySelectorAll('.case-group')].some(g => g.querySelector('h2')?.textContent.includes('التخزين')), 'تبقى مخالفة التخزين عند وجود وصف فعلي لسوء التخزين');
  for (const phrase of [
    'مستودع أعلاف لديه أجهزة طبية غير مسجلة',
    'مخزن أدوية يحتوي مستحضرات بيطرية محظورة',
    'مستودع تجميل يخزن أغذية منتهية الصلاحية'
  ]) {
    document.querySelector('#query').value = phrase;
    document.querySelector('#search').click();
    expect([...document.querySelectorAll('.case-group')].some(g => g.textContent.includes('استدلال سياقي') && g.textContent.includes('مستودع')), `يستنتج ترخيص التخزين عبر القطاعات: ${phrase}`);
  }
  document.querySelector('#query').value = 'وجدت كراسي مكسورة في غرفة الاستراحة';
  document.querySelector('#search').click();
  expect(document.querySelector('.case-group.none')?.textContent.includes('إنفاذ الأنظمة'), 'غياب النص المقارب يوصي بالتواصل مع إنفاذ الأنظمة');
  expect(document.querySelector('.case-group.none')?.textContent.includes('الإدارة القانونية'), 'غياب النص المقارب يوصي بالتواصل مع الإدارة القانونية');
  const normalizedExpiry = data.find(row => row.sector === 'المستحضرات الصيدلانية والعشبية' && row.code === '2/2/2');
  expect(normalizedExpiry?.description.includes('بمدة تزيد على سنة من تاريخ انتهاء المستحضر'), 'نص بند انتهاء الصلاحية مستورد بكلمات ومسافات سليمة');
  expect(!data.some(row => /علىسنة|سنةمن|تخزينمستحضر|المبارش\(اللحظي\)|العالمي\)NITG\(/.test(row.description)), 'لا توجد أنماط التصاق معروفة في النصوص المستوردة');
  const disposalText = data.find(row => row.id === 'pharma-1/3/1')?.description;
  expect(disposalText === 'إتلاف المستحضر دون وجود ما يثبت إتلافه عن طريق شركة متخصصة في التخلص الآمن من النفايات الطبية', 'نص إتلاف المستحضر مستورد عربيًا بصورة سليمة');
  console.log('All smoke tests passed.');
})().catch(error => { console.error(error); process.exit(1); });
