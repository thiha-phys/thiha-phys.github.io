import { neon } from '@neondatabase/serverless';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
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
    if (route === '/health' && req.method === 'GET') return send(res, 200, { ok: true });

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

    if (route === '/orders' && req.method === 'POST') {
      const user = await getUser(req, db);
      if (!user) return send(res, 401, { ok:false, code:'AUTH_REQUIRED', message:'အကောင့်ဝင်ပြီးမှ မှာယူနိုင်ပါသည်။' });
      if(user.role!=='admin'&&user.approval_status!=='approved') return send(res,403,{ok:false,code:user.approval_status==='rejected'?'ACCOUNT_REJECTED':'ACCOUNT_PENDING',message:'အကောင့်အသုံးပြုခွင့်အတွက် admin အတည်ပြုချက်ကို စောင့်ဆိုင်းနေပါသည်။'});
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
      const baseFee=service==='Royal'?(packages-1)*(Number(city.up_to_2kg)+3*Number(city.next_kg))+Number(city.up_to_2kg)+extraKg*Number(city.next_kg)+serviceFee:0;
      const deliveryFee=service==='Royal'?Math.ceil(baseFee/500-0.000000001)*500:0;
      const total=subtotal+deliveryFee;
      if(payment==='COD' && total>=Number(settings.codMaxTotal ?? 150000)) return send(res,400,{ok:false,code:'COD_LIMIT',message:'စုစုပေါင်းပမာဏအတွက် KBZ Pay ကိုသာ ရွေးချယ်နိုင်ပါသည်။'});
      if(!String(order.address||'').trim() || !String(order.name||user.name).trim() || !String(order.phone||user.phone).trim()) return send(res,400,{ok:false,code:'MISSING_ORDER_DETAILS',message:'အမည်၊ ဖုန်းနှင့် လိပ်စာ ဖြည့်ပါ။'});
      const created = await db`WITH next_number AS (SELECT nextval('orders_order_no_seq') AS order_no)
        INSERT INTO orders (order_no,voucher_no,user_id,customer_name,phone,phone2,city_id,address,delivery_service,payment_method,car_details,status)
        SELECT order_no,lpad(order_no::text,3,'0'),${user.id},${String(order.name || user.name).trim()},${String(order.phone || user.phone).trim()},${String(order.phone2 || '').trim()},${city.id},${String(order.address || '').trim()},${service},${payment},${String(order.carDetails || '').trim()},'new' FROM next_number
        RETURNING id, voucher_no,order_no`;
      for(const item of preparedItems) await db`INSERT INTO order_items(order_id,book_id,book_name,quantity,unit_price,amount,weight_kg) VALUES (${created[0].id},${item.book.id},${item.book.name},${item.quantity},${item.unitPrice},${item.amount},${Number(item.book.weight)})`;
      await db`UPDATE orders SET subtotal=${subtotal},delivery_fee=${deliveryFee},total=${total},total_weight_kg=${kg},cash_collection=${payment==='COD'?total:0} WHERE id=${created[0].id}`;
      const resultOrder={voucherNo:created[0].voucher_no,name:String(order.name || user.name),phone:String(order.phone || user.phone),phone2:String(order.phone2 || ''),city:city.label,address:`${city.label}, ${String(order.address || '').trim()}`,orderDate:new Date().toISOString(),paymentMethod:payment,total:subtotal,deliveryService:service,deliveryFees:deliveryFee,payableTotal:total,totalKg:kg,cashCollection:payment==='COD'?total:0,carInfo:String(order.carDetails || ''),items:preparedItems.map((item)=>({id:item.book.id,name:item.book.name,quantity:item.quantity,unitPrice:item.unitPrice,amount:item.amount}))};
      const telegramNotified=await notifyTelegram(resultOrder);
      return send(res, 201, { ok:true, orderId:created[0].voucher_no, order:resultOrder,telegramNotified });
    }

    const user = await getUser(req, db);
    if (!user) return send(res, 401, {ok:false,code:'AUTH_REQUIRED',message:'အကောင့်ဝင်ရန်လိုအပ်ပါသည်။'});
    if (route === '/auth/me' && req.method === 'GET') return send(res,200,{ok:true,user:safeUser(user)});
    if(user.role!=='admin' && user.approval_status!=='approved' && route!=='/auth/logout') return send(res,403,{ok:false,code:user.approval_status==='rejected'?'ACCOUNT_REJECTED':'ACCOUNT_PENDING',message:user.approval_status==='rejected'?'သင့်အကောင့်ကို အတည်မပြုနိုင်ပါ။':'အကောင့်အသုံးပြုခွင့်အတွက် admin အတည်ပြုချက်ကို စောင့်ဆိုင်းနေပါသည်။'});
    if (route.startsWith('/admin/') && user.role !== 'admin') return send(res,403,{ok:false,code:'ADMIN_REQUIRED',message:'ဤလုပ်ဆောင်ချက်ကို admin သာ အသုံးပြုနိုင်ပါသည်။'});
    if (route === '/orders' && req.method === 'GET') {
      const rows=await db`SELECT o.id,o.voucher_no,o.customer_name,o.phone,o.city_id,c.label AS city_label,o.address,o.delivery_service,o.payment_method,o.subtotal,o.delivery_fee,o.total,o.total_weight_kg,o.cash_collection,o.status,o.created_at
        FROM orders o JOIN delivery_cities c ON c.id=o.city_id WHERE o.user_id=${user.id} ORDER BY o.created_at DESC LIMIT 100`;
      const orders=await Promise.all(rows.map(async(order)=>{
        const items=await db`SELECT book_id AS id,book_name AS name,quantity,unit_price AS "unitPrice",amount FROM order_items WHERE order_id=${order.id} ORDER BY id`;
        return {voucherNo:order.voucher_no,name:order.customer_name,phone:order.phone,city:order.city_label,address:order.address,deliveryService:order.delivery_service,paymentMethod:order.payment_method,subtotal:order.subtotal,deliveryFee:order.delivery_fee,total:order.total,totalWeightKg:order.total_weight_kg,cashCollection:order.cash_collection,status:order.status,createdAt:order.created_at,items};
      }));
      return send(res,200,{ok:true,orders});
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

    if (route === '/admin/orders' && req.method === 'GET') {
      const orders=await db`SELECT o.*,c.english AS city_english,c.label AS city_label FROM orders o JOIN delivery_cities c ON c.id=o.city_id ORDER BY o.created_at DESC`;
      const items=await db`SELECT oi.order_id,oi.book_id,oi.quantity,oi.amount,b.quantity_header,b.amount_header FROM order_items oi LEFT JOIN books b ON b.id=oi.book_id ORDER BY oi.book_name`;
      return send(res,200,{ok:true,orders:orders.map((o)=>{const extra={...(o.admin_data||{}),...(o.royal_data||{})};const orderItems=items.filter((i)=>i.order_id===o.id);return{...extra,'Voucher No':o.voucher_no,Name:o.customer_name,Address:extra.Address||`${o.city_label}, ${o.address}`,'Phone 1':o.phone,'Phone 2':o.phone2,'Ordered Date':extra['Ordered Date']||o.created_at.toISOString(),Total:String(o.subtotal),'Payment Method':o.payment_method,Received:extra.Received??(o.status==='received'?'Yes':''),'Deliver Date':extra['Deliver Date']||(o.status==='delivered'?o.updated_at.toISOString().slice(0,10):''),status:o.status,'Delivery Service':o.delivery_service,'Delivery Fees':String(o.delivery_fee),'Total KG':String(o.total_weight_kg),'Cash Collection':String(o.cash_collection),'Delivery Notes':extra['Delivery Notes']||o.car_details,...Object.fromEntries(orderItems.flatMap((i)=>[[i.quantity_header||`${i.book_id} Qty`,String(i.quantity)],[i.amount_header||`${i.book_id} Amount`,String(i.amount)]]))};})});
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
        'Cash Collection':String(prior.cash_collection),'Delivery Notes':prior.car_details,...itemData,...(prior.admin_data||{}),...order
      };
      const delivered=String(order['Deliver Date']||order['Delivered Date']||'').trim();
      const receivedValue=Number(String(adminData.Received??'0').replaceAll(',',''));
      const subtotalValue=Number(String(adminData.Total??prior.subtotal).replaceAll(',',''));
      const feeValue=Number(String(adminData['Delivery Fees']??prior.delivery_fee).replaceAll(',',''));
      const weightValue=Number(String(adminData['Total KG']??prior.total_weight_kg).replaceAll(',',''));
      if(!Number.isSafeInteger(receivedValue)||receivedValue<0||!Number.isSafeInteger(subtotalValue)||subtotalValue<0||!Number.isSafeInteger(feeValue)||feeValue<0||!Number.isFinite(weightValue)||weightValue<0) return send(res,400,{ok:false,message:'ငွေပမာဏနှင့် အလေးချိန် အချက်အလက်ကို စစ်ဆေးပါ။'});
      const status=String(order.status || (delivered?'delivered':receivedValue>0?'received':prior.status));
      const rawAddress=String(adminData.Address??prior.address);
      const addressPrefix=`${prior.city_label}, `;
      const dbAddress=rawAddress.startsWith(addressPrefix)?rawAddress.slice(addressPrefix.length):rawAddress;
      const payment=String(adminData['Payment Method']||prior.payment_method);
      const service=String(adminData['Delivery Service']||prior.delivery_service);
      const cashValue=Number(String(adminData['Cash Collection']??(payment==='COD'?subtotalValue+feeValue:0)).replaceAll(',',''));
      const books=await db`SELECT id,name,quantity_header,amount_header,weight FROM books ORDER BY sort_order,id`;
      const itemRows=[];
      for(const book of books){const quantity=Number(String(adminData[book.quantity_header]??'0').replaceAll(',',''));if(!Number.isSafeInteger(quantity)||quantity<0)return send(res,400,{ok:false,message:`${book.quantity_header} အချက်အလက် မမှန်ပါ။`});if(quantity<1)continue;const amountRaw=adminData[book.amount_header];const amount=amountRaw==null||amountRaw===''?0:Number(String(amountRaw).replaceAll(',',''));if(!Number.isSafeInteger(amount)||amount<0)return send(res,400,{ok:false,message:`${book.amount_header} အချက်အလက် မမှန်ပါ။`});itemRows.push({book,quantity,amount,unitPrice:Math.floor(amount/quantity)});}
      const rows=await db`UPDATE orders SET customer_name=${String(adminData.Name??prior.customer_name)},phone=${String(adminData['Phone 1']??prior.phone)},phone2=${String(adminData['Phone 2']??prior.phone2)},address=${dbAddress},payment_method=${payment},delivery_service=${service},delivery_fee=${feeValue},subtotal=${subtotalValue},total=${subtotalValue+feeValue},total_weight_kg=${weightValue},cash_collection=${Number.isSafeInteger(cashValue)&&cashValue>=0?cashValue:0},status=${status},admin_note=${String(order.adminNote||prior.admin_note||'')},admin_data=${JSON.stringify(adminData)}::jsonb,updated_at=now() WHERE voucher_no=${voucher} RETURNING id,voucher_no`;
      await db`DELETE FROM order_items WHERE order_id=${rows[0].id}`;
      for(const item of itemRows) await db`INSERT INTO order_items(order_id,book_id,book_name,quantity,unit_price,amount,weight_kg) VALUES (${rows[0].id},${item.book.id},${item.book.name},${item.quantity},${item.unitPrice},${item.amount},${Number(item.book.weight)})`;
      return send(res,200,{ok:true,order});
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
        db`SELECT oi.book_id,sum(oi.quantity)::int AS quantity FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status='delivered' GROUP BY oi.book_id`
      ]);
      const stock=books.map((book)=>{const incoming=entries.filter((e)=>e.book_id===book.id);const received=incoming.reduce((n,e)=>n+Number(e.quantity),0);const deliveredQty=Number(delivered.find((e)=>e.book_id===book.id)?.quantity||0);return{id:book.id,name:book.name,received,delivered:deliveredQty,remaining:received-deliveredQty,entries:incoming.map((e)=>({date:e.entry_date,quantity:e.quantity}))};});
      return send(res,200,{ok:true,stock});
    }
    if (route === '/admin/addBookStock' && req.method === 'POST') {
      const {stock}=await readBody(req),bookId=String(stock?.bookId||''),quantity=Number(stock?.quantity),date=String(stock?.date||'');
      if(!Number.isSafeInteger(quantity)||quantity<1||!/^\d{4}-\d{2}-\d{2}$/.test(date))return send(res,400,{ok:false,message:'ရက်စွဲနှင့် အုပ်ရေကို စစ်ဆေးပါ။'});
      const rows=await db`INSERT INTO book_stock_entries(book_id,entry_date,quantity) SELECT id,${date},${quantity} FROM books WHERE id=${bookId} RETURNING id`;
      if(!rows.length)return send(res,404,{ok:false,message:'စာအုပ်မတွေ့ပါ။'});
      const [books,entries,delivered]=await Promise.all([db`SELECT id,name FROM books ORDER BY sort_order,id`,db`SELECT book_id,entry_date,quantity FROM book_stock_entries ORDER BY entry_date DESC`,db`SELECT oi.book_id,sum(oi.quantity)::int AS quantity FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status='delivered' GROUP BY oi.book_id`]);
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
      const feedbackRows=await db`SELECT id,name,phone,message,status,created_at FROM feedback ORDER BY created_at DESC`;
      return send(res,200,{ok:true,feedback:feedbackRows.map((f)=>({id:f.id,name:f.name,phone:f.phone,...(JSON.parse(f.message||'{}')),status:f.status,createdAt:f.created_at}))});
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
