function formatKyats(amount) {
    return `${Number(amount || 0).toLocaleString('en-US')} ကျပ်`;
}

function bookImagePath(book) {
    return `../pictures/book%20list/${encodeURIComponent(book.image)}`;
}
