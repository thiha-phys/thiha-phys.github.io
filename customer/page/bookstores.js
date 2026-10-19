const bookstores = [
    {
        city: 'ရန်ကုန်',
        name: 'ရွှေလင်းအိမ်စာပေ',
        address: 'အမှတ် ၈၊ ဖို့မြေလမ်းမကြီး (ဖို့မြေမှတ်တိုင်)၊ ရမ္မာဝတီမုန့်တီဆိုင်အကျော်၊ သန်လျင်မြို့နယ်၊ ရန်ကုန်',
        phones: ['09-799 190 042']
    },
    {
        city: 'ရန်ကုန်',
        name: 'ကိုထွန်းစာပေ',
        address: 'အမှတ် (၂၃၇)၊ ၃၆ လမ်း၊ အထက်ဘလောက်၊ ကျောက်တံတားမြို့နယ်၊ ရန်ကုန်',
        phones: ['09-421 060 654', '09-269 433 200']
    },
    {
        city: 'ရန်ကုန်',
        name: 'ဘုန်းမြင့်မိုရ်စာပေ',
        address: 'အမှတ် (၈၂)၊ ဝင်ပေါက် (စ)၊ ဗိုလ်ချုပ်ဈေးသစ်၊ ရန်ကုန်',
        phones: ['09-793 618 094', '09-269 433 200']
    },
    {
        city: 'ရန်ကုန်',
        name: 'KMK ရွှေပညာစာအုပ်တိုက်',
        address: '၂၀ ကုန်တိုက် City Mart နှင့် ရုပ်ရှင်ရုံအနီး၊ ၂၀ ဈေးအရှေ့တည့်တည့်၊ မြိတ်လမ်းမ၊ ဒဂုံမြို့သစ်တောင်ပိုင်း၊ ရန်ကုန်',
        phones: ['09-269 433 200']
    },
    {
        city: 'ရန်ကုန်',
        name: 'ထက်ထက်စာပေ',
        address: 'အမှတ် ၁၄၂၊ ဝေပုလ္လ (၄) လမ်း၊ (ဃ) ရပ်ကွက်၊ မြောက်ဥက္ကလာပမြို့နယ်၊ အဝိုင်းအနီး၊ ရန်ကုန်',
        phones: ['09967775456', '09441382818']
    },
    {
        city: 'ရန်ကုန်',
        name: 'ရွှေဉာဏ်ကျယ်စာပေ',
        address: 'အမှတ် ၃၃၈၊ အောင်သစ္စာလမ်း၊ ၂၉ ရပ်ကွက်၊ မြောက်ဒဂုံ၊ ရန်ကုန်',
        phones: ['09-517 342 3', '09-420 003 526']
    },
    {
        city: 'ရန်ကုန်',
        name: 'အောင်သူ စာပေ',
        address: 'အမှတ် ၃၈၅/၃၈၇၊ ဗိုလ်ချုပ်လမ်းမပေါ်၊ ရွှေဘုံသာလမ်းနှင့် ၂၉ လမ်းကြား၊ ပန်းဘဲတန်း၊ ရန်ကုန်',
        phones: ['09-791 255 810', '09-694 441 169']
    },
    {
        city: 'မန္တလေး',
        name: 'ဆရာဦးဖြိုးမင်းဇော်',
        address: '၃၂/၃၃ လမ်းကြား၊ ၈၆ လမ်း၊ မန္တလေး',
        phones: ['09-202 873 4']
    },
    {
        city: 'မန္တလေး',
        name: 'နဂါးစာပေ (ပင်ရင်း)',
        address: 'အမှတ် (၂၉၀) (ခ)၊ ၈၃ လမ်း၊ ၂၉ လမ်းနှင့် လမ်း ၃၀ ကြား၊ မန္တလေးမြို့',
        phones: ['02-403 526 7', '02-403 986 9']
    },
    {
        city: 'မန္တလေး',
        name: 'ခေတ်မီစာပေ (ဆိုင် ၁)',
        address: '၂၉ လမ်း၊ ၈၃ လမ်းနှင့် ၈၄ လမ်းကြား၊ တောင်ဆင်ကျုံးဝင်း၊ မန္တလေးမြို့',
        phones: ['02-406 813 1', '02-402 303 6']
    },
    {
        city: 'မန္တလေး',
        name: 'ခေတ်မီစာပေ (ဆိုင် ၂)',
        address: '၇၄ လမ်းနှင့် ၃၆ လမ်းထောင့်၊ မန္တလေးမြို့',
        phones: ['09-97771 44 99', '09-259 048 266']
    },
    {
        city: 'မန္တလေး',
        name: 'ထွန်းဦးစာပေ',
        address: '၈၄ လမ်း၊ ၂၉ လမ်းနှင့် လမ်း ၃၀ ကြား၊ မန္တလေးမြို့',
        phones: ['09-78 94 94 416', '09-9544 06 888']
    },
    {
        city: 'မန္တလေး',
        name: 'မောင်မောင်ပြေစာပေ',
        address: 'မန္တလေး',
        phones: ['09-']
    },
    {
        city: 'မန္တလေး',
        name: 'ရွှေမိုးစာပေ',
        address: 'မန္တလေး',
        phones: ['09-756 276 027']
    },
    {
        city: 'ပုသိမ်',
        name: 'ဆရာချစ်',
        address: 'မင်းရာဇာဘာသာရပ်သင်ကိုယ်သင်တန်း၊ ပုသိမ်',
        phones: ['09-794 502 970']
    },
    {
        city: 'ပုသိမ်',
        name: 'ပြုံးချိုစာပေ',
        address: 'ပုသိမ်မြို့',
        phones: ['09-520 015 9']
    },
    {
        city: 'မြိတ်',
        name: 'ဝင့်နဒီအောင်စာပေ',
        address: 'အ.ထ.က (၁) ကျောင်းရှေ့၊ မြိတ်မြို့',
        phones: ['09-422 203 796']
    },
    {
        city: 'ပြင်ဦးလွင်',
        name: 'ဇင်ယော်စာပေ',
        address: 'မန္တလေး-လားရှိုးလမ်း၊ ရတနာဆွယ်တာဘေး၊ MMHK ဓာတ်ဆီဆိုင်အနီး၊ ပြင်ဦးလွင်မြို့',
        phones: ['09-442 046 095']
    },
    {
        city: 'ပခုက္ကူ',
        name: 'သမဂ္ဂသုခ',
        address: 'မြို့မဈေး အနောက်ဘက်၊ ပခုက္ကူ',
        phones: ['09-230 125 4', '09-951 922 544']
    },
    {
        city: 'ပခုက္ကူ',
        name: 'ညိမ်းစာရေးကိရိယာ',
        address: 'ပခုက္ကူ',
        phones: ['09-973 202 893']
    },
    {
        city: 'နေပြည်တော်',
        name: 'တက္ကသိုလ်စာပေ',
        address: 'ဗိုလ်တောက်ထိန်လမ်း၊ ပျဉ်းမနား၊ နေပြည်တော်',
        phones: ['09-777 77 00 67', '09-777 77 00 87']
    },
    {
        city: 'မကွေး',
        name: 'မျိုးဆက်သစ်စာပေ',
        address: 'မကွေးမြို့',
        phones: ['09-259 887 188']
    },
    {
        city: 'မိတ္ထီလာ',
        name: 'သမ္မတစာပေ',
        address: 'မိတ္ထီလာမြို့',
        phones: ['09-962 216 633']
    },
    {
        city: 'မိတ္ထီလာ',
        name: 'ရဲမာန်ဟုန်စာပေ',
        address: 'မိတ္ထီလာ',
        phones: ['09-']
    },
    {
        city: 'မိတ္ထီလာ',
        name: 'မအိစာပေ (ဆိုင် ၁)',
        address: 'ရွှေစည်းခုံဘုရားတိုက်တန်း၊ ဝန်ဇင်းရပ်၊ မိတ္ထီလာ',
        phones: ['09-421 766 008', '09-988 315 429']
    },
    {
        city: 'မိတ္ထီလာ',
        name: 'မအိစာပေ (ဆိုင် ၂)',
        address: 'အထက ၂ ကျောင်းအနီး၊ ကားကြီးကွင်းပေါက်၊ ကျီတော်ကုန်း၊ မိတ္ထီလာ',
        phones: ['09-421 766 008', '09-988 315 429']
    },
    {
        city: 'ပြည်',
        name: 'အောင်နိုင်စာပေ',
        address: 'အမှတ် (၁၁၅) လမ်းမတော်လမ်း၊ ပြည်',
        phones: ['09-260 986 075']
    },
    {
        city: 'ပဲခူး',
        name: 'သဇင်စာပေ',
        address: 'ပဲခူး',
        phones: ['09-250 290 939']
    },
    {
        city: 'ရေတာရှည်',
        name: 'ဒေါ်ထက်ထက်အောင်',
        address: 'ရေတာရှည်',
        phones: ['09-777 056 046']
    }
];

const shopGrid = document.getElementById('shopGrid');
const cityFilters = document.getElementById('cityFilters');
const shopSearch = document.getElementById('shopSearch');
const resultsTitle = document.getElementById('resultsTitle');
const resultCount = document.getElementById('resultCount');
const emptyState = document.getElementById('emptyState');

let selectedCity = 'အားလုံး';

function phoneHref(phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) {
        return null;
    }
    return digits.startsWith('09') ? `tel:+95${digits.slice(1)}` : `tel:${digits}`;
}

function renderCityFilters() {
    const cities = ['အားလုံး', ...new Set(bookstores.map(store => store.city))];
    cityFilters.replaceChildren();

    cities.forEach(city => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'city-filter';
        button.classList.toggle('active', city === selectedCity);
        button.textContent = city;
        button.setAttribute('aria-pressed', String(city === selectedCity));
        button.addEventListener('click', () => {
            selectedCity = city;
            renderCityFilters();
            renderShops();
        });
        cityFilters.append(button);
    });
}

function renderShops() {
    const query = shopSearch.value.trim().toLocaleLowerCase();
    const matches = bookstores.filter(store => {
        const cityMatches = selectedCity === 'အားလုံး' || store.city === selectedCity;
        const searchableText = [store.city, store.name, store.address, ...store.phones]
            .join(' ')
            .toLocaleLowerCase();
        return cityMatches && searchableText.includes(query);
    });

    shopGrid.replaceChildren();
    matches.forEach(store => {
        const card = document.createElement('article');
        card.className = 'shop-card';

        const cardTop = document.createElement('div');
        cardTop.className = 'shop-card-top';

        const cityTag = document.createElement('span');
        cityTag.className = 'city-tag';
        cityTag.innerHTML = '<i class="fa-solid fa-location-dot" aria-hidden="true"></i>';
        cityTag.append(` ${store.city} မြို့`);
        cardTop.append(cityTag);

        const shopIcon = document.createElement('span');
        shopIcon.className = 'shop-icon';
        shopIcon.innerHTML = '<i class="fa-solid fa-book-bookmark" aria-hidden="true"></i>';
        cardTop.append(shopIcon);

        const name = document.createElement('h3');
        name.textContent = store.name;

        const address = document.createElement('p');
        address.className = 'shop-address';
        address.innerHTML = '<i class="fa-solid fa-map-pin" aria-hidden="true"></i>';
        address.append(` ${store.address}`);

        const contactLabel = document.createElement('span');
        contactLabel.className = 'contact-label';
        contactLabel.textContent = 'ဖုန်းဆက်သွယ်ရန်';

        const phoneList = document.createElement('div');
        phoneList.className = 'phone-list';
        store.phones.forEach(phone => {
            const href = phoneHref(phone);
            const contact = document.createElement(href ? 'a' : 'span');
            contact.className = 'phone-link';
            if (href) {
                contact.href = href;
                contact.setAttribute('aria-label', `${phone} သို့ ဖုန်းခေါ်ရန်`);
            }
            contact.innerHTML = '<i class="fa-solid fa-phone" aria-hidden="true"></i>';
            contact.append(` ${phone}`);
            phoneList.append(contact);
        });

        card.append(cardTop, name, address, contactLabel, phoneList);
        shopGrid.append(card);
    });

    resultsTitle.textContent = selectedCity === 'အားလုံး' ? 'စာအုပ်ဆိုင်များ' : `${selectedCity} မြို့ရှိဆိုင်များ`;
    resultCount.textContent = `${matches.length} ဆိုင်`;
    emptyState.hidden = matches.length > 0;
}

shopSearch.addEventListener('input', renderShops);
renderCityFilters();
renderShops();
