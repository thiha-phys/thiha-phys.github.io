(() => {
  const apiBase = window.PHYSICS_API_BASE_URL || 'https://uthk-physics-api.vercel.app';
  const token = localStorage.getItem('physicsLearningHubSession') || sessionStorage.getItem('physicsLearningHubSession') || '';
  const gradeTitles = {
    G10: ['Units and Measurements','Motion','Forces','Pressure','Work and Energy','Heat and Temperature','Wave and Sound','Light','Electricity','Magnetism','Quantum and Atomic Physics'],
    G11: ['Motion in a Plane','Rotational Dynamics','Pressure','Power and Efficiency','Heat and Thermal Phenomena','Vibration of Strings, Resonance and Vibration of Air Columns','Refraction of Light','Lenses','Electric Field','Electric Current and Magnetic Effect of Electric Current','Fundamentals of Electronics','Modern Physics'],
    G12: ['Rotational Motion','Forces in Circular Motion','Fluid Dynamics','Sources of Energy and Environmental Impacts','Heat Transfer and Thermodynamics','Effects and Characteristics of Sound','Applications of Light and Optical Instruments','Interference and Diffraction of Light','Capacitor and Capacitance','Electrical Energy, Power and Heating Effect of Electric Current','Electromagnetic Induction, Generation and Distribution of Electricity','Digital Electronics and Communication System','Modern Physics']
  };
  const body = document.body;
  const path = location.pathname.split('/').pop() || '';
  const grade = body.dataset.grade || path.match(/G(10|11|12)/)?.[0] || '';
  const category = body.dataset.contentType === 'questions' ? 'short_questions'
    : body.dataset.contentType === 'definitions' ? 'definitions'
    : path.match(/G\d+obj/i) ? 'objectives'
    : path.match(/G\d+cal/i) ? 'calculations'
    : path.match(/G\d+oq/i) ? 'old_questions' : '';
  const chapter = body.dataset.chapter || path.match(/G\d+(?:calCh|cal|objCh|def|sq|oqCh)(\d+)/)?.[1] || '';
  const status = document.createElement('p');
  status.className = 'educational-db-status';
  status.setAttribute('role','status');
  const mount = document.querySelector('.chapter-content-page, .problem-list-container, .chapter-list-container, #oq-paper-content, #oq-paper-nav, #oq-chapter-nav, #objective-quiz');
  const showError = (message) => {
    status.textContent = message || 'သင်ခန်းစာအချက်အလက်ကို ဖတ်မရပါ။ အင်တာနက်ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ပြန်ဖွင့်ပါ။';
    if (mount) { mount.replaceChildren(status); }
  };
  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = src; script.onload = resolve; script.onerror = reject; document.body.append(script);
  });
  const getRecords = async (selectedCategory = category, selectedChapter = chapter, filters = {}) => {
    const query = new URLSearchParams();
    if (grade) query.set('grade', grade.slice(1));
    if (selectedCategory) query.set('category', selectedCategory);
    if (selectedChapter) query.set('chapter', selectedChapter);
    if (filters.chapterPrefix) query.set('chapterPrefix', filters.chapterPrefix);
    if (filters.chapterNumeric) query.set('chapterNumeric', 'true');
    const response = await fetch(`${apiBase}/api/educational-content?${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(result.records)) throw new Error(result.message || 'သင်ခန်းစာအချက်အလက်ကို ဖတ်မရပါ။');
    return result.records;
  };
  const safeHtml = (html) => {
    const template = document.createElement('template'); template.innerHTML = String(html || '');
    template.content.querySelectorAll('script,style,iframe,object,embed,form,link,meta').forEach((node) => node.remove());
    template.content.querySelectorAll('*').forEach((node) => {
      [...node.attributes].forEach((attribute) => {
        const key = attribute.name.toLowerCase(), value = attribute.value.trim().toLowerCase();
        if (key.startsWith('on') || (['href','src','xlink:href'].includes(key) && value.startsWith('javascript:'))) node.removeAttribute(attribute.name);
      });
    });
    return template.content;
  };
  const groupChapterRecords = (records) => {
    const groups = new Map();
    records.forEach((record) => {
      const key = String(record.chapter);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    });
    return [...groups.entries()].sort((a,b) => {
      const aNumber = Number.parseInt(a[0],10), bNumber = Number.parseInt(b[0],10);
      if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return aNumber-bNumber;
      return a[0].localeCompare(b[0], undefined, { numeric:true, sensitivity:'base' });
    });
  };
  const renderChapterLinks = (records, type) => {
    const list = document.getElementById('chapter-content-list');
    if (!list) return;
    list.replaceChildren();
    groupChapterRecords(records).forEach(([number]) => {
      const index = Number(number)-1, link = document.createElement('a');
      link.href = `${grade}${type}${number}.html`;
      const badge = document.createElement('span'); badge.className = 'chapter-content-number'; badge.textContent = String(number).padStart(2,'0');
      const label = document.createElement('span'); label.textContent = gradeTitles[grade]?.[index] || `Chapter ${number}`;
      const icon = document.createElement('i'); icon.className = 'fa-solid fa-chevron-right'; icon.setAttribute('aria-hidden','true');
      link.append(badge,label,icon); list.append(link);
    });
  };
  const renderChapterContent = (records, type) => {
    const cards = document.getElementById('chapter-content-cards');
    if (!cards) return;
    const group = groupChapterRecords(records).find(([number]) => number === String(chapter));
    if (!group) throw new Error('ဤအခန်းအတွက် အချက်အလက် မရှိသေးပါ။');
    const title = gradeTitles[grade]?.[Number(chapter)-1] || `Chapter ${chapter}`;
    document.getElementById('chapter-content-label').textContent = `CHAPTER ${chapter}`;
    document.getElementById('chapter-content-title').textContent = title;
    document.title = `${grade} Chapter ${chapter} | Physics Learning Hub`;
    cards.replaceChildren();
    group[1].forEach((record) => {
      const item = record.content || {};
      const card = document.createElement('article'); card.className = 'chapter-content-card';
      if (type === 'definitions') {
        const heading = document.createElement('h3'); heading.textContent = item.term || item.title || record.title;
        const meaning = document.createElement('p'); meaning.textContent = item.definition || item.meaning || item.description || '';
        card.append(heading,meaning);
      } else {
        const question = document.createElement('h3'); question.textContent = item.question || item.q || record.title;
        card.append(question);
        const answer = item.answer ?? item.solution;
        if (answer != null) {
          const details = document.createElement('details'), summary = document.createElement('summary'), answerNode = document.createElement('div');
          summary.textContent = 'အဖြေကြည့်ရန်'; answerNode.className = 'chapter-content-answer'; answerNode.textContent = typeof answer === 'string' ? answer : JSON.stringify(answer);
          details.append(summary,answerNode); card.append(details);
        }
      }
      cards.append(card);
    });
  };
  const run = async () => {
    if (!category) return;
    if (category === 'old_questions' && /^G12oqSet\.html$/i.test(path)) {
      const paperRecords = await getRecords('old_questions', '', { chapterPrefix:'Set ' });
      const nav=document.getElementById('oq-paper-nav');
      const papers=paperRecords.filter((row)=>row.content?.paper || row.content?.html);
      if(nav){nav.replaceChildren();papers.forEach((row)=>{
        const paper=row.content.paper||{},link=document.createElement('a');link.className='oq-paper-link';
        link.href=paper.sample?'G12oq24Sq.html':`G12oq${String(paper.year).slice(-2)}Set${paper.set}.html`;
        link.textContent=row.title;nav.append(link);
      });}
      return;
    }
    if (category === 'old_questions' && /^G12oqCh(?:\d+)?\.html$/i.test(path)) {
      const chapterRecords = await getRecords('old_questions', '', { chapterNumeric:true });
      const chapters=groupChapterRecords(chapterRecords).filter(([key])=>/^\d+$/.test(key)).map(([key,items])=>({chapter:Number(key),...items[0].content}));
      window.G12_OLD_QUESTIONS=chapters;
      await loadScript('/page/G12oq.js');
      return;
    }
    if (category === 'old_questions' && body.dataset.paperKey) {
      const match = body.dataset.paperKey.match(/^(\d{4})-set(\d+)$/i);
      const sample = /sample|sq$/i.test(body.dataset.paperKey);
      if (!match && !sample) return;
      const key = sample ? 'Set 2024 · SQ' : `Set ${match[1]} · ${match[2]}`;
      const record = (await getRecords('old_questions',key))[0];
      const target = document.getElementById('oq-paper-content');
      if (!record || !target) throw new Error('မေးခွန်းလွှာကို မတွေ့ပါ။');
      if (record.content?.html) target.replaceChildren(safeHtml(record.content.html));
      else if (record.content?.paper) {
        window.G12_QUESTION_PAPERS = [record.content.paper];
        await loadScript('/page/G12oq.js');
      }
      return;
    }
    const records = await getRecords();
    if (category === 'definitions' || category === 'short_questions') {
      const type = category === 'short_questions' ? 'questions' : 'definitions';
      const names = groupChapterRecords(records);
      // Definition and short-question detail pages request one chapter at a time.
      // Keep records in their real chapter slot because chapter-content.js indexes by chapter-1.
      const chapters = Array.from({ length: gradeTitles[grade]?.length || 0 }, () => []);
      names.forEach(([number,items]) => {
        const index = Number(number) - 1;
        if (Number.isInteger(index) && index >= 0 && index < chapters.length) {
          chapters[index] = items.map((record) => record.content);
        }
      });
      const globalName = grade === 'G10' ? (type === 'questions' ? 'G10_SHORT_QUESTIONS' : 'G10_DEFINITIONS')
        : grade === 'G11' ? (type === 'questions' ? 'G11_SHORT_QUESTIONS' : 'G11_DEFINITION_CHAPTERS')
        : (type === 'questions' ? 'G12_SHORT_QUESTIONS' : 'G12_DEFINITIONS');
      window[globalName] = chapters;
      // G11 definitions still use their legacy renderer and page markup. Load
      // it only after the database response has populated its chapter data.
      if (grade === 'G11' && category === 'definitions') await loadScript('/page/G11def.js');
      else await loadScript('/page/chapter-content.js');
      return;
    }
    if (category === 'objectives') {
      const chapters = groupChapterRecords(records).map(([number,items]) => {
        const sections = new Map();
        items.forEach((row) => {
          const content = row.content || {}, section = content.section || 'trueFalse';
          if (!sections.has(section)) sections.set(section,[]);
          const question = { ...content }; delete question.section; sections.get(section).push(question);
        });
        return { chapter:Number(number), sections:[...sections.entries()].map(([type,questions]) => ({type,questions})) };
      });
      window.OBJECTIVE_QUIZ_DATA = { [grade]: chapters };
      await loadScript('/page/objective-quiz.js'); return;
    }
    if (category === 'calculations') {
      if (!chapter) {
        const list = document.querySelector('.chapter-list-container');
        list?.replaceChildren();
        groupChapterRecords(records).forEach(([number]) => {
          const card=document.createElement('a'); card.className='chapter-card'; card.href=`${grade}cal${grade==='G12'?'Ch':''}${number}.html`;
          const badge=document.createElement('div'); badge.className='chapter-num'; badge.textContent=String(number).padStart(2,'0');
          const info=document.createElement('div'); info.className='chapter-info'; const h=document.createElement('h3'); h.textContent=`Chapter ${number}`; const p=document.createElement('p'); p.textContent=gradeTitles[grade]?.[Number(number)-1]||''; info.append(h,p); card.append(badge,info); list?.append(card);
        }); return;
      }
      const list=document.querySelector('.problem-list-container'); if (!list) return;
      list.replaceChildren();
      records.forEach((record) => { if (record.content?.html) list.append(safeHtml(record.content.html)); });
      await loadScript('/page/calculation-format.js'); return;
    }
  };
  run().catch((error) => { console.error('Educational content could not be loaded from the database.',error); showError(error.message); });
})();
