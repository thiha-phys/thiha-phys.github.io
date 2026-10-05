const bookstores = [
    {
        city: 'ပြည်',
        name: 'အောင်နိုင်စာပေ',
        address: 'အမှတ် (၁၁၇)၊ လမ်းမတော်လမ်း၊ ပြည်မြို့',
        phones: ['09-260 986 075']
    },
    {
        city: 'မိတ္ထီလာ',
        name: 'သမုဒ္ဒရာစာပေ',
        address: 'မိတ္ထီလာမြို့',
        phones: ['09-962 216 633']
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
            const link = document.createElement('a');
            link.className = 'phone-link';
            link.href = phoneHref(phone);
            link.setAttribute('aria-label', `${phone} သို့ ဖုန်းခေါ်ရန်`);
            link.innerHTML = '<i class="fa-solid fa-phone" aria-hidden="true"></i>';
            link.append(` ${phone}`);
            phoneList.append(link);
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
