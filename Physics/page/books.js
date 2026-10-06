const bookGrid = document.getElementById('book-grid');

PHYSICS_BOOKS.forEach((book) => {
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
    price.textContent = formatKyats(book.price);
    const action = document.createElement('span');
    action.className = 'book-action';
    action.textContent = 'နမူနာစာမျက်နှာ ကြည့်ရန်';
    previewLink.append(image, name, price, action);
    card.append(previewLink);
    bookGrid.append(card);
});
