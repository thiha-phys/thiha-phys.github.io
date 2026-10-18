const bookGrid = document.getElementById('book-grid');

loadOrderMasterData()
    .then(({ masterData }) => {
        getFirebaseOrderBooks(masterData).forEach((book) => {
            const card = document.createElement('article');
            card.className = 'book-card';
            const previewLink = document.createElement('a');
            previewLink.className = 'book-preview-link';
            previewLink.href = `book-preview.html?book=${encodeURIComponent(book.id)}`;
            previewLink.setAttribute('aria-label', `${book.name} နမူနာကြည့်ရန်`);

            const image = document.createElement('img');
            image.src = bookImagePath(book);
            image.alt = book.name;
            image.loading = 'lazy';
            image.draggable = false;

            const name = document.createElement('h2');
            name.textContent = book.name;
            const price = document.createElement('p');
            price.className = 'book-price';
            price.textContent = formatKyats(book.prices[0]);
            const action = document.createElement('span');
            action.className = 'book-action';
            const previewIcon = document.createElement('i');
            previewIcon.className = 'fa-solid fa-eye';
            previewIcon.setAttribute('aria-hidden', 'true');
            action.append(previewIcon);
            action.append(document.createTextNode(' နမူနာစာမျက်နှာ ကြည့်ရန်'));
            previewLink.append(image, name, price, action);
            card.append(previewLink);
            bookGrid.append(card);
        });
    })
    .catch((error) => {
        console.error('Unable to load the Firebase book catalog.', error);
        const message = document.createElement('p');
        message.className = 'form-status';
        message.textContent = 'စာအုပ်စာရင်းကို Firebase မှ ရယူမရပါ။';
        bookGrid.replaceChildren(message);
    });
