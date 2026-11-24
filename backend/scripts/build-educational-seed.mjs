import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const pages = path.join(root, 'customer/page');
const sourcePages = path.join(root, 'import-source/educational');
const seedDirectory = path.join(root, 'backend/seeds');
const rows = [];
const gradeNumber = (value) => Number(String(value).replace(/\D/g, ''));

function readWindow(file) {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(sourcePages, file), 'utf8'), { window }, { timeout: 5000 });
  return window;
}
function chapterTitle(grade, category, chapter) {
  const names = {
    10:['Units and Measurements','Motion','Forces','Pressure','Work and Energy','Heat and Temperature','Wave and Sound','Light','Electricity','Magnetism','Quantum and Atomic Physics'],
    11:['Physical Quantities','Motion','Force','Work, Energy and Power','Circular Motion','Gravitation','Properties of Matter','Heat','Waves','Sound','Light','Electricity'],
    12:['Rotational Motion','Forces in Circular Motion','Fluid Dynamics','Sources of Energy and Environmental Impacts','Heat Transfer and Thermodynamics','Effects and Characteristics of Sound','Applications of Light and Optical Instruments','Interference and Diffraction of Light','Capacitor and Capacitance','Electrical Energy, Power and Heating Effect of electric Current','Electromagnetic Induction, Generation and Distribution of Electricity','Digital Electronics and Communication System','Modern Physics']
  };
  return names[grade]?.[chapter - 1] || `Chapter ${chapter}`;
}
function add(grade, category, chapter, title, content, sortOrder = 0) {
  rows.push({ grade, category, chapter: String(chapter), title: String(title || `Chapter ${chapter}`), content, sortOrder });
}
function addChapterData(grade, category, chapters, titleKey = 'title') {
  chapters.forEach((items, index) => {
    const chapter = index + 1;
    const list = Array.isArray(items) ? items : [items];
    list.forEach((entry, itemIndex) => {
      const title = entry?.[titleKey] || entry?.label || entry?.title || `${category.replaceAll('_',' ')} ${itemIndex + 1}`;
      add(grade, category, chapter, title, entry, itemIndex);
    });
  });
}
function extractCards(html) {
  return [...html.matchAll(/<article\b(?=[^>]*\bproblem-card\b)[^>]*>[\s\S]*?<\/article>/gi)].map((match) => match[0]);
}

// Objective quiz records are split into editable question rows while preserving section/type data.
const objectiveData = readWindow('objective-quiz-data.js').OBJECTIVE_QUIZ_DATA;
for (const [gradeKey, chapters] of Object.entries(objectiveData)) {
  const grade = gradeNumber(gradeKey);
  chapters.forEach((entry) => {
    const chapter = Number(entry.chapter);
    let order = 0;
    for (const section of entry.sections || []) {
      (section.questions || []).forEach((question) => {
        order += 1;
        add(grade, 'objectives', chapter, `${section.type} · ${question.number ?? order}`, { section: section.type, ...question }, order);
      });
    }
  });
}

// Definition and Grade 12 short question content already exists as structured JS data.
for (const [file, globalName, grade, category] of [
  ['G10def-data.js','G10_DEFINITIONS',10,'definitions'],
  ['G11def-data.js','G11_DEFINITION_CHAPTERS',11,'definitions'],
  ['G12def-data.js','G12_DEFINITIONS',12,'definitions'],
  ['G12sq-data.js','G12_SHORT_QUESTIONS',12,'short_questions'],
  ['G12oq-data.js','G12_OLD_QUESTIONS',12,'old_questions']
]) {
  const data = readWindow(file)[globalName];
  if (category === 'old_questions') {
    data.forEach((entry) => add(grade, category, entry.chapter, `Chapter ${entry.chapter}`, entry, 0));
  } else addChapterData(grade, category, data);
}

// Calculation chapters are imported as original, editable HTML question cards.
for (const grade of [10,11,12]) {
  const max = grade === 10 ? 11 : grade === 11 ? 12 : 13;
  for (let chapter = 1; chapter <= max; chapter += 1) {
    const candidates = grade === 12 ? [`G12calCh${chapter}.html`] : [`G${grade}cal${chapter}.html`];
    const file = candidates.find((name) => fs.existsSync(path.join(sourcePages, name)));
    if (!file) continue;
    const html = fs.readFileSync(path.join(sourcePages, file), 'utf8');
    extractCards(html).forEach((card, index) => {
      const label = card.match(/class="problem-number"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)?.[1]?.replace(/<[^>]+>/g,'').trim() || `Problem ${index + 1}`;
      add(grade, 'calculations', chapter, label, { html: card }, index + 1);
    });
  }
}

// Grade 12 old-question papers: 23 paper records, retaining original HTML layout.
const setData = readWindow('G12oqSet-data.js').G12_QUESTION_PAPERS;
const setFiles = fs.readdirSync(pages).filter((name) => /^G12oq(?:24|25|26)Set\d+\.html$/.test(name));
for (const file of setFiles) {
  const html = fs.readFileSync(path.join(pages, file), 'utf8');
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/&amp;/g,'&').trim() || file.replace('.html','');
  const match = file.match(/G12oq(\d{2})Set(\d+)/);
  const year = match ? Number(`20${match[1]}`) : 0;
  const setNo = match ? Number(match[2]) : 0;
  const source = setData.find((paper) => Number(paper.year) === year && Number(paper.set) === setNo);
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
  add(12, 'old_questions', `Set ${year} · ${setNo}`, title, { html: main, paper: source || null }, setNo);
}
const samplePaper = setData.find((paper) => paper.sample === true || /sample/i.test(String(paper.key || '')));
if (samplePaper) add(12, 'old_questions', 'Set 2024 · SQ', '2024 Sample Question', { html: '', paper: samplePaper }, 0);

for (const grade of [10, 11, 12]) {
  const seedPath = path.join(seedDirectory, `003_educational_content_g${grade}.sql`);
  const gradeRows = rows.filter((row) => row.grade === grade);
  const values = gradeRows.map((row) => {
    const chapter = String(row.chapter).replaceAll("'", "''");
    const title = row.title.replaceAll("'", "''");
    const content = JSON.stringify(row.content).replaceAll("'", "''");
    return `(${row.grade},'${row.category}','${title}','${chapter}','${content}'::jsonb,${row.sortOrder},true)`;
  });
  const insertStatements = [];
  for (let index=0; index<values.length; index+=25) {
    insertStatements.push(`INSERT INTO educational_content (grade,category,title,chapter,content,sort_order,active) VALUES\n${values.slice(index,index+25).join(',\n')};`);
  }
  const sqlText = insertStatements.join('\n');
  fs.writeFileSync(seedPath, `-- Generated from the existing customer educational source files.\n-- Run migration 005 before this seed.\n-- One-time import: do not rerun after editing these records in the admin app.\nBEGIN;\n${sqlText}\nCOMMIT;\n`);
  console.log(`Wrote ${gradeRows.length} Grade ${grade} rows to ${path.relative(root, seedPath)}.`);
}
console.log(`Total: ${rows.length} rows (${setFiles.length} old-question paper files found).`);
