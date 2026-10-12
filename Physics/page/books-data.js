const PHYSICS_BOOKS = [
    { id: 'special', name: 'သင်ရိုးကုန် အထူးထုတ်', price: 20000, image: 'special.jpeg' },
    { id: 'practice', name: 'Practice Book', price: 13000, image: 'practice.jpeg' },
    { id: 'old-questions', name: 'မေးခွန်းဟောင်းစာအုပ်', price: 11000, image: 'oq.jpeg' },
    { id: 'solution', name: 'တွက်စာသီးသန့်စာအုပ်', price: 5000, image: 'solution.jpeg' },
    { id: 'g11-handbook', name: 'Grade 11 handbook', price: 10000, image: 'G11H.jpeg' },
    { id: 'g11-objective', name: 'Grade 11 တစ်မှတ်တန် သီးသန့်စာအုပ်', price: 8000, image: 'G11O.jpeg' },
    { id: 'g10-handbook', name: 'Grade 10 handbook', price: 10000, image: 'G10H.jpeg' }
];

function formatKyats(amount) {
    return `${Number(amount || 0).toLocaleString('en-US')} ကျပ်`;
}

function bookImagePath(book) {
    return `../pictures/book%20list/${encodeURIComponent(book.image)}`;
}
