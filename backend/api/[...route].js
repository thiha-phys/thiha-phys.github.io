import { neon } from '@neondatabase/serverless';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { normalizeCarInfo, royalShipmentCharges } from '../lib/order-delivery.js';

const scrypt = promisify(scryptCallback);
const MAX_DISCUSSION_MESSAGE_LENGTH = 4000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sql = () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  return neon(process.env.DATABASE_URL);
};
const allowedOrigins = (process.env.APP_ORIGINS || 'https://customer-three-kappa.vercel.app,https://admin-zeta-plum-21.vercel.app')
  .split(',').map((value) => value.trim()).filter(Boolean);

function send(res, status, data) {
  res.status(status).json(data);
}
function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}
function normalizePhone(value) {
  return String(value || '').replace(/[၀-၉]/g, (digit) => String(digit.charCodeAt(0) - '၀'.charCodeAt(0))).replace(/\D/g, '');
}
const adminEmails = [...new Set([
  'thihakyawphys73@gmail.com',
  'thihakyaw1sth66@gmail.com',
  ...(process.env.ADMIN_EMAILS || '').split(',').map(normalizeEmail).filter(Boolean)
])];
function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}
function safeUser(row) {
  return { id: row.id, name: row.name, occupation: row.occupation, job: row.occupation, email: row.email, phone: row.phone, role: row.role, approvalStatus: row.approval_status || 'approved' };
}
function cleanEducationalContent(value) {
  if (typeof value === 'string') {
    return value
      .replace(/<\s*(script|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s+(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '')
      .replace(/javascript\s*:/gi, '');
  }
  if (Array.isArray(value)) return value.map(cleanEducationalContent);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cleanEducationalContent(item)]));
  return value;
}
async function notifyTelegram(order) {
  const token=process.env.TELEGRAM_BOT_TOKEN,chatId=process.env.TELEGRAM_CHAT_ID;
  if(!token||!chatId)return false;
  const itemRows=order.items||[];
  const quantity=itemRows.reduce((sum,item)=>sum+Number(item.quantity||0),0);
  const timeParts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Yangon',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(order.orderDate||Date.now()));
  const timePart=(type)=>timeParts.find(part=>part.type===type)?.value||'';
  const orderTime=`${timePart('day')}.${timePart('month')}.${timePart('year')} ${timePart('hour')}:${timePart('minute')}:${timePart('second')}`;
  const lines=[
    '📚 NEW BOOK ORDER',
    '',
    String(order.voucherNo||''),
    String(order.name||''),
    String(order.phone||''),
    `${String(order.address||order.city||'')}${order.carInfo?`, ${String(order.carInfo)}`:''}`,
    '',
    ...itemRows.map(item=>`- ${String(item.name||'')} x ${Number(item.quantity||0)} = ${Number(item.amount||0)}`),
    '',
    `Quantity: ${quantity}`,
    '',
    `Total: ${Number(order.total||0)}`,
    `Delivery Fee: ${Number(order.deliveryFees||0)}`,
    `Payment Method: ${String(order.paymentMethod||'')}`,
    orderTime
  ];
  try{const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text:lines.join('\n')}),signal:AbortSignal.timeout(8000)});if(!response.ok)console.error('Telegram order notification failed with HTTP status',response.status);return response.ok;}catch(error){console.error('Telegram order notification failed.',error);return false;}
}
function royalPhoneCandidates(value) {
  const text=String(value||'').replace(/[၀-၉]/g,(digit)=>String(digit.charCodeAt(0)-'၀'.charCodeAt(0)));
  const matches=text.match(/(?:\+?95[\s().-]*)?0?9(?:[\s().-]*\d){7,10}/g)||[];
  return [...new Set(matches.map((match)=>{let digits=match.replace(/\D/g,'');if(digits.startsWith('95'))digits=`0${digits.slice(2)}`;else if(digits.startsWith('9'))digits=`0${digits}`;return digits;}).filter(Boolean))];
}
function paymentNoticeDate(value) {
  const text=String(value||'').trim();
  const iso=text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dayFirst=text.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/);
  const year=iso?.[1]||dayFirst?.[3];
  const month=iso?.[2]||dayFirst?.[2];
  const day=iso?.[3]||dayFirst?.[1];
  if(!year||!month||!day)return text;
  const date=new Date(Date.UTC(Number(year),Number(month)-1,Number(day)));
  if(date.getUTCFullYear()!==Number(year)||date.getUTCMonth()!==Number(month)-1||date.getUTCDate()!==Number(day))return text;
  return `${String(day).padStart(2,'0')} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(month)-1]} ${year}`;
}
function yangonDateOnly(value=new Date()) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Yangon',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);
  const part=(type)=>parts.find((entry)=>entry.type===type)?.value||'';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function dateOnlyInYangon(value) {
  const text=String(value||'').trim();
  const dateOnly=text.match(/^(\d{4}-\d{2}-\d{2})$/);
  if(dateOnly)return dateOnly[1];
  const parsed=new Date(text);
  return Number.isNaN(parsed.getTime())?text:yangonDateOnly(parsed);
}
function receivedBooksOnly(value, subtotal, deliveryFee) {
  const received=Number(String(value??'0').replaceAll(',',''));
  if(!Number.isSafeInteger(received)||received<0)return 0;
  return deliveryFee>0&&received===subtotal+deliveryFee?subtotal:received;
}
async function createSession(db, user) {
  const token = randomBytes(32).toString('base64url');
  await db`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (${user.id}, ${tokenHash(token)}, now() + interval '30 days')`;
  return token;
}
async function getUser(req, db) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const rows = await db`SELECT u.id, u.name, u.occupation, u.email, u.phone, u.role, u.approval_status
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=${tokenHash(token)} AND s.expires_at > now()`;
  return rows[0] || null;
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
function discussionMessageText(value) {
  return typeof value === 'string' ? value.trim() : '';
}
function validDiscussionMessageText(value) {
  const length = Array.from(value).length;
  return length > 0 && length <= MAX_DISCUSSION_MESSAGE_LENGTH;
}
function mapDiscussionMessage(row) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    senderRole: String(row.sender_role),
    body: String(row.body),
    createdAt: row.created_at,
    editedAt: row.edited_at
  };
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const db = sql();
    const queryRoute = req.query.route;
    const routeParts = Array.isArray(queryRoute)
      ? queryRoute
      : queryRoute
        ? String(queryRoute).split('/')
        : String(req.url || '').split('?')[0].split('/');
    const routeSegments = routeParts.map((part)=>String(part)).filter(Boolean);
    if (routeSegments[0] === 'api') routeSegments.shift();
    const route = '/' + routeSegments.join('/');
    if (route === '/health' && req.method === 'GET') {
      return send(res, 200, {
        ok: true,
        features: {
          passwordChange: true,
          passwordReset: true,
          discussionMessaging: true,
          conversationMessageDeletion: true
        }
      });
    }

    if (route === '/auth/signup' && req.method === 'POST') {
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      const name = String(body.name || '').trim();
      const phone = normalizePhone(body.phone);
      const occupation = String(body.occupation || body.job || '').trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { ok:false, code:'INVALID_EMAIL', message:'မှန်ကန်သော email လိပ်စာထည့်ပါ။' });
      if (!/(?=.*[A-Za-z])(?=.*\d).{8,}/.test(password)) return send(res, 400, { ok:false, code:'WEAK_PASSWORD', message:'စကားဝှက်တွင် အင်္ဂလိပ်စာလုံးနှင့် ဂဏန်းပါပြီး အနည်းဆုံး ၈ လုံးရှိရပါမည်။' });
      if (!name || !/^0\d{10}$/.test(phone)) return send(res, 400, { ok:false, code:'MISSING_PROFILE', message:'အမည်နှင့် ၀ ဖြင့်စသော ၁၁ လုံးရှိသည့် ဖုန်းနံပါတ် ဖြည့်ပါ။' });
      const salt = randomBytes(16).toString('hex');
      const hash = Buffer.from(await scrypt(password, salt, 64)).toString('hex');
      const inserted = await db`INSERT INTO users (name, occupation, email, phone, password_hash, password_salt,approval_status)
        VALUES (${name}, ${occupation}, ${email || null}, ${phone}, ${hash}, ${salt},'pending')
        ON CONFLICT DO NOTHING RETURNING id, name, occupation, email, phone, role,approval_status`;
      if (!inserted.length) {
        const existing = await db`SELECT email,phone FROM users WHERE (email IS NOT NULL AND lower(email)=lower(${email || null})) OR phone=${phone} LIMIT 1`;
        return send(res, 409, { ok:false, code:existing.some((row)=>row.phone===phone)?'PHONE_EXISTS':'EMAIL_EXISTS', message:existing.some((row)=>row.phone===phone)?'ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးသားဖြစ်သည်။':'ဤ email ဖြင့် အကောင့်ရှိပြီးသားဖြစ်သည်။' });
      }
      const token = await createSession(db, inserted[0]);
      return send(res, 201, { ok:true, user:safeUser(inserted[0]), token });
    }

    if (route === '/auth/login' && req.method === 'POST') {
      const body = await readBody(req);
      const identifier = String(body.identifier || body.email || body.phone || '').trim();
      const phoneIdentifier = normalizePhone(identifier);
      const rows = await db`SELECT id, name, occupation, email, phone, role, approval_status,password_hash, password_salt
        FROM users WHERE (email IS NOT NULL AND lower(email)=lower(${identifier})) OR (phone=${phoneIdentifier} AND ${/^\d+$/.test(phoneIdentifier)}) LIMIT 1`;
      const user = rows[0];
      const supplied = Buffer.from(await scrypt(String(body.password || ''), user?.password_salt || 'invalid-salt', 64));
      const expected = Buffer.from(user?.password_hash || '0'.repeat(128), 'hex');
      if (!user || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return send(res, 401, { ok:false, code:'INVALID_CREDENTIALS', message:'Email သို့မဟုတ် စကားဝှက် မမှန်ပါ။' });
      const token = await createSession(db, user);
      return send(res, 200, { ok:true, user:safeUser(user), token });
    }

    if (route === '/auth/password-reset-requests' && req.method === 'POST') {
      const body = await readBody(req);
      const phone = normalizePhone(body.phone);
      if (/^0\d{10}$/.test(phone)) {
        const users = await db`SELECT id FROM users WHERE phone=${phone} AND approval_status='approved' LIMIT 1`;
        if (users.length) {
          await db`UPDATE password_reset_requests SET status='expired',token_hash=NULL
            WHERE user_id=${users[0].id} AND status='approved' AND token_expires_at<=now()`;
          await db`INSERT INTO password_reset_requests(user_id)
            VALUES (${users[0].id}) ON CONFLICT DO NOTHING`;
        }
      }
      return send(res, 200, {
        ok: true,
        message: 'တောင်းဆိုချက်ရှိပါက Admin မှ စစ်ဆေးပြီး မှတ်ပုံတင်ထားသော ဖုန်းနံပါတ်သို့ ဆက်သွယ်ပေးပါမည်။'
      });
    }

    if (route === '/auth/password-reset' && req.method === 'POST') {
      const body = await readBody(req);
      const phone = normalizePhone(body.phone);
      const code = String(body.code || '').trim().toUpperCase().replace(/\s/g, '');
      const password = String(body.password || '');
      if (!/^0\d{10}$/.test(phone) || !/^[A-F0-9]{16}$/.test(code)) {
        return send(res, 400, {ok:false,code:'RESET_CODE_INVALID',message:'Code သို့မဟုတ် ဖုန်းနံပါတ် မမှန်ပါ၊ သက်တမ်းကုန်သွားပါပြီ။'});
      }
      if (!/(?=.*[A-Za-z])(?=.*\d).{8,}/.test(password)) {
        return send(res, 400, {ok:false,code:'WEAK_PASSWORD',message:'စကားဝှက်တွင် အင်္ဂလိပ်စာလုံးနှင့် ဂဏန်းပါပြီး အနည်းဆုံး ၈ လုံးရှိရပါမည်။'});
      }
      const users = await db`SELECT id FROM users WHERE phone=${phone} AND approval_status='approved' LIMIT 1`;
      if (!users.length) return send(res, 400, {ok:false,code:'RESET_CODE_INVALID',message:'Code သို့မဟုတ် ဖုန်းနံပါတ် မမှန်ပါ၊ သက်တမ်းကုန်သွားပါပြီ။'});

      const salt = randomBytes(16).toString('hex');
      const passwordHash = Buffer.from(await scrypt(password, salt, 64)).toString('hex');
      const completed = await db`WITH matched AS (
          UPDATE password_reset_requests
          SET status='completed',token_hash=NULL,token_expires_at=NULL,completed_at=now()
          WHERE user_id=${users[0].id} AND status='approved' AND token_expires_at>now()
            AND failed_attempts<5 AND token_hash=${tokenHash(code)}
          RETURNING user_id
        ), updated AS (
          UPDATE users SET password_hash=${passwordHash},password_salt=${salt},updated_at=now()
          FROM matched WHERE users.id=matched.user_id
          RETURNING users.id
        ), revoked_sessions AS (
          DELETE FROM sessions USING updated WHERE sessions.user_id=updated.id
          RETURNING sessions.id
        )
        SELECT id FROM updated`;
      if (!completed.length) {
        await db`UPDATE password_reset_requests
          SET failed_attempts=failed_attempts+1,
              status=CASE WHEN failed_attempts+1>=5 THEN 'expired' ELSE status END,
              token_hash=CASE WHEN failed_attempts+1>=5 THEN NULL ELSE token_hash END,
              token_expires_at=CASE WHEN failed_attempts+1>=5 THEN NULL ELSE token_expires_at END
          WHERE user_id=${users[0].id} AND status='approved' AND token_expires_at>now() AND failed_attempts<5`;
        return send(res, 400, {ok:false,code:'RESET_CODE_INVALID',message:'Code သို့မဟုတ် ဖုန်းနံပါတ် မမှန်ပါ၊ သက်တမ်းကုန်သွားပါပြီ။'});
      }
      return send(res, 200, {ok:true,message:'စကားဝှက်အသစ် သတ်မှတ်ပြီးပါပြီ။ ပြန်လည်ဝင်ရောက်ပါ။'});
    }

    if (route === '/auth/logout' && req.method === 'POST') {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (token) await db`DELETE FROM sessions WHERE token_hash=${tokenHash(token)}`;
      return send(res, 200, { ok:true });
    }

    if (route === '/public/master-data' && req.method === 'GET') {
      const [settings, books, cities] = await Promise.all([
        db`SELECT key, value FROM app_settings`,
        db`SELECT id, name, weight, prices, quantity_header AS "quantityHeader", amount_header AS "amountHeader", image, active FROM books ORDER BY sort_order, id`,
        db`SELECT id, english, myanmar, label, up_to_2kg AS "upTo2Kg", next_kg AS "nextKg" FROM delivery_cities WHERE active=true ORDER BY sort_order, english`
      ]);
      const values = Object.fromEntries(settings.map((row) => [row.key, row.value]));
      return send(res, 200, { ok:true, masterData:{ schemaVersion:1, settings:{ priceThresholds:values.priceThresholds || [0,10,30,50,100], royalServiceFee:Number(values.royalServiceFee ?? 300), codMaxTotal:Number(values.codMaxTotal ?? 150000) }, books:Object.fromEntries(books.map((book) => [book.id, book])), deliveryCities:Object.fromEntries(cities.map((city) => [city.id, city])) } });
    }
    if (route === '/public/bookstores' && req.method === 'GET') {
      const rows=await db`SELECT id,city,name,address,phones FROM bookstores WHERE active=true ORDER BY sort_order,name`;
      return send(res,200,{ok:true,bookstores:rows});
    }
    if (route === '/public/announcements' && req.method === 'GET') {
      const rows=await db`SELECT id,title,body,publish_at FROM announcements WHERE active=true AND publish_at<=now() ORDER BY publish_at DESC LIMIT 3`;
      return send(res,200,{ok:true,announcements:rows});
    }

    if (route === '/educational-content' && req.method === 'GET') {
      const user = await getUser(req, db);
      if (!user) return send(res,401,{ok:false,code:'AUTH_REQUIRED',message:'အကောင့်ဝင်ရန်လိုအပ်ပါသည်။'});
      if (user.role !== 'admin' && user.approval_status !== 'approved') return send(res,403,{ok:false,code:'ACCOUNT_PENDING',message:'အကောင့်အသုံးပြုခွင့်အတွက် admin အတည်ပြုချက်ကို စောင့်ဆိုင်းနေပါသည်။'});
      const grade = Number(req.query.grade || 0);
      const category = String(req.query.category || '');
      const chapter = String(req.query.chapter || '');
      const chapterPrefix = String(req.query.chapterPrefix || '');
      const chapterNumeric = req.query.chapterNumeric === 'true';
      const rows = await db`SELECT id,grade,category,title,chapter,content,sort_order AS "sortOrder",updated_at AS "updatedAt"
        FROM educational_content WHERE active=true AND (${grade===0} OR grade=${grade}) AND (${category==='' } OR category=${category}) AND (${chapter==='' } OR chapter=${chapter})
          AND (${chapterPrefix==='' } OR chapter LIKE ${`${chapterPrefix}%`}) AND (${!chapterNumeric} OR chapter ~ '^[0-9]+$')
        ORDER BY grade,category,chapter,sort_order,title`;
      return send(res,200,{ok:true,records:rows});
    }

    if (route === '/orders' && req.method === 'POST') {
      const user = await getUser(req, db);
      if (!user && req.headers.authorization) return send(res, 401, {ok:false,code:'SESSION_INVALID',message:'အကောင့်ဝင်ချိန်ကုန်ဆုံးသွားပါပြီ။ ပြန်လည်ဝင်ပြီး မှာယူပါ။'});
      if(user && user.role!=='admin'&&user.approval_status!=='approved') return send(res,403,{ok:false,code:user.approval_status==='rejected'?'ACCOUNT_REJECTED':'ACCOUNT_PENDING',message:'အကောင့်အသုံးပြုခွင့်အတွက် admin အတည်ပြုချက်ကို စောင့်ဆိုင်းနေပါသည်။'});
      const body = await readBody(req);
      const order = body.order || {};
      const cityRows = await db`SELECT * FROM delivery_cities WHERE lower(english)=lower(${String(order.deliveryCity || '')}) AND active=true LIMIT 1`;
      if (!cityRows.length) return send(res, 400, { ok:false, code:'INVALID_CITY', message:'ပို့ဆောင်မည့်မြို့ကို စာရင်းထဲမှ ရွေးချယ်ပါ။' });
      const city = cityRows[0];
      const settingsRows = await db`SELECT key,value FROM app_settings`;
      const settings = Object.fromEntries(settingsRows.map((row) => [row.key,row.value]));
      const thresholds = settings.priceThresholds || [0,10,30,50,100];
      const requested = Array.isArray(order.items) ? order.items : [];
      const ids = requested.filter((item) => Number.isSafeInteger(Number(item.quantity)) && Number(item.quantity)>0);
      if (!ids.length) return send(res, 400, { ok:false, code:'EMPTY_ORDER', message:'စာအုပ်အရေအတွက်ရွေးပါ။' });
      const service=String(order.deliveryService || '');
      const payment=String(order.paymentMethod || '');
      if(!['Royal','Car'].includes(service) || !['COD','KBZ Pay'].includes(payment)) return send(res,400,{ok:false,code:'INVALID_DELIVERY_OR_PAYMENT',message:'ပို့ဆောင်ရေး သို့မဟုတ် ငွေပေးချေမှု ရွေးချယ်မှု မမှန်ပါ။'});
      if(service==='Car' && payment!=='KBZ Pay') return send(res,400,{ok:false,code:'CAR_REQUIRES_KBZ',message:'ကားတင်ရန်အတွက် KBZ Pay ကိုသာ ရွေးနိုင်ပါသည်။'});
      const carInfo=service==='Car'?normalizeCarInfo(order):'';
      if(service==='Car'&&!carInfo) return send(res,400,{ok:false,code:'CAR_DETAILS_REQUIRED',message:'ကားဂိတ်နှင့် ကားအမည်ကို ဖြည့်ပါ။'});
      if(ids.some((item)=>Number(item.quantity)>10000)) return send(res,400,{ok:false,code:'QUANTITY_LIMIT',message:'စာအုပ်အရေအတွက် များလွန်းနေပါသည်။'});
      const preparedItems=[];
      let subtotal=0, actualWeight=0;
      for (const item of ids) {
        const bookRows=await db`SELECT id,name,weight,prices FROM books WHERE id=${String(item.id)} AND active=true LIMIT 1`;
        if(!bookRows.length) return send(res,400,{ok:false,code:'INVALID_BOOK',message:'စာအုပ်စာရင်းထဲ မရှိတော့သောစာအုပ် ပါဝင်နေပါသည်။'});
        const book=bookRows[0],quantity=Number(item.quantity);
        const tier=thresholds.reduce((selected,threshold,index)=>quantity>=Number(threshold)?index:selected,0);
        const unitPrice=Number(book.prices[tier] ?? book.prices[0]);
        const amount=quantity*unitPrice;
        subtotal+=amount;actualWeight+=quantity*Number(book.weight);
        preparedItems.push({book,quantity,unitPrice,amount});
      }
      const units=Math.round(actualWeight*100000),wholeKg=Math.floor(units/100000),fraction=units-wholeKg*100000;
      const kg=actualWeight<=0?0:(fraction<60000?wholeKg+0.5:wholeKg+1);
      const serviceFee=Number(settings.royalServiceFee ?? 300);
      const packages=Math.max(1,Math.ceil(kg/5-0.000000001));
      const lastPackageWeight=kg-5*(packages-1);
      const extraKg=Math.ceil(Math.max(0,lastPackageWeight-2)-0.000000001);
      const {serviceCharge:royalShipmentServiceCharge}=royalShipmentCharges(service,kg,0,serviceFee);
      const baseFee=service==='Royal'?(packages-1)*(Number(city.up_to_2kg)+3*Number(city.next_kg))+Number(city.up_to_2kg)+extraKg*Number(city.next_kg)+royalShipmentServiceCharge:0;
      const deliveryFee=service==='Royal'?Math.ceil(baseFee/500-0.000000001)*500:0;
      const total=subtotal+deliveryFee;
      const {codCharge:royalShipmentCodAmount}=royalShipmentCharges(service,kg,deliveryFee,serviceFee);
      const royalShipmentWeight=service==='Royal'?kg:0;
      if(payment==='COD' && total>=Number(settings.codMaxTotal ?? 150000)) return send(res,400,{ok:false,code:'COD_LIMIT',message:'စုစုပေါင်းပမာဏအတွက် KBZ Pay ကိုသာ ရွေးချယ်နိုင်ပါသည်။'});
      const customerName=String(order.name||user?.name||'').trim(), customerPhone=String(order.phone||user?.phone||'').trim();
      if(!String(order.address||'').trim() || !customerName || !customerPhone) return send(res,400,{ok:false,code:'MISSING_ORDER_DETAILS',message:'အမည်၊ ဖုန်းနှင့် လိပ်စာ ဖြည့်ပါ။'});
      const created = await db`WITH next_number AS (SELECT nextval('orders_order_no_seq') AS order_no)
        INSERT INTO orders (order_no,voucher_no,user_id,customer_name,phone,phone2,city_id,address,delivery_service,payment_method,car_details,status)
        SELECT order_no,lpad(order_no::text,3,'0'),${user?.id || null},${customerName},${customerPhone},${String(order.phone2 || '').trim()},${city.id},${String(order.address || '').trim()},${service},${payment},${carInfo},'pending' FROM next_number
        RETURNING id, voucher_no,order_no`;
      for(const item of preparedItems) await db`INSERT INTO order_items(order_id,book_id,book_name,quantity,unit_price,amount,weight_kg) VALUES (${created[0].id},${item.book.id},${item.book.name},${item.quantity},${item.unitPrice},${item.amount},${Number(item.book.weight)})`;
      const royalOrderData={
        'car inform':carInfo,
        'Royal Shipment Service Charge':String(royalShipmentServiceCharge),
        'Royal Shipment COD Amount':String(royalShipmentCodAmount),
        'Royal Shipment Weight':service==='Royal'?String(royalShipmentWeight):''
      };
      await db`UPDATE orders SET subtotal=${subtotal},delivery_fee=${deliveryFee},total=${total},total_weight_kg=${kg},cash_collection=${payment==='COD'?total:0},admin_data=${JSON.stringify(royalOrderData)}::jsonb WHERE id=${created[0].id}`;
      const resultOrder={voucherNo:created[0].voucher_no,name:customerName,phone:customerPhone,phone2:String(order.phone2 || ''),city:city.label,address:`${city.label}, ${String(order.address || '').trim()}`,orderDate:new Date().toISOString(),paymentMethod:payment,total:subtotal,deliveryService:service,deliveryFees:deliveryFee,payableTotal:total,totalKg:kg,cashCollection:payment==='COD'?total:0,'Royal Shipment Service Charge':royalOrderData['Royal Shipment Service Charge'],'Royal Shipment COD Amount':royalOrderData['Royal Shipment COD Amount'],'Royal Shipment Weight':royalOrderData['Royal Shipment Weight'],'car inform':carInfo,carDetails:carInfo,carInfo,items:preparedItems.map((item)=>({id:item.book.id,name:item.book.name,quantity:item.quantity,unitPrice:item.unitPrice,amount:item.amount}))};
      const telegramNotified=await notifyTelegram(resultOrder);
      return send(res, 201, { ok:true, orderId:created[0].voucher_no, order:resultOrder,telegramNotified });
    }

    const user = await getUser(req, db);
    if (!user) return send(res, 401, {ok:false,code:'AUTH_REQUIRED',message:'အကောင့်ဝင်ရန်လိုအပ်ပါသည်။'});
    if (route === '/auth/me' && req.method === 'GET') return send(res,200,{ok:true,user:safeUser(user)});
    if(user.role!=='admin' && user.approval_status!=='approved' && route!=='/auth/logout' && !(route==='/profile'&&req.method==='DELETE')) return send(res,403,{ok:false,code:user.approval_status==='rejected'?'ACCOUNT_REJECTED':'ACCOUNT_PENDING',message:user.approval_status==='rejected'?'သင့်အကောင့်ကို အတည်မပြုနိုင်ပါ။':'အကောင့်အသုံးပြုခွင့်အတွက် admin အတည်ပြုချက်ကို စောင့်ဆိုင်းနေပါသည်။'});
    if (route.startsWith('/admin/') && user.role !== 'admin') return send(res,403,{ok:false,code:'ADMIN_REQUIRED',message:'ဤလုပ်ဆောင်ချက်ကို admin သာ အသုံးပြုနိုင်ပါသည်။'});
    if (route === '/profile' && req.method === 'DELETE') {
      const body = await readBody(req);
      const credentials = await db`SELECT password_hash,password_salt FROM users WHERE id=${user.id} LIMIT 1`;
      const supplied = Buffer.from(await scrypt(String(body.currentPassword || ''), credentials[0]?.password_salt || 'invalid-salt', 64));
      const saved = Buffer.from(credentials[0]?.password_hash || '0'.repeat(128), 'hex');
      if (!credentials.length || saved.length !== supplied.length || !timingSafeEqual(saved, supplied)) {
        return send(res,401,{ok:false,code:'CURRENT_PASSWORD_INVALID',message:'လက်ရှိစကားဝှက် မမှန်ပါ။'});
      }
      if (user.role === 'admin') {
        const admins = await db`SELECT email FROM users WHERE role='admin'`;
        const activeAdminCount = admins.filter((row)=>adminEmails.includes(normalizeEmail(row.email))).length;
        if (activeAdminCount <= 1) return send(res,409,{ok:false,code:'LAST_ADMIN',message:'နောက်ဆုံး admin အကောင့်ကို ဖျက်၍မရပါ။'});
      }
      const deleted = await db`DELETE FROM users WHERE id=${user.id} RETURNING id`;
      if (!deleted.length) return send(res,404,{ok:false,code:'USER_NOT_FOUND',message:'အသုံးပြုသူကို မတွေ့ပါ။'});
      return send(res,200,{ok:true});
    }
    if (route === '/discussion/messages' && req.method === 'GET') {
      const rows = await db`SELECT id,user_id,sender_role,body,created_at,edited_at
        FROM discussion_messages WHERE user_id=${user.id} ORDER BY created_at,id`;
      return send(res,200,{ok:true,messages:rows.map(mapDiscussionMessage)});
    }
    if (route === '/discussion/messages' && req.method === 'POST') {
      const body = await readBody(req);
      const message = discussionMessageText(body.body);
      if (!validDiscussionMessageText(message)) {
        return send(res,400,{ok:false,code:'INVALID_MESSAGE',message:'စာသားသည် ဗလာမဖြစ်ရ၊ စာလုံးရေ ၄,၀၀၀ ထက် မကျော်ရပါ။'});
      }
      const rows = await db`INSERT INTO discussion_messages(user_id,sender_id,sender_role,body)
        VALUES (${user.id},${user.id},'customer',${message})
        RETURNING id,user_id,sender_role,body,created_at,edited_at`;
      return send(res,201,{ok:true,message:mapDiscussionMessage(rows[0])});
    }
    const customerMessageMatch = route.match(/^\/discussion\/messages\/([^/]+)$/);
    if (customerMessageMatch && req.method === 'PATCH') {
      const messageId = customerMessageMatch[1];
      if (!UUID_PATTERN.test(messageId)) return send(res,404,{ok:false,code:'MESSAGE_NOT_FOUND',message:'စာကို မတွေ့ပါ။'});
      const body = await readBody(req);
      const message = discussionMessageText(body.body);
      if (!validDiscussionMessageText(message)) {
        return send(res,400,{ok:false,code:'INVALID_MESSAGE',message:'စာသားသည် ဗလာမဖြစ်ရ၊ စာလုံးရေ ၄,၀၀၀ ထက် မကျော်ရပါ။'});
      }
      const rows = await db`UPDATE discussion_messages SET body=${message},edited_at=now()
        WHERE id=${messageId} AND user_id=${user.id} AND sender_id=${user.id} AND sender_role='customer'
        RETURNING id,user_id,sender_role,body,created_at,edited_at`;
      if (!rows.length) return send(res,404,{ok:false,code:'MESSAGE_NOT_FOUND',message:'ပြင်ဆင်နိုင်သော ကိုယ်ပိုင်စာကို မတွေ့ပါ။'});
      return send(res,200,{ok:true,message:mapDiscussionMessage(rows[0])});
    }
    if (route === '/admin/discussion/messages' && req.method === 'GET') {
      const rows = await db`SELECT m.id,m.user_id,m.sender_role,m.body,m.created_at,m.edited_at,
          u.name,u.phone,u.occupation
        FROM discussion_messages m JOIN users u ON u.id=m.user_id
        ORDER BY m.created_at,m.id`;
      return send(res,200,{ok:true,messages:rows.map((row)=>({
        ...mapDiscussionMessage(row),
        name:row.name,
        phone:row.phone,
        job:row.occupation
      }))});
    }
    if (route === '/admin/discussion/messages' && req.method === 'POST') {
      const body = await readBody(req);
      const userId = String(body.userId || '').trim();
      const message = discussionMessageText(body.body);
      if (!UUID_PATTERN.test(userId)) return send(res,400,{ok:false,code:'INVALID_ACCOUNT',message:'အသုံးပြုသူအကောင့် မမှန်ပါ။'});
      if (!validDiscussionMessageText(message)) {
        return send(res,400,{ok:false,code:'INVALID_MESSAGE',message:'စာသားသည် ဗလာမဖြစ်ရ၊ စာလုံးရေ ၄,၀၀၀ ထက် မကျော်ရပါ။'});
      }
      const recipient = await db`SELECT id FROM users
        WHERE id=${userId} AND role<>'admin' AND approval_status='approved' LIMIT 1`;
      if (!recipient.length) return send(res,404,{ok:false,code:'ACCOUNT_NOT_FOUND',message:'အသုံးပြုသူအကောင့်ကို မတွေ့ပါ။'});
      const rows = await db`INSERT INTO discussion_messages(user_id,sender_id,sender_role,body)
        VALUES (${recipient[0].id},${user.id},'admin',${message})
        RETURNING id,user_id,sender_role,body,created_at,edited_at`;
      return send(res,201,{ok:true,message:mapDiscussionMessage(rows[0])});
    }
    const adminMessageMatch = route.match(/^\/admin\/discussion\/messages\/([^/]+)$/);
    if (adminMessageMatch && req.method === 'PATCH') {
      const messageId = adminMessageMatch[1];
      if (!UUID_PATTERN.test(messageId)) return send(res,404,{ok:false,code:'MESSAGE_NOT_FOUND',message:'စာကို မတွေ့ပါ။'});
      const body = await readBody(req);
      const message = discussionMessageText(body.body);
      if (!validDiscussionMessageText(message)) {
        return send(res,400,{ok:false,code:'INVALID_MESSAGE',message:'စာသားသည် ဗလာမဖြစ်ရ၊ စာလုံးရေ ၄,၀၀၀ ထက် မကျော်ရပါ။'});
      }
      const rows = await db`UPDATE discussion_messages SET body=${message},edited_at=now()
        WHERE id=${messageId} AND sender_role='admin'
        RETURNING id,user_id,sender_role,body,created_at,edited_at`;
      if (!rows.length) return send(res,404,{ok:false,code:'MESSAGE_NOT_EDITABLE',message:'Only Admin messages can be edited.'});
      return send(res,200,{ok:true,message:mapDiscussionMessage(rows[0])});
    }
    if (route === '/admin/discussion/messages' && req.method === 'DELETE') {
      const body = await readBody(req);
      const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map((id)=>String(id).trim()))] : [];
      if (!ids.length || ids.length > 100 || ids.some((id)=>!UUID_PATTERN.test(id))) {
        return send(res,400,{ok:false,code:'INVALID_MESSAGE_IDS',message:'ဖျက်မည့်စာများကို မှန်ကန်စွာ ရွေးချယ်ပါ။'});
      }
      const deleteQueries = ids.map((id)=>db`DELETE FROM discussion_messages WHERE id=${id} RETURNING id`);
      const results = await db.transaction(deleteQueries);
      const deletedIds = results.flat().map((row)=>String(row.id));
      return send(res,200,{ok:true,deletedIds});
    }
    if (route === '/admin/conversation-messages' && req.method === 'DELETE') {
      const body = await readBody(req);
      const requested = Array.isArray(body.messages) ? body.messages : [];
      if (!requested.length || requested.length > 100) {
        return send(res,400,{ok:false,code:'INVALID_MESSAGES',message:'Select between 1 and 100 messages to delete.'});
      }
      const messages = requested.map((item) => ({
        type: item && typeof item.type === 'string' ? item.type : '',
        id: item && typeof item.id === 'string' ? item.id.trim() : ''
      }));
      if (messages.some((item) =>
        !['discussion', 'feedback'].includes(item.type) || !UUID_PATTERN.test(item.id)
      )) {
        return send(res,400,{ok:false,code:'INVALID_MESSAGES',message:'The selected messages are invalid.'});
      }
      const uniqueMessages = [...new Map(
        messages.map((item) => [`${item.type}:${item.id}`, item])
      ).values()];
      const deleteQueries = uniqueMessages.map((item) =>
        item.type === 'discussion'
          ? db`DELETE FROM discussion_messages WHERE id=${item.id} RETURNING id`
          : db`DELETE FROM feedback WHERE id=${item.id} RETURNING id`
      );
      const results = await db.transaction(deleteQueries);
      const deletedMessages = results.flatMap((rows, index) =>
        rows.map((row) => ({ type: uniqueMessages[index].type, id: String(row.id) }))
      );
      return send(res,200,{ok:true,deletedMessages});
    }
    if (route === '/admin/educational-content' && req.method === 'GET') {
      const grade=Number(req.query.grade||0),category=String(req.query.category||''),chapter=String(req.query.chapter||'');
      const rows=await db`SELECT id,grade,category,title,chapter,content,sort_order AS "sortOrder",active,updated_at AS "updatedAt" FROM educational_content
        WHERE (${grade===0} OR grade=${grade}) AND (${category==='' } OR category=${category}) AND (${chapter==='' } OR chapter=${chapter})
        ORDER BY grade,category,chapter,sort_order,title`;
      return send(res,200,{ok:true,records:rows});
    }
    if (route === '/admin/educational-content' && ['POST','PUT'].includes(req.method)) {
      const body=await readBody(req),record=body.record||body;
      const grade=Number(record.grade),category=String(record.category||''),chapter=String(record.chapter||'').trim(),title=String(record.title||'').trim();
      const validCategories=['old_questions','one_mark','objectives','calculations','short_questions','definitions'];
      if(![10,11,12].includes(grade)||!validCategories.includes(category)||!chapter||!title||record.content==null) return send(res,400,{ok:false,message:'အတန်း၊ အမျိုးအစား၊ အခန်း၊ ခေါင်းစဉ်နှင့် အကြောင်းအရာ ဖြည့်ပါ။'});
      const content=cleanEducationalContent(record.content);
      const sortOrder=Number.isSafeInteger(Number(record.sortOrder))?Number(record.sortOrder):0;
      if(req.method==='POST'){
        const rows=await db`INSERT INTO educational_content(grade,category,title,chapter,content,sort_order,active) VALUES (${grade},${category},${title},${chapter},${JSON.stringify(content)}::jsonb,${sortOrder},${record.active!==false}) RETURNING id,grade,category,title,chapter,content,sort_order AS "sortOrder",active,updated_at AS "updatedAt"`;
        return send(res,201,{ok:true,record:rows[0]});
      }
      const id=String(record.id||'');
      if(!id) return send(res,400,{ok:false,message:'ပြင်ဆင်မည့် မှတ်တမ်း ID မရှိပါ။'});
      const rows=await db`UPDATE educational_content SET grade=${grade},category=${category},title=${title},chapter=${chapter},content=${JSON.stringify(content)}::jsonb,sort_order=${sortOrder},active=${record.active!==false},updated_at=now() WHERE id=${id} RETURNING id,grade,category,title,chapter,content,sort_order AS "sortOrder",active,updated_at AS "updatedAt"`;
      if(!rows.length)return send(res,404,{ok:false,message:'သင်ခန်းစာမှတ်တမ်းကို မတွေ့ပါ။'});
      return send(res,200,{ok:true,record:rows[0]});
    }
    if (route === '/admin/educational-content' && req.method === 'DELETE') {
      const body=await readBody(req),id=String(body.id||'');
      const rows=await db`DELETE FROM educational_content WHERE id=${id} RETURNING id`;
      if(!rows.length)return send(res,404,{ok:false,message:'သင်ခန်းစာမှတ်တမ်းကို မတွေ့ပါ။'});
      return send(res,200,{ok:true});
    }
    if (route === '/orders' && req.method === 'GET') {
      const rows=await db`SELECT o.id,o.voucher_no,o.customer_name,o.phone,o.city_id,c.label AS city_label,o.address,o.delivery_service,o.payment_method,o.car_details,o.subtotal,o.delivery_fee,o.total,o.total_weight_kg,o.cash_collection,o.status,o.complete,o.created_at,o.updated_at,o.admin_data,o.royal_data
        FROM orders o JOIN delivery_cities c ON c.id=o.city_id WHERE o.user_id=${user.id} ORDER BY o.created_at DESC LIMIT 100`;
      const orders=await Promise.all(rows.map(async(order)=>{
        const items=await db`SELECT book_id AS id,book_name AS name,quantity,unit_price AS "unitPrice",amount FROM order_items WHERE order_id=${order.id} ORDER BY id`;
        const adminData={...(order.admin_data||{}),...(order.royal_data||{})};
        const orderedDateValue=adminData['Ordered Date']||adminData['Order Date']||order.created_at||'';
        const orderedDate=orderedDateValue instanceof Date?orderedDateValue.toISOString():String(orderedDateValue);
        const deliveredDateValue=adminData['Deliver Date']||'';
        const deliveredDate=deliveredDateValue instanceof Date?deliveredDateValue.toISOString():String(deliveredDateValue);
        const complete=order.complete===true||['complete','received'].includes(String(order.status));
        const deliveryStatus=complete?'complete':['delivered','on_the_way'].includes(String(order.status))?'delivered':'pending';
        const amountReceived=receivedBooksOnly(adminData.Received||adminData['Amount Received'],Number(order.subtotal),Number(order.delivery_fee));
        const confirmDate=adminData['Confirm Date']?dateOnlyInYangon(adminData['Confirm Date']):'';
        const carInfo=[adminData['car inform'],order.car_details,order.delivery_service==='Car'?adminData['Delivery Notes']:'']
          .map((value)=>String(value??'').trim()).find(Boolean)||'';
        return {voucherNo:order.voucher_no,name:order.customer_name,phone:order.phone,city:order.city_label,address:order.address,deliveryService:order.delivery_service,carInfo,paymentMethod:order.payment_method,subtotal:order.subtotal,deliveryFee:order.delivery_fee,total:order.total,totalWeightKg:order.total_weight_kg,amountReceived,cashCollection:complete?order.cash_collection:0,status:deliveryStatus,complete,createdAt:orderedDate,deliveredDate,confirmDate,items};
      }));
      return send(res,200,{ok:true,orders});
    }
    if (((route === '/orders/confirm' && ['PATCH','POST'].includes(req.method)) ||
         (/^\/orders\/[^/]+\/confirm$/.test(route) && ['PATCH','POST'].includes(req.method)))) {
      const body=await readBody(req);
      const voucher=String(body.voucherNo || body['Voucher No'] ||
        (route !== '/orders/confirm' ? decodeURIComponent(route.split('/')[2] || '') : '')).trim();
      if(!voucher) return send(res,400,{ok:false,code:'INVALID_ORDER',message:'မှာယူမှုနံပါတ် မမှန်ပါ။'});
      const rows=await db`SELECT id,user_id,status,complete,admin_data FROM orders WHERE voucher_no=${voucher} AND user_id=${user.id} LIMIT 1`;
      if(!rows.length) return send(res,404,{ok:false,code:'ORDER_NOT_FOUND',message:'မှာယူမှုမတွေ့ပါ။'});
      if(rows[0].complete===true||['complete','received'].includes(String(rows[0].status))) {
        const confirmDate=rows[0].admin_data?.['Confirm Date']?dateOnlyInYangon(rows[0].admin_data['Confirm Date']):'';
        return send(res,200,{ok:true,status:'complete',complete:true,confirmDate,message:'လက်ခံရရှိပြီလို့ အတည်ပြုပြီးသားဖြစ်ပါသည်။'});
      }
      if(!['delivered','on_the_way'].includes(String(rows[0].status))) {
        return send(res,409,{ok:false,code:'NOT_READY_TO_CONFIRM',message:'ပို့ဆောင်ပြီးသား အမှာစာကိုသာ လက်ခံအတည်ပြုနိုင်ပါသည်။'});
      }
      const confirmedDate=yangonDateOnly();
      const adminData={...(rows[0].admin_data||{}),'Confirm Date':confirmedDate};
      const confirmationText=`အမှာစာ ${voucher} ကို လက်ခံရရှိပြီဖြစ်ကြောင်း အတည်ပြုလိုက်ပါသည်။`;
      const completed=await db`WITH changed AS (
          UPDATE orders SET status='complete',complete=true,admin_data=${JSON.stringify(adminData)}::jsonb,updated_at=now()
          WHERE id=${rows[0].id} AND complete=false AND status IN ('delivered','on_the_way') RETURNING id
        ), posted AS (
          INSERT INTO discussion_messages(user_id,sender_id,sender_role,body)
          SELECT ${user.id},${user.id},'customer',${confirmationText} FROM changed RETURNING id
        ) SELECT changed.id,posted.id AS message_id FROM changed CROSS JOIN posted`;
      if(!completed.length) {
        const current=await db`SELECT complete,status,admin_data FROM orders WHERE id=${rows[0].id} LIMIT 1`;
        if(current[0]?.complete===true||['complete','received'].includes(String(current[0]?.status))) {
          const confirmDate=current[0].admin_data?.['Confirm Date']?dateOnlyInYangon(current[0].admin_data['Confirm Date']):'';
          return send(res,200,{ok:true,status:'complete',complete:true,confirmDate,message:'လက်ခံရရှိပြီလို့ အတည်ပြုပြီးသားဖြစ်ပါသည်။'});
        }
        return send(res,409,{ok:false,code:'NOT_READY_TO_CONFIRM',message:'ပို့ဆောင်ပြီးသား အမှာစာကိုသာ လက်ခံအတည်ပြုနိုင်ပါသည်။'});
      }
      return send(res,200,{ok:true,status:'complete',complete:true,confirmDate:confirmedDate,message:'လက်ခံရရှိပြီလို့ အတည်ပြုပြီးပါပြီ။'});
    }
    if (route === '/profile/password' && req.method === 'PATCH') {
      const body = await readBody(req);
      const currentPassword = String(body.currentPassword || '');
      const newPassword = String(body.newPassword || '');
      if (!/(?=.*[A-Za-z])(?=.*\d).{8,}/.test(newPassword)) {
        return send(res,400,{ok:false,code:'WEAK_PASSWORD',message:'စကားဝှက်တွင် အင်္ဂလိပ်စာလုံးနှင့် ဂဏန်းပါပြီး အနည်းဆုံး ၈ လုံးရှိရပါမည်။'});
      }
      const credentials = await db`SELECT password_hash,password_salt FROM users WHERE id=${user.id} LIMIT 1`;
      const supplied = Buffer.from(await scrypt(currentPassword, credentials[0]?.password_salt || 'invalid-salt', 64));
      const saved = Buffer.from(credentials[0]?.password_hash || '0'.repeat(128), 'hex');
      if (!credentials.length || saved.length !== supplied.length || !timingSafeEqual(saved, supplied)) {
        return send(res,401,{ok:false,code:'CURRENT_PASSWORD_INVALID',message:'လက်ရှိစကားဝှက် မမှန်ပါ။'});
      }
      const salt = randomBytes(16).toString('hex');
      const passwordHash = Buffer.from(await scrypt(newPassword, salt, 64)).toString('hex');
      const currentToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const updated = await db`WITH changed AS (
          UPDATE users SET password_hash=${passwordHash},password_salt=${salt},updated_at=now()
          WHERE id=${user.id} RETURNING id
        ), revoked_sessions AS (
          DELETE FROM sessions USING changed
          WHERE sessions.user_id=changed.id AND sessions.token_hash<>${tokenHash(currentToken)}
          RETURNING sessions.id
        ), cancelled_resets AS (
          UPDATE password_reset_requests SET status='cancelled',token_hash=NULL,token_expires_at=NULL
          WHERE user_id IN (SELECT id FROM changed) AND status IN ('pending','approved')
          RETURNING id
        )
        SELECT id FROM changed`;
      if (!updated.length) return send(res,500,{ok:false,message:'စကားဝှက်ကို ပြောင်းလဲ၍မရပါ။'});
      return send(res,200,{ok:true,message:'စကားဝှက်ပြောင်းလဲပြီးပါပြီ။ အခြားစက်များမှ အကောင့်ထွက်လိုက်ပါပြီ။'});
    }
    if (route === '/profile' && req.method === 'PATCH') {
      const body = await readBody(req);
      const currentPassword = String(body.currentPassword || '');
      const credentialRows = await db`SELECT password_hash,password_salt FROM users WHERE id=${user.id} LIMIT 1`;
      const suppliedPassword = Buffer.from(await scrypt(currentPassword, credentialRows[0]?.password_salt || 'invalid-salt', 64));
      const savedPassword = Buffer.from(credentialRows[0]?.password_hash || '0'.repeat(128), 'hex');
      if (!credentialRows.length || savedPassword.length !== suppliedPassword.length || !timingSafeEqual(savedPassword, suppliedPassword)) {
        return send(res, 401, {ok:false,code:'CURRENT_PASSWORD_INVALID',message:'ပိုင်ရှင်ဖြစ်ကြောင်း စစ်ဆေးရန် လက်ရှိစကားဝှက်ကို မှန်ကန်စွာထည့်ပါ။'});
      }
      const email=normalizeEmail(body.email);
      if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res,400,{ok:false,code:'INVALID_EMAIL',message:'မှန်ကန်သော email လိပ်စာထည့်ပါ။'});
      const phone=normalizePhone(body.phone);
      if(!/^0\d{10}$/.test(phone)) return send(res,400,{ok:false,code:'INVALID_PHONE',message:'၀ ဖြင့်စသော ၁၁ လုံးရှိသည့် ဖုန်းနံပါတ် ဖြည့်ပါ။'});
      const duplicate=await db`SELECT id FROM users WHERE email IS NOT NULL AND lower(email)=lower(${email || null}) AND id<>${user.id} LIMIT 1`;
      if(duplicate.length) return send(res,409,{ok:false,code:'EMAIL_EXISTS',message:'ဤ email ကို အခြားအကောင့်တစ်ခု အသုံးပြုထားပြီးပါပြီ။'});
      const duplicatePhone=await db`SELECT id FROM users WHERE phone=${phone} AND id<>${user.id} LIMIT 1`;
      if(duplicatePhone.length) return send(res,409,{ok:false,code:'PHONE_EXISTS',message:'ဤဖုန်းနံပါတ်ကို အခြားအကောင့်တစ်ခု အသုံးပြုထားပြီးပါပြီ။'});
      const updated = await db`UPDATE users SET name=${String(body.name || '').trim()}, occupation=${String(body.job || body.occupation || '').trim()}, email=${email || null}, phone=${phone}, updated_at=now() WHERE id=${user.id} RETURNING id,name,occupation,email,phone,role`;
      return send(res,200,{ok:true,user:safeUser(updated[0])});
    }
    if (route === '/feedback' && req.method === 'POST') {
      const body=await readBody(req);
      const message=JSON.stringify({job:String(body.job || ''),books:body.books || [],otherSuggestion:String(body.otherSuggestion || '')});
      await db`INSERT INTO feedback(user_id,name,phone,message) VALUES (${user.id},${user.name},${user.phone},${message})`;
      return send(res,201,{ok:true});
    }

    if (route === '/admin/orders/payment-notice' && req.method === 'POST') {
      const body=await readBody(req),voucher=String(body.voucherNo||'').trim();
      if(!voucher)return send(res,400,{ok:false,code:'VOUCHER_REQUIRED',message:'ဘောက်ချာနံပါတ်ကို စစ်ဆေးပါ။'});
      const rows=await db`SELECT voucher_no,user_id,subtotal,total,delivery_fee,admin_data,royal_data FROM orders WHERE voucher_no=${voucher} LIMIT 1`;
      const order=rows[0];
      if(!order)return send(res,404,{ok:false,code:'ORDER_NOT_FOUND',message:'အမှာစာကို မတွေ့ပါ။'});
      if(!order.user_id)return send(res,409,{ok:false,code:'CUSTOMER_ACCOUNT_MISSING',message:'ဤအမှာစာနှင့် Customer account မချိတ်ဆက်ထားပါ။'});
      const adminData={...(order.admin_data||{}),...(order.royal_data||{})};
      const amountReceived=receivedBooksOnly(adminData.Received||adminData['Amount Received'],Number(order.subtotal??order.total??0),Number(order.delivery_fee??0));
      const total=Number(order.subtotal??order.total??0);
      const deliveryFee=Number(order.delivery_fee??0);
      const totalWithDelivery=total+deliveryFee;
      const receivedWithDelivery=amountReceived+deliveryFee;
      const payDate=paymentNoticeDate(adminData['Pay Date']||adminData['pay date']||'');
      const account=String(adminData['KPay Account']||adminData['Kpay acc']||adminData['Kpay account']||'').trim();
      if(!Number.isFinite(receivedWithDelivery)||!Number.isFinite(totalWithDelivery)||totalWithDelivery<=0||receivedWithDelivery<totalWithDelivery||!payDate||!account)return send(res,409,{ok:false,code:'PAYMENT_NOTICE_NOT_READY',message:'Amount Received ကို Total နှင့်ညီအောင် ဖြည့်ပြီး Pay Date နဲ့ KPay Account ကို ထည့်ပြီးမှ စာပို့နိုင်ပါသည်။'});
      const prefix=`${order.voucher_no} အတွက် ငွေလက်ခံရရှိပါပြီ၊`;
      const priorNotice=await db`SELECT id,user_id,sender_role,body,created_at,edited_at FROM discussion_messages
        WHERE user_id=${order.user_id} AND sender_role='admin' AND left(body,length(${prefix}))=${prefix} ORDER BY created_at LIMIT 1`;
      if(priorNotice.length)return send(res,200,{ok:true,alreadySent:true,message:mapDiscussionMessage(priorNotice[0])});
      const message=`${order.voucher_no} အတွက် ငွေလက်ခံရရှိပါပြီ၊\nPay date - ${payDate}\nKpay acc - ${account}`;
      const inserted=await db`INSERT INTO discussion_messages(user_id,sender_id,sender_role,body)
        SELECT ${order.user_id},${user.id},'admin',${message}
        WHERE NOT EXISTS (SELECT 1 FROM discussion_messages WHERE user_id=${order.user_id} AND sender_role='admin' AND body=${message})
        RETURNING id,user_id,sender_role,body,created_at,edited_at`;
      if(inserted.length)return send(res,201,{ok:true,alreadySent:false,message:mapDiscussionMessage(inserted[0])});
      const existing=await db`SELECT id,user_id,sender_role,body,created_at,edited_at FROM discussion_messages
        WHERE user_id=${order.user_id} AND sender_role='admin' AND body=${message} ORDER BY created_at LIMIT 1`;
      return send(res,200,{ok:true,alreadySent:true,message:existing[0]?mapDiscussionMessage(existing[0]):null});
    }
    if (route === '/admin/orders' && req.method === 'GET') {
      const orders=await db`SELECT o.*,c.english AS city_english,c.label AS city_label FROM orders o JOIN delivery_cities c ON c.id=o.city_id ORDER BY o.created_at DESC`;
      const serviceFeeRows=await db`SELECT value FROM app_settings WHERE key='royalServiceFee' LIMIT 1`;
      const configuredServiceFee=Number(serviceFeeRows[0]?.value ?? 300);
      const royalServiceFee=Number.isFinite(configuredServiceFee)&&configuredServiceFee>=0?configuredServiceFee:300;
      const paymentNotices=await db`SELECT user_id,body FROM discussion_messages WHERE sender_role='admin' AND body LIKE '%အတွက် ငွေလက်ခံရရှိပါပြီ၊%'`;
      const paymentNoticeKeys=new Set(paymentNotices.map((message)=>`${message.user_id}:${message.body.split(' အတွက် ငွေလက်ခံရရှိပါပြီ၊')[0]}`));
      const items=await db`SELECT oi.order_id,oi.book_id,oi.quantity,oi.amount,b.quantity_header,b.amount_header FROM order_items oi LEFT JOIN books b ON b.id=oi.book_id ORDER BY oi.book_name`;
      const profileOrders=orders.map((order)=>{
        const merged={...(order.admin_data||{}),...(order.royal_data||{})};
        const legacyDeliveryNotes=merged['Delivery Notes'];
        const extra={...merged};
        delete extra['Delivery Notes'];
        const orderItems=items.filter((item)=>item.order_id===order.id);
        const deliveryService=String(order.delivery_service||'');
        const totalWeight=Number(order.total_weight_kg||0);
        const complete=order.complete===true||['complete','received'].includes(String(order.status));
        const deliveryStatus=complete?'complete':['delivered','on_the_way'].includes(String(order.status))?'delivered':'pending';
        const carInfo=[extra['car inform'],order.car_details,deliveryService==='Car'?legacyDeliveryNotes:'']
          .map((value)=>String(value??'').trim()).find(Boolean)||'';
        const calculatedCharges=royalShipmentCharges(deliveryService,totalWeight,Number(order.delivery_fee||0),royalServiceFee);
        const shipmentServiceStored=String(extra['Royal Shipment Service Charge']??'').trim();
        const shipmentServiceCharge=shipmentServiceStored||String(calculatedCharges.serviceCharge);
        const shipmentCodStored=String(extra['Royal Shipment COD Amount']??'').trim();
        const shipmentCodAmount=shipmentCodStored||String(calculatedCharges.codCharge);
        const shipmentWeight=String(extra['Royal Shipment Weight']??'').trim()||
          (deliveryService==='Royal'?String(order.total_weight_kg||0):'');
        const received=receivedBooksOnly(extra.Received||extra['Amount Received'],Number(order.subtotal),Number(order.delivery_fee));
        return {
          ...extra,
          'Voucher No':order.voucher_no,
          Name:order.customer_name,
          Address:extra.Address||`${order.city_label}, ${order.address}`,
          'Phone 1':order.phone,
          'Phone 2':order.phone2,
          'Ordered Date':extra['Ordered Date']||order.created_at.toISOString(),
          Total:String(order.subtotal),
          'Payment Method':order.payment_method,
          Received:String(received),
          Complete:complete?'Yes':'',
          'Confirm Date':extra['Confirm Date']?dateOnlyInYangon(extra['Confirm Date']):'',
          'Deliver Date':extra['Deliver Date']||'',
          status:deliveryStatus,
          hasCustomerAccount:Boolean(order.user_id),
          paymentNoticeSent:Boolean(order.user_id&&paymentNoticeKeys.has(`${order.user_id}:${order.voucher_no}`)),
          'Delivery Service':deliveryService,
          'Delivery Fees':String(order.delivery_fee),
          'Total KG':String(order.total_weight_kg),
          'Cash Collection':String(order.cash_collection),
          'car inform':carInfo,
          car_details:carInfo,
          carInfo,
          carDetails:carInfo,
          'Royal Shipment Service Charge':shipmentServiceCharge,
          'Royal Shipment COD Amount':shipmentCodAmount,
          'Royal Shipment Weight':shipmentWeight,
          'Royal Shipment State':extra['Royal Shipment State']||(deliveryService!=='Car'?legacyDeliveryNotes||'':''),
          ...Object.fromEntries(orderItems.flatMap((item)=>[
            [item.quantity_header||`${item.book_id} Qty`,String(item.quantity)],
            [item.amount_header||`${item.book_id} Amount`,String(item.amount)]
          ]))
        };
      });
      return send(res,200,{ok:true,orders:profileOrders});
    }
    if (route === '/admin/orders' && req.method === 'DELETE') {
      const body=await readBody(req);
      const voucher=String(body.voucherNo||body['Voucher No']||'').trim();
      if(!voucher)return send(res,400,{ok:false,code:'VOUCHER_REQUIRED',message:'ဘောက်ချာနံပါတ်ကို စစ်ဆေးပါ။'});
      const deleted=await db`DELETE FROM orders WHERE voucher_no=${voucher} RETURNING voucher_no`;
      if(!deleted.length)return send(res,404,{ok:false,code:'ORDER_NOT_FOUND',message:'အမှာစာကို မတွေ့ပါ။'});
      return send(res,200,{ok:true,voucherNo:deleted[0].voucher_no});
    }
    if (route === '/admin/orders' && req.method === 'PATCH') {
      const body=await readBody(req), order=body.order || body;
      const voucher=String(order.voucherNo || order['Voucher No'] || '');
      const priorRows=await db`SELECT o.*,c.label AS city_label FROM orders o JOIN delivery_cities c ON c.id=o.city_id WHERE o.voucher_no=${voucher} LIMIT 1`;
      const prior=priorRows[0];
      if(!prior) return send(res,404,{ok:false,message:'Order မတွေ့ပါ။'});
      const priorItems=await db`SELECT oi.book_id,oi.quantity,oi.amount,b.quantity_header,b.amount_header FROM order_items oi LEFT JOIN books b ON b.id=oi.book_id WHERE oi.order_id=${prior.id}`;
      const itemData=Object.fromEntries(priorItems.flatMap((item)=>[[item.quantity_header||`${item.book_id} Qty`,String(item.quantity)],[item.amount_header||`${item.book_id} Amount`,String(item.amount)]]));
      const adminData={
        'Voucher No':prior.voucher_no,Name:prior.customer_name,Address:(prior.admin_data||{}).Address||`${prior.city_label}, ${prior.address}`,
        'Phone 1':prior.phone,'Phone 2':prior.phone2,'Ordered Date':prior.created_at.toISOString(),Total:String(prior.subtotal),
        'Payment Method':prior.payment_method,Received:(prior.admin_data||{}).Received??'','Deliver Date':(prior.admin_data||{})['Deliver Date']||'',
        'Delivery Service':prior.delivery_service,'Delivery Fees':String(prior.delivery_fee),'Total KG':String(prior.total_weight_kg),
        'Cash Collection':String(prior.cash_collection),'car inform':(prior.admin_data||{})['car inform']||((prior.delivery_service==='Car'?(prior.admin_data||{})['Delivery Notes']:''))||prior.car_details,...itemData,...(prior.admin_data||{}),...order
      };
      const editAliases={'Amount Received':'Received','Delivered Date':'Deliver Date','Phone':'Phone 1','Order Date':'Ordered Date','Old Questions Qty':'OQ Qty','Old Questions Amount':'OQ Amount','Grade 11 Handbook Qty':'G11 Handbook Qty','Grade 11 Handbook Amount':'G11 Handbook Amount','Grade 11 Objective Qty':'G11 Objective Qty','Grade 11 Objective Amount':'G11 Objective Amount','Grade 10 Handbook Qty':'G10 Handbook Qty','Grade 10 Handbook Amount':'G10 Handbook Amount','Royal VOC No':'Royal Voucher',Delivery:'Delivery Service','Facebook Account Name':'Facebook Name'};
      for(const [alias,canonical] of Object.entries(editAliases)) if(Object.prototype.hasOwnProperty.call(order,alias)) adminData[canonical]=order[alias];
      const delivered=String(order['Deliver Date']||order['Delivered Date']||'').trim();
      const wasComplete=prior.complete===true||['complete','received'].includes(String(prior.status));
      const complete=Object.prototype.hasOwnProperty.call(order,'Complete')
        ? order.Complete===true||['yes','true','1'].includes(String(order.Complete).trim().toLowerCase())
        : wasComplete;
      const enteredReceived=Number(String(adminData.Received??'0').replaceAll(',',''));
      const subtotalValue=Number(String(adminData.Total??prior.subtotal).replaceAll(',',''));
      const feeValue=Number(String(adminData['Delivery Fees']??prior.delivery_fee).replaceAll(',',''));
      const weightValue=Number(String(adminData['Total KG']??prior.total_weight_kg).replaceAll(',',''));
      if(!Number.isSafeInteger(enteredReceived)||enteredReceived<0||!Number.isSafeInteger(subtotalValue)||subtotalValue<0||!Number.isSafeInteger(feeValue)||feeValue<0||!Number.isFinite(weightValue)||weightValue<0) return send(res,400,{ok:false,message:'ငွေပမာဏနှင့် အလေးချိန် အချက်အလက်ကို စစ်ဆေးပါ။'});
      if(enteredReceived>subtotalValue+feeValue)return send(res,400,{ok:false,code:'RECEIVED_AMOUNT_INVALID',message:'Received ပမာဏသည် စာအုပ်ဖိုးနှင့် ပို့ခပေါင်းထက် မကျော်ရပါ။'});
      const receivedValue=enteredReceived===subtotalValue+feeValue&&feeValue>0?subtotalValue:enteredReceived;
      adminData.Received=String(receivedValue);
      const priorNotes=String(adminData['Delivery Notes']||'');
      if(!adminData['car inform']&&prior.delivery_service==='Car')adminData['car inform']=priorNotes||prior.car_details;
      if(priorNotes&&prior.delivery_service!=='Car'&&!adminData['Royal Shipment State'])adminData['Royal Shipment State']=priorNotes;
      delete adminData['Delivery Notes'];
      adminData['car inform']=String(adminData['car inform']||'');
      if(complete&&!wasComplete)adminData['Confirm Date']=yangonDateOnly();
      else if(!complete)delete adminData['Confirm Date'];
      else if(adminData['Confirm Date'])adminData['Confirm Date']=dateOnlyInYangon(adminData['Confirm Date']);
      const status=complete?'complete':delivered?'delivered':'pending';
      delete adminData.Complete;
      const rawAddress=String(adminData.Address??prior.address);
      const addressPrefix=`${prior.city_label}, `;
      const dbAddress=rawAddress.startsWith(addressPrefix)?rawAddress.slice(addressPrefix.length):rawAddress;
      const payment=String(adminData['Payment Method']||prior.payment_method);
      const service=String(adminData['Delivery Service']||prior.delivery_service);
      if(service==='Car'&&payment!=='KBZ Pay')return send(res,400,{ok:false,code:'CAR_REQUIRES_KBZ',message:'ကားတင်ရန်အတွက် KBZ Pay ကိုသာ ရွေးနိုင်ပါသည်။'});
      for(const field of ['Royal Shipment Service Charge','Royal Shipment COD Amount']){
        const value=String(adminData[field]??'').trim();
        if(value!==''&&(!Number.isSafeInteger(Number(value))||Number(value)<0))return send(res,400,{ok:false,message:`${field} အချက်အလက်ကို စစ်ဆေးပါ။`});
        if(value!=='')adminData[field]=String(Number(value));
      }
      const cashValue=Number(String(adminData['Cash Collection']??(payment==='COD'?subtotalValue+feeValue:0)).replaceAll(',',''));
      const books=await db`SELECT id,name,quantity_header,amount_header,weight FROM books ORDER BY sort_order,id`;
      const itemRows=[];
      for(const book of books){const quantity=Number(String(adminData[book.quantity_header]??'0').replaceAll(',',''));if(!Number.isSafeInteger(quantity)||quantity<0)return send(res,400,{ok:false,message:`${book.quantity_header} အချက်အလက် မမှန်ပါ။`});if(quantity<1)continue;const amountRaw=adminData[book.amount_header];const amount=amountRaw==null||amountRaw===''?0:Number(String(amountRaw).replaceAll(',',''));if(!Number.isSafeInteger(amount)||amount<0)return send(res,400,{ok:false,message:`${book.amount_header} အချက်အလက် မမှန်ပါ။`});itemRows.push({book,quantity,amount,unitPrice:Math.floor(amount/quantity)});}
      const carInfo=String(adminData['car inform']||'');
      const rows=await db`UPDATE orders SET customer_name=${String(adminData.Name??prior.customer_name)},phone=${String(adminData['Phone 1']??prior.phone)},phone2=${String(adminData['Phone 2']??prior.phone2)},address=${dbAddress},payment_method=${payment},delivery_service=${service},car_details=${carInfo},delivery_fee=${feeValue},subtotal=${subtotalValue},total=${subtotalValue+feeValue},total_weight_kg=${weightValue},cash_collection=${Number.isSafeInteger(cashValue)&&cashValue>=0?cashValue:0},status=${status},complete=${complete},admin_note=${String(order.adminNote||prior.admin_note||'')},admin_data=${JSON.stringify(adminData)}::jsonb,updated_at=now() WHERE voucher_no=${voucher} RETURNING id,voucher_no`;
      await db`DELETE FROM order_items WHERE order_id=${rows[0].id}`;
      for(const item of itemRows) await db`INSERT INTO order_items(order_id,book_id,book_name,quantity,unit_price,amount,weight_kg) VALUES (${rows[0].id},${item.book.id},${item.book.name},${item.quantity},${item.unitPrice},${item.amount},${Number(item.book.weight)})`;
      return send(res,200,{ok:true,order:{...order,status,Complete:complete?'Yes':''}});
    }
    if (route === '/admin/master-data' && req.method === 'PUT') {
      const {masterData}=await readBody(req);
      if(!masterData?.settings || !masterData.books || !masterData.deliveryCities) return send(res,400,{ok:false,message:'Master data မပြည့်စုံပါ။'});
      const thresholds=masterData.settings.priceThresholds;
      const bookRows=Object.entries(masterData.books).map(([id,book],sort_order)=>({id,name:book.name,weight:Number(book.weight),prices:book.prices,quantity_header:book.quantityHeader||`${id} Qty`,amount_header:book.amountHeader||`${id} Amount`,image:book.image||'',active:book.active!==false,sort_order}));
      const cityRows=Object.entries(masterData.deliveryCities).map(([id,city],sort_order)=>({id,english:city.english,myanmar:city.myanmar,label:city.label||`${city.english} (${city.myanmar})`,up_to_2kg:Number(city.upTo2Kg),next_kg:Number(city.nextKg),active:city.active!==false,sort_order}));
      if(!bookRows.length||!cityRows.length||!Number.isSafeInteger(Number(masterData.settings.royalServiceFee))||Number(masterData.settings.royalServiceFee)<0||!Number.isSafeInteger(Number(masterData.settings.codMaxTotal))||Number(masterData.settings.codMaxTotal)<0) return send(res,400,{ok:false,message:'အထွေထွေ Master Data ကို စစ်ဆေးပါ။'});
      if(!Array.isArray(thresholds)||!thresholds.length||thresholds.some((v,i)=>!Number.isSafeInteger(Number(v))||Number(v)<0||(i>0&&Number(v)<=Number(thresholds[i-1])))) return send(res,400,{ok:false,message:'ဈေးနှုန်းအဆင့်များကို စစ်ဆေးပါ။'});
      if(bookRows.some((b)=>!b.id||!b.name||!Number.isFinite(b.weight)||b.weight<=0||!Array.isArray(b.prices)||b.prices.length!==thresholds.length||b.prices.some((p)=>!Number.isSafeInteger(Number(p))||Number(p)<0))) return send(res,400,{ok:false,message:'စာအုပ်အချက်အလက် မမှန်ပါ။'});
      if(cityRows.some((c)=>!c.id||!c.english||!c.myanmar||!Number.isSafeInteger(c.up_to_2kg)||c.up_to_2kg<0||!Number.isSafeInteger(c.next_kg)||c.next_kg<0)) return send(res,400,{ok:false,message:'မြို့နှင့် ပို့ခအချက်အလက် မမှန်ပါ။'});
      await db`UPDATE books SET active=false`;
      await db`UPDATE delivery_cities SET active=false`;
      for (const [key,value] of Object.entries({priceThresholds:masterData.settings.priceThresholds,royalServiceFee:masterData.settings.royalServiceFee,codMaxTotal:masterData.settings.codMaxTotal})) await db`INSERT INTO app_settings(key,value) VALUES (${key},${JSON.stringify(value)}::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now()`;
      await db`INSERT INTO books(id,name,weight,prices,quantity_header,amount_header,image,active,sort_order)
        SELECT id,name,weight,prices,quantity_header,amount_header,image,active,sort_order
        FROM jsonb_to_recordset(${JSON.stringify(bookRows)}::jsonb) AS x(id text,name text,weight numeric,prices jsonb,quantity_header text,amount_header text,image text,active boolean,sort_order integer)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,weight=excluded.weight,prices=excluded.prices,quantity_header=excluded.quantity_header,amount_header=excluded.amount_header,image=excluded.image,active=excluded.active,sort_order=excluded.sort_order,updated_at=now()`;
      await db`INSERT INTO delivery_cities(id,english,myanmar,label,up_to_2kg,next_kg,active,sort_order)
        SELECT id,english,myanmar,label,up_to_2kg,next_kg,active,sort_order
        FROM jsonb_to_recordset(${JSON.stringify(cityRows)}::jsonb) AS x(id text,english text,myanmar text,label text,up_to_2kg integer,next_kg integer,active boolean,sort_order integer)
        ON CONFLICT(id) DO UPDATE SET english=excluded.english,myanmar=excluded.myanmar,label=excluded.label,up_to_2kg=excluded.up_to_2kg,next_kg=excluded.next_kg,active=excluded.active,sort_order=excluded.sort_order`;
      return send(res,200,{ok:true,masterData});
    }
    if (route === '/admin/master-data' && req.method === 'GET') {
      const [settings,books,cities]=await Promise.all([
        db`SELECT key,value FROM app_settings`,
        db`SELECT id,name,weight,prices,quantity_header AS "quantityHeader",amount_header AS "amountHeader",image,active FROM books ORDER BY sort_order,id`,
        db`SELECT id,english,myanmar,label,up_to_2kg AS "upTo2Kg",next_kg AS "nextKg",active FROM delivery_cities ORDER BY sort_order,english`
      ]);
      const values=Object.fromEntries(settings.map((row)=>[row.key,row.value]));
      return send(res,200,{ok:true,masterData:{schemaVersion:1,updatedAt:new Date().toISOString(),settings:{priceThresholds:values.priceThresholds||[0,10,30,50,100],royalServiceFee:Number(values.royalServiceFee??300),codMaxTotal:Number(values.codMaxTotal??150000)},books:Object.fromEntries(books.map((row)=>[row.id,row])),deliveryCities:Object.fromEntries(cities.map((row)=>[row.id,row]))}});
    }
    if (route === '/admin/bookstores' && req.method === 'GET') {
      const rows=await db`SELECT id,city,name,address,phones,active FROM bookstores ORDER BY sort_order,name`;
      return send(res,200,{ok:true,bookstores:rows});
    }
    if (route === '/admin/bookstores' && req.method === 'PUT') {
      const body=await readBody(req), rows=Array.isArray(body.bookstores)?body.bookstores:[];
      if(rows.some((store)=>!store.id||!store.city||!store.name)) return send(res,400,{ok:false,message:'ဆိုင် ID၊ မြို့နှင့် အမည် ဖြည့်ပါ။'});
      await db`UPDATE bookstores SET active=false`;
      const storeRows=rows.map((store,index)=>({id:String(store.id),city:String(store.city),name:String(store.name),address:String(store.address||''),phones:Array.isArray(store.phones)?store.phones:[],active:store.active!==false,sort_order:index}));
      if(storeRows.length) await db`INSERT INTO bookstores(id,city,name,address,phones,active,sort_order)
        SELECT id,city,name,address,phones,active,sort_order FROM jsonb_to_recordset(${JSON.stringify(storeRows)}::jsonb) AS x(id text,city text,name text,address text,phones jsonb,active boolean,sort_order integer)
        ON CONFLICT(id) DO UPDATE SET city=excluded.city,name=excluded.name,address=excluded.address,phones=excluded.phones,active=excluded.active,sort_order=excluded.sort_order,updated_at=now()`;
      return send(res,200,{ok:true,bookstores:rows});
    }
    if (route === '/admin/users' && req.method === 'GET') {
      const users=await db`SELECT id,name,occupation,email,phone,role,approval_status,created_at FROM users ORDER BY created_at DESC`;
      return send(res,200,{ok:true,profiles:users.map((u)=>({...safeUser(u),adminEligible:adminEmails.includes(normalizeEmail(u.email)),createdAt:u.created_at}))});
    }
    if (route === '/admin/users' && req.method === 'DELETE') {
      const body = await readBody(req);
      const targetId = String(body.userId || '');
      if (!UUID_PATTERN.test(targetId)) return send(res,400,{ok:false,code:'INVALID_USER',message:'အသုံးပြုသူကို စစ်ဆေးပါ။'});
      if (targetId === user.id) return send(res,409,{ok:false,code:'SELF_DELETE_FORBIDDEN',message:'ဤနေရာမှ ကိုယ့် admin အကောင့်ကို ဖျက်၍မရပါ။'});
      const targetRows = await db`SELECT id,email,role FROM users WHERE id=${targetId} LIMIT 1`;
      const target = targetRows[0];
      if (!target) return send(res,404,{ok:false,code:'USER_NOT_FOUND',message:'အသုံးပြုသူကို မတွေ့ပါ။'});
      if (target.role === 'admin') return send(res,409,{ok:false,code:'ADMIN_DELETE_FORBIDDEN',message:'Admin account ကို ဒီစာမျက်နှာမှ ဖျက်၍မရပါ။'});
      const deleted = await db`DELETE FROM users WHERE id=${target.id} RETURNING id`;
      if (!deleted.length) return send(res,404,{ok:false,code:'USER_NOT_FOUND',message:'အသုံးပြုသူကို မတွေ့ပါ။'});
      return send(res,200,{ok:true});
    }
    if (route === '/admin/password-reset-requests' && req.method === 'GET') {
      const requests = await db`SELECT r.id,r.status,r.requested_at AS "requestedAt",r.token_expires_at AS "expiresAt",
          u.name,u.phone,u.email
        FROM password_reset_requests r JOIN users u ON u.id=r.user_id
        WHERE r.status IN ('pending','approved')
        ORDER BY r.requested_at DESC LIMIT 100`;
      return send(res,200,{ok:true,requests});
    }
    if (route === '/admin/password-reset-requests' && req.method === 'PATCH') {
      const body = await readBody(req);
      const requestId = String(body.requestId || '');
      const action = String(body.action || '');
      if (!requestId || !['issue','reject'].includes(action)) {
        return send(res,400,{ok:false,message:'Reset request နှင့် လုပ်ဆောင်ချက်ကို စစ်ဆေးပါ။'});
      }
      if (action === 'reject') {
        const rejected = await db`UPDATE password_reset_requests
          SET status='rejected',token_hash=NULL,token_expires_at=NULL,reviewed_at=now(),reviewed_by=${user.id}
          WHERE id=${requestId} AND status IN ('pending','approved') RETURNING id`;
        if (!rejected.length) return send(res,404,{ok:false,message:'အသုံးပြုနေသော reset request ကို မတွေ့ပါ။'});
        return send(res,200,{ok:true});
      }
      const existing = await db`SELECT id FROM password_reset_requests
        WHERE id=${requestId} AND status IN ('pending','approved') LIMIT 1`;
      if (!existing.length) return send(res,404,{ok:false,message:'အသုံးပြုနေသော reset request ကို မတွေ့ပါ။'});
      const resetCode = randomBytes(8).toString('hex').toUpperCase();
      const issued = await db`UPDATE password_reset_requests
        SET status='approved',token_hash=${tokenHash(resetCode)},token_expires_at=now()+interval '15 minutes',
          failed_attempts=0,reviewed_at=now(),reviewed_by=${user.id}
        WHERE id=${requestId} AND status IN ('pending','approved')
        RETURNING token_expires_at AS "expiresAt"`;
      if (!issued.length) return send(res,409,{ok:false,message:'Reset request ကို ပြောင်းလဲ၍မရပါ။ ပြန်လည်စစ်ဆေးပါ။'});
      return send(res,200,{ok:true,resetCode,expiresAt:issued[0].expiresAt});
    }
    if (route === '/admin/users' && req.method === 'PATCH') {
      const body=await readBody(req),targetId=String(body.userId||''),role=String(body.role||''),approvalStatus=String(body.approvalStatus||'');
      if(!targetId||(!['customer','admin'].includes(role)&&!['approved','rejected'].includes(approvalStatus))) return send(res,400,{ok:false,message:'အသုံးပြုသူနှင့် ပြောင်းလဲမှုကို စစ်ဆေးပါ။'});
      const targetRows=await db`SELECT id,email,role,approval_status FROM users WHERE id=${targetId} LIMIT 1`,target=targetRows[0];
      if(!target) return send(res,404,{ok:false,message:'အသုံးပြုသူကို မတွေ့ပါ။'});
      if(approvalStatus){
        const updated=await db`UPDATE users SET approval_status=${approvalStatus},updated_at=now() WHERE id=${target.id} RETURNING id,name,occupation,email,phone,role,approval_status`;
        return send(res,200,{ok:true,user:safeUser(updated[0])});
      }
      if(role==='admin'&&!adminEmails.includes(normalizeEmail(target.email))) return send(res,403,{ok:false,message:'သတ်မှတ်ထားသော admin email စာရင်းတွင် မပါဝင်ပါ။'});
      if(role==='customer'&&target.role==='admin'){
        const admins=await db`SELECT email FROM users WHERE role='admin'`;
        const activeAdminCount=admins.filter((row)=>adminEmails.includes(normalizeEmail(row.email))).length;
        if(target.id===user.id||activeAdminCount<=1) return send(res,409,{ok:false,message:'နောက်ဆုံး admin ကို ကိုယ်တိုင်ဖြုတ်၍မရပါ။'});
      }
      const updated=await db`UPDATE users SET role=${role},updated_at=now() WHERE id=${target.id} RETURNING id,name,occupation,email,phone,role`;
      return send(res,200,{ok:true,user:safeUser(updated[0])});
    }
    if (route === '/admin/shops' && req.method === 'GET') {
      const shops=await db`SELECT id,name,discount_rate AS "discountRate",address,phone1,phone2 FROM partner_shops WHERE active=true ORDER BY sort_order,name`;
      return send(res,200,{ok:true,shops});
    }
    if (route === '/admin/listShopOrders' && req.method === 'POST') {
      const {shopId}=await readBody(req);
      const rows=await db`SELECT o.order_data,o.voucher_no,s.id AS shop_id,s.name AS shop_name FROM partner_shop_orders o JOIN partner_shops s ON s.id=o.shop_id WHERE o.shop_id=${String(shopId||'')} ORDER BY o.order_date DESC,o.updated_at DESC`;
      return send(res,200,{ok:true,orders:rows.map((row)=>({...row.order_data,'Voucher No':row.voucher_no,shopId:row.shop_id,shopName:row.shop_name}))});
    }
    if (route === '/admin/listShopOrdersByStatus' && req.method === 'POST') {
      const {status}=await readBody(req);
      if(!['unpaid','undelivered'].includes(status)) return send(res,400,{ok:false,message:'ဆိုင်အမှာစာအခြေအနေ မမှန်ပါ။'});
      const rows=await db`SELECT o.order_data,o.voucher_no,o.total,o.received,o.delivered_date,o.order_date,s.id AS shop_id,s.name AS shop_name FROM partner_shop_orders o JOIN partner_shops s ON s.id=o.shop_id WHERE s.active=true ORDER BY o.order_date DESC`;
      const orders=rows.filter((row)=>status==='unpaid'?Number(row.received)<Number(row.total):!row.delivered_date).map((row)=>({...row.order_data,'Voucher No':row.voucher_no,shopId:row.shop_id,shopName:row.shop_name}));
      return send(res,200,{ok:true,orders});
    }
    if (route === '/admin/getShopOverview' && req.method === 'POST') {
      const rows=await db`SELECT total,received,delivered_date FROM partner_shop_orders`;
      return send(res,200,{ok:true,overview:{totalOrders:rows.length,amountReceived:rows.reduce((sum,row)=>sum+Number(row.received),0),outstanding:rows.reduce((sum,row)=>sum+Math.max(0,Number(row.total)-Number(row.received)),0),undelivered:rows.filter((row)=>!row.delivered_date).length}});
    }
    if (['/admin/createShopOrder','/admin/updateShopOrder'].includes(route) && req.method === 'POST') {
      const body=await readBody(req),shopId=String(body.shopId||''),input=body.order||{};
      const shopRows=await db`SELECT id,name,discount_rate FROM partner_shops WHERE id=${shopId} AND active=true LIMIT 1`;
      if(!shopRows.length) return send(res,404,{ok:false,message:'ဆိုင်ကို ရှာမတွေ့ပါ။'});
      const shop=shopRows[0],books=await db`SELECT id,name,prices FROM books ORDER BY sort_order,id`;
      const qtyFields=['Special Qty','Practice Qty','OQ Qty','Solution Qty','G11 handbook Qty','G11 Objective Qty','G10 handbook Qty'];
      const amountFields=['Special Amount','Practice Amount','OQ Amount','Solution Amount','G11 handbook amount','G11 Objective amount','G10 handbook amount'];
      let itemCount=0,total=0;const saved={};
      for(const [index,book] of books.slice(0,7).entries()){
        const raw=String(input[qtyFields[index]]??'0').replaceAll(',','').trim(),quantity=raw?Number(raw):0;
        if(!Number.isSafeInteger(quantity)||quantity<0)return send(res,400,{ok:false,message:`${qtyFields[index]} ကို စစ်ဆေးပါ။`});
        const price=Number(book.prices[0])*(100-Number(shop.discount_rate))/100,amount=quantity*price;
        if(!Number.isSafeInteger(amount))return send(res,400,{ok:false,message:'စာအုပ်ဖိုး တွက်ချက်မှု မမှန်ပါ။'});
        itemCount+=quantity;total+=amount;saved[qtyFields[index]]=String(quantity);saved[amountFields[index]]=amount;
      }
      if(itemCount<1)return send(res,400,{ok:false,message:'စာအုပ်အနည်းဆုံး ၁ အုပ် မှာယူပါ။'});
      const date=String(input['Order Date']||'');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(`${date}T00:00:00Z`)))return send(res,400,{ok:false,message:'Order Date ကို YYYY-MM-DD ဖြည့်ပါ။'});
      const deliveredDate=String(input['Delivered Date']||'');
      if(deliveredDate&&!/^\d{4}-\d{2}-\d{2}$/.test(deliveredDate))return send(res,400,{ok:false,message:'Delivered Date ကို YYYY-MM-DD ဖြည့်ပါ။'});
      const received=Number(String(input.Received||'0').replaceAll(',',''));
      if(!Number.isSafeInteger(received)||received<0)return send(res,400,{ok:false,message:'Received ပမာဏကို စစ်ဆေးပါ။'});
      const voucher=route.endsWith('createShopOrder')?`S-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`:String(input['Voucher No']||'');
      if(!voucher)return send(res,400,{ok:false,message:'Voucher No မရှိပါ။'});
      Object.assign(saved,{'Voucher No':voucher,'Order Date':date,'Delivered Date':deliveredDate,Total:total,Received:received,'Kpay acc':String(input['Kpay acc']||''),'pay date':String(input['pay date']||''),'delivery service':String(input['delivery service']||''),'car infrom':String(input['car infrom']||''),address:String(input.address||''),'phone 1':String(input['phone 1']||''),'phone 2':String(input['phone 2']||'')});
      const result=await db`INSERT INTO partner_shop_orders(shop_id,voucher_no,order_data,total,received,order_date,delivered_date) VALUES (${shopId},${voucher},${JSON.stringify(saved)}::jsonb,${total},${received},${date},${deliveredDate||null}) ON CONFLICT(shop_id,voucher_no) DO UPDATE SET order_data=excluded.order_data,total=excluded.total,received=excluded.received,order_date=excluded.order_date,delivered_date=excluded.delivered_date,updated_at=now() RETURNING voucher_no`;
      return send(res,200,{ok:true,order:{...saved,shopId,shopName:shop.name}});
    }
    if (route === '/admin/getBookStock' && req.method === 'POST') {
      const [books,entries,delivered]=await Promise.all([
        db`SELECT id,name,quantity_header AS "quantityHeader" FROM books ORDER BY sort_order,id`,
        db`SELECT book_id,entry_date,quantity FROM book_stock_entries ORDER BY entry_date DESC`,
        db`SELECT oi.book_id,sum(oi.quantity)::int AS quantity FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status IN ('delivered','complete') GROUP BY oi.book_id`
      ]);
      const stock=books.map((book)=>{const incoming=entries.filter((e)=>e.book_id===book.id);const received=incoming.reduce((n,e)=>n+Number(e.quantity),0);const deliveredQty=Number(delivered.find((e)=>e.book_id===book.id)?.quantity||0);return{id:book.id,name:book.name,received,delivered:deliveredQty,remaining:received-deliveredQty,entries:incoming.map((e)=>({date:e.entry_date,quantity:e.quantity}))};});
      return send(res,200,{ok:true,stock});
    }
    if (route === '/admin/addBookStock' && req.method === 'POST') {
      const {stock}=await readBody(req),bookId=String(stock?.bookId||''),quantity=Number(stock?.quantity),date=String(stock?.date||'');
      if(!Number.isSafeInteger(quantity)||quantity<1||!/^\d{4}-\d{2}-\d{2}$/.test(date))return send(res,400,{ok:false,message:'ရက်စွဲနှင့် အုပ်ရေကို စစ်ဆေးပါ။'});
      const rows=await db`INSERT INTO book_stock_entries(book_id,entry_date,quantity) SELECT id,${date},${quantity} FROM books WHERE id=${bookId} RETURNING id`;
      if(!rows.length)return send(res,404,{ok:false,message:'စာအုပ်မတွေ့ပါ။'});
      const [books,entries,delivered]=await Promise.all([db`SELECT id,name FROM books ORDER BY sort_order,id`,db`SELECT book_id,entry_date,quantity FROM book_stock_entries ORDER BY entry_date DESC`,db`SELECT oi.book_id,sum(oi.quantity)::int AS quantity FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status IN ('delivered','complete') GROUP BY oi.book_id`]);
      const updated=books.map((book)=>{const incoming=entries.filter((e)=>e.book_id===book.id),received=incoming.reduce((n,e)=>n+Number(e.quantity),0),deliveredQty=Number(delivered.find((e)=>e.book_id===book.id)?.quantity||0);return{id:book.id,name:book.name,received,delivered:deliveredQty,remaining:received-deliveredQty,entries:incoming.map((e)=>({date:e.entry_date,quantity:e.quantity}))};});
      return send(res,201,{ok:true,entry:{bookId,date,quantity},stock:updated});
    }
    if ((route==='/admin/importRoyalShipmentExport'||route==='/admin/syncRoyalShipments')&&req.method==='POST') {
      const body=await readBody(req),entries=body.entries||body.waybills;
      if(!Array.isArray(entries)||entries.length<1||entries.length>1000)return send(res,400,{ok:false,message:'Royal waybill ၁ မှ ၁,၀၀၀ ခုအထိ ထည့်ပါ။'});
      const seen=new Set();
      for(const entry of entries){const key=String(entry.waybillNo||'').trim().toUpperCase();if(!key||seen.has(key))return send(res,400,{ok:false,message:'Waybill နံပါတ် မရှိခြင်း သို့မဟုတ် ထပ်နေခြင်းရှိသည်။'});seen.add(key);if(!Number.isSafeInteger(Number(entry.serviceCharge))||Number(entry.serviceCharge)<0||!Number.isSafeInteger(Number(entry.cod))||Number(entry.cod)<0||!Number.isFinite(Number(entry.weight))||Number(entry.weight)<0)return send(res,400,{ok:false,message:'Royal အလေးချိန်/ခ/ငွေကို စစ်ဆေးပါ။'});}
      const orders=await db`SELECT id,phone,phone2,delivery_service,created_at,royal_data,admin_data FROM orders WHERE lower(delivery_service) LIKE 'royal%' ORDER BY created_at`;
      const results=[];
      for(const entry of entries){const waybillNo=String(entry.waybillNo).trim(),key=waybillNo.toUpperCase(),phones=royalPhoneCandidates(entry.receiver);let order=orders.find((candidate)=>String(candidate.royal_data?.waybillNo||'').toUpperCase()===key);let outcome='already-linked';
        if(order){const orderPhones=[...royalPhoneCandidates(order.phone),...royalPhoneCandidates(order.phone2)];if(phones.length&&!phones.some((phone)=>orderPhones.includes(phone))){results.push({waybillNo,result:'phone-mismatch',message:'ဖုန်းနံပါတ် မကိုက်ညီပါ။'});continue;}}
        else{const candidates=orders.filter((candidate)=>!candidate.royal_data?.waybillNo&&phones.some((phone)=>[...royalPhoneCandidates(candidate.phone),...royalPhoneCandidates(candidate.phone2)].includes(phone)));order=candidates[0];outcome=order?'linked':'unmatched';if(!order){results.push({waybillNo,result:outcome,message:phones.length?'ကိုက်ညီသော Royal order မတွေ့ပါ။':'Receiver ထဲတွင် Myanmar mobile ဖုန်းမတွေ့ပါ။'});continue;}}
        const royal={...(order.royal_data||{}),waybillNo,serviceCharge:Number(entry.serviceCharge),cod:Number(entry.cod),weight:Number(entry.weight),state:String(entry.state||''),waybillDate:String(entry.waybillDate||'')};
        const extra={...(order.admin_data||{}),'Royal Voucher':waybillNo,'Royal Shipment Service Charge':String(entry.serviceCharge),'Royal Shipment COD Amount':String(entry.cod),'Royal Shipment Weight':String(entry.weight),'Delivery Notes':String(entry.state||'')};
        await db`UPDATE orders SET royal_data=${JSON.stringify(royal)}::jsonb,admin_data=${JSON.stringify(extra)}::jsonb,updated_at=now() WHERE id=${order.id}`;
        results.push({waybillNo,phone:phones[0]||'',result:outcome,orderVoucher:order.admin_data?.['Voucher No']||'',message:outcome==='linked'?'ဖုန်းနံပါတ်ဖြင့် ချိတ်ဆက်ပြီးပါပြီ။':'ရှိပြီးသား Royal voucher အချက်အလက်ကို ပြန်လည်ပြင်ဆင်ပြီးပါပြီ။',serviceCharge:String(entry.serviceCharge),cod:String(entry.cod),weight:Number(entry.weight)});
      }
      return send(res,200,{ok:true,results,updatedCount:results.filter((r)=>['linked','already-linked'].includes(r.result)).length,unmatchedCount:results.filter((r)=>r.result==='unmatched'||r.result==='phone-mismatch').length,duplicateCount:0});
    }
    if(route==='/admin/importRoyalStatementExport'&&req.method==='POST'){
      const body=await readBody(req),entries=body.entries;
      if(!Array.isArray(entries)||entries.length<1||entries.length>1000)return send(res,400,{ok:false,message:'Royal statement ၁ မှ ၁,၀၀၀ rows အထိ ထည့်ပါ။'});
      const seen=new Set(),results=[];
      for(const entry of entries){const waybillNo=String(entry.waybillNo||'').trim(),key=waybillNo.toUpperCase(),codCharges=Number(entry.codCharges),paidCharges=Number(entry.paidCharges);if(!key||seen.has(key)||!Number.isSafeInteger(codCharges)||codCharges<0||!Number.isSafeInteger(paidCharges)||paidCharges<0)return send(res,400,{ok:false,message:'Statement row ထပ်နေသည် သို့မဟုတ် ငွေပမာဏ မမှန်ပါ။'});seen.add(key);const rows=await db`SELECT id,royal_data FROM orders WHERE upper(royal_data->>'waybillNo')=${key} LIMIT 2`;if(rows.length!==1){results.push({waybillNo,result:'unmatched',message:'ကိုက်ညီသော Royal voucher မတွေ့ပါ။'});continue;}const royal={...(rows[0].royal_data||{}),codCharges,paidCharges,paidDate:String(entry.paidDate||'')};const extra={...royal,'Royal Statement COD Charge':String(codCharges),'Royal Statement Paid Charge':String(paidCharges),'Royal Statement Paid Date':String(entry.paidDate||'')};await db`UPDATE orders SET royal_data=${JSON.stringify(royal)}::jsonb,admin_data=admin_data||${JSON.stringify(extra)}::jsonb,updated_at=now() WHERE id=${rows[0].id}`;results.push({waybillNo,result:'linked',message:'Royal statement အချက်အလက် သိမ်းပြီးပါပြီ။'});}
      return send(res,200,{ok:true,results,updatedCount:results.filter((r)=>r.result==='linked').length,unmatchedCount:results.filter((r)=>r.result==='unmatched').length,duplicateCount:0});
    }
    if (route === '/admin/feedback' && req.method === 'GET') {
      const feedbackRows=await db`SELECT id,user_id,name,phone,message,status,created_at FROM feedback ORDER BY created_at DESC`;
      return send(res,200,{ok:true,feedback:feedbackRows.map((f)=>({id:f.id,userId:f.user_id,name:f.name,phone:f.phone,...(JSON.parse(f.message||'{}')),status:f.status,createdAt:f.created_at}))});
    }
    if (route === '/admin/announcements' && req.method === 'GET') {
      const rows=await db`SELECT id,title,body,active,publish_at FROM announcements ORDER BY created_at DESC`;
      return send(res,200,{ok:true,announcements:rows});
    }
    if (route === '/admin/announcements' && req.method === 'POST') {
      const body=await readBody(req);
      const title=String(body.title||'').trim(), content=String(body.body||'').trim();
      if(!title||!content)return send(res,400,{ok:false,message:'ခေါင်းစဉ်နှင့် ကြေညာချက်စာသား ဖြည့်ပါ။'});
      const rows=await db`INSERT INTO announcements(title,body,active) VALUES (${title},${content},false) RETURNING id,title,body,active,publish_at`;
      return send(res,201,{ok:true,announcement:rows[0]});
    }
    if (route === '/admin/announcements' && req.method === 'PUT') {
      const body=await readBody(req),title=String(body.title||'').trim(),content=String(body.body||'').trim();
      if(!title||!content)return send(res,400,{ok:false,message:'ခေါင်းစဉ်နှင့် ကြေညာချက်စာသား ဖြည့်ပါ။'});
      const rows=await db`UPDATE announcements SET title=${title},body=${content} WHERE id=${String(body.id||'')} RETURNING id,title,body,active,publish_at`;
      if(!rows.length)return send(res,404,{ok:false,message:'ကြေညာချက်မတွေ့ပါ။'});
      return send(res,200,{ok:true,announcement:rows[0]});
    }
    if (route === '/admin/announcements' && req.method === 'PATCH') {
      const body=await readBody(req),id=String(body.id||''),active=body.active===true;
      if(active){const rows=await db`SELECT count(*)::int AS count FROM announcements WHERE active=true AND publish_at<=now()`;if(Number(rows[0]?.count||0)>=3)return send(res,409,{ok:false,message:'Customer app တွင် တစ်ချိန်တည်း ကြေညာချက် ၃ ခုသာ ပြနိုင်ပါသည်။ အရင်တစ်ခုကို ပိတ်ပြီးမှ ထပ်ရွေးပါ။'});}
      const rows=await db`UPDATE announcements SET active=${active},publish_at=CASE WHEN ${active} THEN now() ELSE publish_at END WHERE id=${id} RETURNING id,title,body,active,publish_at`;
      if(!rows.length)return send(res,404,{ok:false,message:'ကြေညာချက်မတွေ့ပါ။'});
      return send(res,200,{ok:true,announcement:rows[0]});
    }
    if (route === '/admin/announcements' && req.method === 'DELETE') {
      const body=await readBody(req);
      const rows=await db`DELETE FROM announcements WHERE id=${String(body.id||'')} RETURNING id`;
      if(!rows.length) return send(res,404,{ok:false,message:'ကြေညာချက်မတွေ့ပါ။'});
      return send(res,200,{ok:true});
    }
    return send(res,404,{ok:false,message:'Endpoint မတွေ့ပါ။'});
  } catch (error) {
    console.error('API request failed:', error);
    return send(res,500,{ok:false,message:'ဝန်ဆောင်မှုတွင် ပြဿနာရှိနေပါသည်။'});
  }
}
