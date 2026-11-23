(function () {
    const API_URL = 'https://uthk-physics-api.vercel.app';
    if (!sessionStorage.getItem('physicsLearningHubSession') && !location.pathname.endsWith('/login.html')) {
        location.replace(new URL('../login.html', document.currentScript.src).href);
        return;
    }
    const DB_NAME = 'uthk-admin-cache';
    const DB_VERSION = 1;
    const CACHE_STORE = 'snapshots';
    const ADMIN_API_SCRIPT = document.currentScript.src;
    const ORDER_FIELD_ALIASES = {
        Phone: 'Phone 1',
        'Order Date': 'Ordered Date',
        'Delivered Date': 'Deliver Date',
        'Order Confirm': 'Deliver Date',
        'Old Questions Qty': 'OQ Qty',
        'Old Questions Amount': 'OQ Amount',
        'Grade 11 Handbook Qty': 'G11 Handbook Qty',
        'Grade 11 Handbook Amount': 'G11 Handbook Amount',
        'Grade 11 Objective Qty': 'G11 Objective Qty',
        'Grade 11 Objective Amount': 'G11 Objective Amount',
        'Grade 10 Handbook Qty': 'G10 Handbook Qty',
        'Grade 10 Handbook Amount': 'G10 Handbook Amount',
        'Amount Received': 'Received',
        'Royal VOC No': 'Royal Voucher',
        Delivery: 'Delivery Service',
        'Facebook Account Name': 'Facebook Name',
        'Confirm Service Charge': 'Royal Shipment Service Charge',
        'Confirm Service COD': 'Royal Shipment COD Amount',
        'Royal Statement COD Charges': 'Royal Statement COD Charge',
        'Royal Statement Paid Charges': 'Royal Statement Paid Charge'
    };

    function normalizeOrder(order) {
        const normalized = { ...order };
        Object.entries(ORDER_FIELD_ALIASES).forEach(([alias, canonical]) => {
            if (!Object.prototype.hasOwnProperty.call(normalized, canonical) &&
                Object.prototype.hasOwnProperty.call(normalized, alias)) {
                normalized[canonical] = normalized[alias];
            }
            if (Object.prototype.hasOwnProperty.call(normalized, canonical)) {
                normalized[alias] = normalized[canonical];
            }
        });
        return normalized;
    }

    function openCache() {
        return new Promise((resolve, reject) => {
            const opening = indexedDB.open(DB_NAME, DB_VERSION);
            opening.onupgradeneeded = () => {
                if (!opening.result.objectStoreNames.contains(CACHE_STORE)) {
                    opening.result.createObjectStore(CACHE_STORE);
                }
            };
            opening.onsuccess = () => resolve(opening.result);
            opening.onerror = () => reject(opening.error || new Error('Unable to open the local cache.'));
        });
    }

    async function readCache(key) {
        const database = await openCache();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(CACHE_STORE, 'readonly');
            const request = transaction.objectStore(CACHE_STORE).get(key);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || new Error('Unable to read the local cache.'));
            transaction.oncomplete = () => database.close();
            transaction.onerror = () => {
                database.close();
                reject(transaction.error || new Error('Unable to read the local cache.'));
            };
        });
    }

    async function writeCache(key, value) {
        const database = await openCache();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(CACHE_STORE, 'readwrite');
            transaction.objectStore(CACHE_STORE).put(value, key);
            transaction.oncomplete = () => {
                database.close();
                resolve();
            };
            transaction.onerror = () => {
                database.close();
                reject(transaction.error || new Error('Unable to save the local cache.'));
            };
            transaction.onabort = () => {
                database.close();
                reject(transaction.error || new Error('The local cache update was cancelled.'));
            };
        });
    }

    async function request(action, payload = {}) {
        const route = action === 'listOrders' ? 'admin/orders' : action === 'updateOrder' ? 'admin/orders' : action === 'createOrder' ? 'orders' : `admin/${action}`;
        const method = action === 'listOrders' ? 'GET' : action === 'updateOrder' ? 'PATCH' : 'POST';
        const response = await fetch(`${API_URL}/api/${route}`, {
            method,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('physicsLearningHubSession') || ''}` },
            ...(method === 'GET' ? {} : { body: JSON.stringify(payload) })
        });
        if (!response.ok) throw new Error(`Database API request failed (${response.status}).`);
        const result = await response.json();
        if (!result.ok) throw new Error(result.message || 'Database API rejected the request.');
        return result;
    }

    async function requestProfile(action, payload = {}) {
        const route = ['listProfiles', 'updateUserRole', 'updateUserApproval'].includes(action) ? 'admin/users' : 'admin/feedback';
        const method = ['updateUserRole', 'updateUserApproval'].includes(action) ? 'PATCH' : 'GET';
        const response = await fetch(`${API_URL}/api/${route}`, {
            method,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('physicsLearningHubSession') || ''}` },
            ...(method === 'GET' ? {} : { body: JSON.stringify(payload) })
        });
        if (!response.ok) throw new Error(`Database API request failed (${response.status}).`);
        const result = await response.json();
        if (!result.ok) throw new Error(result.message || 'Database API rejected the request.');
        return result;
    }

    async function getMasterData() {
        const response = await fetch(`${API_URL}/api/admin/master-data`, { cache: 'no-store', headers: { Authorization: `Bearer ${sessionStorage.getItem('physicsLearningHubSession') || ''}` } });
        if (!response.ok) throw new Error(`Master data request failed (${response.status}).`);
        const result = await response.json();
        const masterData = result.masterData;
        if (!masterData || !masterData.settings || !masterData.books || !masterData.deliveryCities) {
            throw new Error('Order master data is missing or incomplete.');
        }
        if (masterData.schemaVersion !== 1) {
            throw new Error('This admin version does not support the master data format.');
        }
        window.AdminMasterData = masterData;
        window.AdminBooks = (Array.isArray(masterData.books)
            ? masterData.books
            : Object.entries(masterData.books).map(([id, book]) => ({ ...book, id: book.id || id })))
            .filter((book) => book && book.active !== false)
            .map((book) => {
                const safePrice = book && book.price !== null && book.price !== undefined
                    ? book.price
                    : (book && book.prices && book.prices.length ? book.prices[0] : 0);
                return { ...book, price: Number(safePrice) };
            });
        return masterData;
    }

    async function saveMasterData(masterData) {
        const { priceThresholds, royalServiceFee, codMaxTotal } = masterData.settings || {};
        if (!Array.isArray(priceThresholds) || !priceThresholds.length ||
            priceThresholds[0] !== 0 ||
            priceThresholds.some((value, index) =>
                !Number.isSafeInteger(value) || value < 0 ||
                (index > 0 && value <= priceThresholds[index - 1])) ||
            !Number.isSafeInteger(royalServiceFee) || royalServiceFee < 0 ||
            !Number.isSafeInteger(codMaxTotal) || codMaxTotal < 0) {
            throw new Error('အထွေထွေ သတ်မှတ်ချက်များကို စစ်ဆေးပါ။ ဈေးနှုန်းအဆင့်များသည် 0 မှစ၍ အစဉ်လိုက်ဖြစ်ရပါမည်။');
        }
        const books = Object.entries(masterData.books || {});
        const cities = Object.entries(masterData.deliveryCities || {});
        if (!books.length || !cities.length) {
            throw new Error('စာအုပ်နှင့် ပို့ဆောင်မည့်မြို့ အနည်းဆုံးတစ်ခုစီ လိုအပ်ပါသည်။');
        }
        books.forEach(([id, book]) => {
            if (!book || book.id !== id || !book.name || !book.image ||
                !Array.isArray(book.prices) || book.prices.length !== priceThresholds.length ||
                book.prices.some((price) => !Number.isSafeInteger(price) || price < 0) ||
                !Number.isFinite(book.weight) || book.weight <= 0) {
                throw new Error(`စာအုပ်အချက်အလက် မမှန်ပါ: ${id}`);
            }
        });
        cities.forEach(([id, city]) => {
            if (!city || city.id !== id || !city.english || !city.myanmar ||
                !Number.isFinite(city.upTo2Kg) || city.upTo2Kg < 0 ||
                !Number.isFinite(city.nextKg) || city.nextKg < 0) {
                throw new Error(`မြို့အချက်အလက် မမှန်ပါ: ${id}`);
            }
        });

        const savedMasterData = {
            schemaVersion: 1,
            updatedAt: new Date().toISOString(),
            settings: masterData.settings,
            books: masterData.books,
            deliveryCities: masterData.deliveryCities
        };
        const response = await fetch(`${API_URL}/api/admin/master-data`, { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${sessionStorage.getItem('physicsLearningHubSession') || ''}` }, body:JSON.stringify({masterData:savedMasterData}) });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.message || 'Master data could not be saved.');

        window.AdminMasterData = savedMasterData;
        window.AdminBooks = (Array.isArray(savedMasterData.books)
            ? savedMasterData.books
            : Object.entries(savedMasterData.books).map(([id, book]) => ({ ...book, id: book.id || id })))
            .filter((book) => book && book.active !== false)
            .map((book) => {
                const safePrice = book && book.price !== null && book.price !== undefined
                    ? book.price
                    : (book && book.prices && book.prices.length ? book.prices[0] : 0);
                return { ...book, price: Number(safePrice) };
            });
        return result.masterData || savedMasterData;
    }

    async function getDeliveryCities() {
        const masterData = await getMasterData();
        return Object.values(masterData.deliveryCities);
    }

    async function refreshOrders() {
        const result = await request('listOrders');
        const snapshot = {
            data: result.orders.map(normalizeOrder),
            updatedAt: new Date().toISOString()
        };
        try { await writeCache('orders', snapshot); } catch (error) { console.warn('Local order cache unavailable; showing database results.', error); }
        return snapshot;
    }

    async function getCachedOrders() {
        const snapshot = await readCache('orders');
        return snapshot
            ? { ...snapshot, data: snapshot.data.map(normalizeOrder) }
            : null;
    }

    async function saveOrders(orders) {
        const snapshot = {
            data: orders.map(normalizeOrder),
            updatedAt: new Date().toISOString()
        };
        await writeCache('orders', snapshot);
        return snapshot;
    }

    function createDatabaseOrder(resultOrder) {
        const row = {
            'Voucher No': resultOrder.voucherNo,
            Name: resultOrder.name,
            Address: resultOrder.address,
            'Phone 1': resultOrder.phone,
            'Phone 2': resultOrder.phone2 || '',
            'Ordered Date': resultOrder.orderDate,
            Total: String(resultOrder.total),
            'Payment Method': resultOrder.paymentMethod,
            Received: '',
            'Deliver Date': '',
            'Delivery Service': resultOrder.deliveryService || '',
            'Delivery Fees': String(resultOrder.deliveryFees || 0),
            'Total KG': String(resultOrder.totalKg || 0),
            'Cash Collection': String(resultOrder.cashCollection || 0),
            'Delivery Notes': resultOrder.deliveryNotes || ''
        };
        const itemById = new Map(resultOrder.items.map((item) => [item.id, item]));
        AdminBooks.forEach((book) => {
            const item = itemById.get(book.id);
            if (!item) throw new Error(`The saved order is missing ${book.id}.`);
            row[book.quantityHeader || `${book.id} Qty`] = String(item.quantity);
            row[book.amountHeader || `${book.id} Amount`] = String(item.amount);
        });
        return normalizeOrder(row);
    }

    async function createOrder(order) {
        const result = await request('createOrder', { order });
        try {
            const cached = await getCachedOrders();
            if (!cached) {
                result.cacheNeedsRefresh = true;
            } else {
                const orders = cached.data.slice();
                orders.unshift(createDatabaseOrder(result.order));
                await saveOrders(orders);
            }
        } catch (error) {
            console.error('Order was saved to the database, but the local cache could not be updated.', error);
            result.localCacheError = true;
        }
        return result;
    }

    async function updateOrder(order) {
        const result = await request('updateOrder', { order });
        result.order = normalizeOrder(result.order);
        try {
            const cached = await getCachedOrders();
            if (!cached) {
                result.cacheNeedsRefresh = true;
            } else {
                const orders = cached.data.slice();
                const index = orders.findIndex((item) => item['Voucher No'] === order.voucherNo);
                if (index < 0) orders.unshift(result.order);
                else orders[index] = result.order;
                await saveOrders(orders);
            }
        } catch (error) {
            console.error('Order was updated in the database, but the local cache could not be updated.', error);
            result.localCacheError = true;
        }
        return result;
    }

    function importRoyalShipmentExport(entries) {
        return request('importRoyalShipmentExport', { entries });
    }

    function importRoyalStatementExport(entries) {
        return request('importRoyalStatementExport', { entries });
    }

    async function getShops() {
        const response=await fetch(`${API_URL}/api/admin/shops`,{headers:{Authorization:`Bearer ${sessionStorage.getItem('physicsLearningHubSession')||''}`}});
        const result=await response.json();
        if(!response.ok||!result.ok)throw new Error(result.message||'ဆိုင်စာရင်းကို ရယူမရပါ။');
        return result.shops||[];
    }

    async function getBookstores() {
        const response = await fetch(`${API_URL}/api/admin/bookstores`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('physicsLearningHubSession') || ''}` } });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.message || 'Bookstores could not be loaded.');
        return result.bookstores;
    }

    async function saveBookstores(bookstores) {
        const response = await fetch(`${API_URL}/api/admin/bookstores`, { method:'PUT', headers:{'Content-Type':'application/json',Authorization:`Bearer ${sessionStorage.getItem('physicsLearningHubSession') || ''}`}, body:JSON.stringify({bookstores}) });
        const result=await response.json();
        if(!response.ok || !result.ok) throw new Error(result.message || 'Bookstores could not be saved.');
        return result.bookstores;
    }

    async function getAnnouncements() {
        const response=await fetch(`${API_URL}/api/admin/announcements`,{headers:{Authorization:`Bearer ${sessionStorage.getItem('physicsLearningHubSession')||''}`}});
        const result=await response.json();
        if(!response.ok||!result.ok)throw new Error(result.message||'ကြေညာချက်များကို ရယူမရပါ။');
        return result.announcements||[];
    }

    async function saveAnnouncement(title,body) {
        const response=await fetch(`${API_URL}/api/admin/announcements`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${sessionStorage.getItem('physicsLearningHubSession')||''}`},body:JSON.stringify({title,body})});
        const result=await response.json();
        if(!response.ok||!result.ok)throw new Error(result.message||'ကြေညာချက်ကို သိမ်းမရပါ။');
        return result.announcement;
    }

    async function getProfiles() {
        const result = await requestProfile('listProfiles');
        if (!Array.isArray(result.profiles)) {
            throw new Error('The profile list returned by the profile backend is invalid.');
        }
        return result.profiles;
    }

    async function updateUserRole(userId, role) {
        return requestProfile('updateUserRole', { userId, role });
    }

    async function updateUserApproval(userId, approvalStatus) {
        return requestProfile('updateUserApproval', { userId, approvalStatus });
    }

    async function getFeedback() {
        const result = await requestProfile('listFeedback');
        if (!Array.isArray(result.feedback)) {
            throw new Error('The feedback list returned by the profile backend is invalid.');
        }
        return result.feedback;
    }

    async function getShopOrders(shopId) {
        const result = await request('listShopOrders', { shopId });
        if (!Array.isArray(result.orders)) {
            throw new Error('The shop order list returned by the database is invalid.');
        }
        return result.orders;
    }

    async function getShopOrdersByStatus(status) {
        if (!['undelivered', 'unpaid'].includes(status)) {
            throw new Error('The requested store order status is invalid.');
        }
        const result = await request('listShopOrdersByStatus', { status });
        if (!Array.isArray(result.orders)) {
            throw new Error('The filtered shop order list returned by the database is invalid.');
        }
        return result.orders;
    }

    async function getShopOverview() {
        const result = await request('getShopOverview');
        const overview = result.overview;
        if (!overview || !['totalOrders', 'amountReceived', 'outstanding', 'undelivered']
            .every((key) => Number.isFinite(overview[key]) && overview[key] >= 0)) {
            throw new Error('The store overview returned by the database is invalid.');
        }
        return overview;
    }

    async function createShopOrder(shopId, order) {
        return request('createShopOrder', { shopId, order });
    }

    async function updateShopOrder(shopId, order) {
        return request('updateShopOrder', { shopId, order });
    }

    async function refreshStock() {
        const result = await request('getBookStock');
        const snapshot = { data: result.stock, updatedAt: new Date().toISOString() };
        await writeCache('stock', snapshot);
        return snapshot;
    }

    async function getCachedStock() {
        return readCache('stock');
    }

    async function addStock(stock) {
        const result = await request('addBookStock', { stock });
        try {
            const snapshot = { data: result.stock, updatedAt: new Date().toISOString() };
            await writeCache('stock', snapshot);
        } catch (error) {
            console.error('Stock was saved to the database, but the local cache could not be updated.', error);
            result.localCacheError = true;
        }
        return result;
    }

    window.AdminApi = {
        getMasterData,
        saveMasterData,
        getBookstores,
        saveBookstores,
        getAnnouncements,
        saveAnnouncement,
        getDeliveryCities,
        getCachedOrders,
        refreshOrders,
        createOrder,
        updateOrder,
        importRoyalShipmentExport,
        importRoyalStatementExport,
        getShops,
        getProfiles,
        updateUserRole,
        updateUserApproval,
        getFeedback,
        getShopOrders,
        getShopOrdersByStatus,
        getShopOverview,
        createShopOrder,
        updateShopOrder,
        getCachedStock,
        refreshStock,
        addStock
    };
    window.formatKyats = (value) => `${Number(value || 0).toLocaleString('my-MM')} ကျပ်`;
    window.escapeText = (value) => String(value == null ? '' : value)
        .replace(/[&<>"']/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    window.orderField = (order, field) => String(order[field] == null ? '' : order[field]);
    window.orderMatches = (order, query) => {
        const needle = query.trim().toLocaleLowerCase();
        const textMatches = ['Voucher No', 'Name', 'Phone'].some((field) =>
            window.orderField(order, field).toLocaleLowerCase().includes(needle)
        );
        const phoneQuery = query.replace(/[၀-၉]/g, (digit) =>
            String(digit.charCodeAt(0) - '၀'.charCodeAt(0))).trim();
        const normalizedNeedle = phoneQuery.replace(/\D/g, '');
        const normalizedPhone = window.orderField(order, 'Phone')
            .replace(/[၀-၉]/g, (digit) => String(digit.charCodeAt(0) - '၀'.charCodeAt(0)))
            .replace(/\D/g, '');
        const isPhoneQuery = /^[0-9\s()+-]+$/.test(phoneQuery);
        return !needle || textMatches ||
            (isPhoneQuery && normalizedNeedle.length > 0 && normalizedPhone.includes(normalizedNeedle));
    };
    window.orderDate = (value) => {
        const text = String(value || '').trim();
        const parsed = new Date(text.replace(' ', 'T'));
        return Number.isNaN(parsed.getTime()) ? text : parsed.toLocaleDateString('my-MM');
    };
    window.orderItemSummary = (order) => {
        const fields = [
            'Special Qty', 'Practice Qty', 'Old Questions Qty', 'Solution Qty',
            'Grade 11 Handbook Qty', 'Grade 11 Objective Qty', 'Grade 10 Handbook Qty'
        ];
        return window.AdminBooks.map((book, index) => {
            const quantityField = book.quantityHeader || fields[index] || `${book.id} Qty`;
            const quantity = Number(order[quantityField] || 0);
            return quantity > 0 ? `${book.name} × ${quantity}` : '';
        }).filter(Boolean).join('၊ ');
    };

    if ('serviceWorker' in navigator && window.isSecureContext) {
        const workerUrl = new URL('../service-worker.js', ADMIN_API_SCRIPT);
        navigator.serviceWorker.register(workerUrl, {
            scope: new URL('../', ADMIN_API_SCRIPT).pathname,
            updateViaCache: 'none'
        })
            .catch((error) => console.error('Unable to register the offline app shell.', error));
    }
})();
