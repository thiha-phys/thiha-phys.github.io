const PHYSICS_BOOKS = [
    { id: 'special', name: 'သင်ရိုးကုန် အထူးထုတ်', price: 20000, image: 'special.png' },
    { id: 'practice', name: 'Practice Book', price: 13000, image: 'practice.png' },
    { id: 'old-questions', name: 'မေးခွန်းဟောင်းစာအုပ်', price: 11000, image: 'OQ.png' },
    { id: 'solution', name: 'တွက်စာသီးသန့်စာအုပ်', price: 5000, image: 'solution.png' },
    { id: 'g11-handbook', name: 'Grade 11 စာသင်ခန်းသုံး စာအုပ်', price: 10000, image: 'G11H.png' },
    { id: 'g11-objective', name: 'Grade 11 တစ်မှတ်တန် သီးသန့်စာအုပ်', price: 8000, image: 'G11O.png' },
    { id: 'g10-handbook', name: 'Grade 10 စာသင်ခန်းသုံး စာအုပ်', price: 10000, image: 'G10H.png' }
];

function formatKyats(amount) {
    return `${Number(amount || 0).toLocaleString('en-US')} ကျပ်`;
}

function bookImagePath(book) {
    return `../pictures/book%20show/${encodeURIComponent(book.image)}`;
}
