const feedbackForm = document.getElementById('feedback-form');
feedbackForm.hidden = true;
const feedbackBookList = document.getElementById('feedback-book-list');
const feedbackStatus = document.getElementById('feedback-status');
const feedbackReviewPanel = document.getElementById('feedback-review-panel');
const feedbackReviewDetails = document.getElementById('feedback-review-details');
const feedbackSuccess = document.getElementById('feedback-success');
const submitFeedbackButton = document.getElementById('submit-feedback');
let reviewedFeedback = null;
let signedInProfile = null;
let feedbackBooks = [];

try {
    const profileData = localStorage.getItem('physicsLearningHubProfile');
    signedInProfile = profileData ? JSON.parse(profileData) : null;
    if (!signedInProfile || typeof signedInProfile !== 'object' ||
        typeof signedInProfile.name !== 'string' || typeof signedInProfile.phone !== 'string') {
        signedInProfile = null;
    }
} catch (error) {
    console.error('Unable to load the saved account profile for feedback.', error);
}

function renderFeedbackBooks(masterData) {
feedbackBooks = getFirebaseOrderBooks(masterData);
feedbackBooks.forEach((book) => {
    const card = document.createElement('article');
    card.className = 'feedback-book';

    const image = document.createElement('img');
    image.src = bookImagePath(book);
    image.alt = book.name;
    image.loading = 'lazy';
    image.draggable = false;

    const details = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = book.name;

    const rating = document.createElement('fieldset');
    rating.className = 'feedback-rating';
    rating.setAttribute('aria-label', `${book.name} အဆင့်သတ်မှတ်ချက်`);
    const legend = document.createElement('legend');
    legend.textContent = `${book.name} အဆင့်သတ်မှတ်ချက်`;
    rating.append(legend);

    for (let value = 5; value >= 1; value -= 1) {
        const input = document.createElement('input');
        const id = `rating-${book.id}-${value}`;
        input.type = 'radio';
        input.id = id;
        input.name = `rating-${book.id}`;
        input.value = String(value);
        input.required = true;
        input.setAttribute('aria-label', `${book.name} ${value} ကြယ်`);

        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = '★';
        label.setAttribute('aria-label', `${value} ကြယ်`);
        rating.append(input, label);
    }

    const commentLabel = document.createElement('label');
    commentLabel.className = 'form-field';
    commentLabel.htmlFor = `suggestion-${book.id}`;
    commentLabel.textContent = 'စာအုပ်အတွက် အကြံပြုချက်';

    const comment = document.createElement('textarea');
    comment.id = `suggestion-${book.id}`;
    comment.name = `suggestion-${book.id}`;
    comment.rows = 2;
    comment.maxLength = 1000;
    comment.placeholder = 'အကြံပြုချက် ရှိပါက ရေးပေးပါ။';
    commentLabel.append(comment);

    details.append(title, rating, commentLabel);
    card.append(image, details);
    feedbackBookList.append(card);
});
}

loadOrderMasterData()
    .then(({ masterData }) => {
        renderFeedbackBooks(masterData);
        feedbackForm.hidden = false;
    })
    .catch((error) => {
        console.error('Unable to load Firebase book names for feedback.', error);
        feedbackForm.hidden = true;
        feedbackStatus.textContent = 'Firebase မှ စာအုပ်စာရင်းကို ရယူမရပါ။';
    });

function collectFeedback() {
    const formData = new FormData(feedbackForm);
    return {
        phone: signedInProfile.phone,
        job: String(formData.get('job') || ''),
        books: feedbackBooks.map((book) => ({
            id: book.id,
            rating: Number(formData.get(`rating-${book.id}`)),
            suggestion: String(formData.get(`suggestion-${book.id}`) || '').trim()
        })),
        otherSuggestion: String(formData.get('otherSuggestion') || '').trim()
    };
}

function addReviewText(parent, text, className) {
    const paragraph = document.createElement('p');
    if (className) paragraph.className = className;
    paragraph.textContent = text;
    parent.append(paragraph);
}

function showReview(feedback) {
    reviewedFeedback = feedback;
    feedbackReviewDetails.replaceChildren();
    addReviewText(
        feedbackReviewDetails,
        `အလုပ်အကိုင် - ${feedback.job === 'teacher' ? 'ဆရာ / ဆရာမ' : 'ကျောင်းသား / ကျောင်းသူ'}`
    );

    feedback.books.forEach((entry, index) => {
        const title = document.createElement('h3');
        title.textContent = feedbackBooks[index].name;
        feedbackReviewDetails.append(title);
        addReviewText(feedbackReviewDetails, `အဆင့် - ${'★'.repeat(entry.rating)}`);
        if (entry.suggestion) addReviewText(feedbackReviewDetails, entry.suggestion);
    });

    if (feedback.otherSuggestion) {
        const title = document.createElement('h3');
        title.textContent = 'အခြားအကြံပြုချက်';
        feedbackReviewDetails.append(title);
        addReviewText(feedbackReviewDetails, feedback.otherSuggestion);
    }

    feedbackForm.hidden = true;
    feedbackReviewPanel.hidden = false;
    feedbackReviewPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

feedbackForm.addEventListener('submit', (event) => {
    event.preventDefault();
    feedbackStatus.textContent = '';
    if (!signedInProfile) {
        feedbackStatus.textContent = 'အကြံပြုစာပေးပို့ရန် အကောင့်ဝင်ထားရန် လိုအပ်ပါသည်။';
        return;
    }
    showReview(collectFeedback());
});

document.getElementById('edit-feedback').addEventListener('click', () => {
    feedbackReviewPanel.hidden = true;
    feedbackForm.hidden = false;
    feedbackForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

submitFeedbackButton.addEventListener('click', async () => {
    if (!reviewedFeedback) {
        throw new Error('Feedback must be reviewed before it is submitted.');
    }

    submitFeedbackButton.disabled = true;
    feedbackStatus.textContent = 'ပေးပို့နေပါသည်။ ခဏစောင့်ပေးပါ။';
    try {
        await sendProfileRequest('submitFeedback', {
            phone: reviewedFeedback.phone,
            job: reviewedFeedback.job,
            books: reviewedFeedback.books,
            otherSuggestion: reviewedFeedback.otherSuggestion
        });
        feedbackStatus.textContent = '';
        feedbackReviewPanel.hidden = true;
        feedbackSuccess.hidden = false;
        feedbackSuccess.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        console.error('Unable to submit feedback.', error);
        feedbackStatus.textContent = `အကြံပြုစာ ပေးပို့၍မရပါ။ ${error.message}`;
    } finally {
        submitFeedbackButton.disabled = false;
    }
});
