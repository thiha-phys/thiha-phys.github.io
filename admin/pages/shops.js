const shopGrid = document.getElementById('shop-grid');
const shopStatus = document.getElementById('shops-status');

async function loadShops(button) {
    if (button) button.disabled = true;
    shopStatus.classList.remove('error');
    shopStatus.textContent = 'Loading stores…';
    try {
        const shops = await AdminApi.getShops();
        shopGrid.replaceChildren();
        shops.forEach((shop) => {
            const link = document.createElement('a');
            link.className = 'shop-card';
            link.href = `shop.html?id=${encodeURIComponent(shop.id)}`;
            link.innerHTML = `<span class="shop-card-icon"><i class="fa-solid fa-shop" aria-hidden="true"></i></span><strong>${escapeText(shop.name)}</strong>`;
            shopGrid.append(link);
        });
        shopStatus.textContent = `${shops.length.toLocaleString('en-US')} stores`;
    } catch (error) {
        console.error('Unable to load the shop list.', error);
        shopStatus.textContent = 'Unable to load stores from the database. Check your internet connection and try again.';
        shopStatus.classList.add('error');
    } finally {
        if (button) button.disabled = false;
    }
}

loadShops();
