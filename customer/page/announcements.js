const announcementList = document.getElementById('announcement-list');
const announcementStatus = document.getElementById('announcement-status');
const cardThemes = ['blue', 'mint', 'amber'];

physicsApiFetch('public/announcements', { method: 'GET' }).then((result) => {
    const announcements = result.announcements || [];
    announcementList.replaceChildren();

    announcements.forEach((item, index) => {
        const card = document.createElement('article');
        card.className = `announcement-card announcement-card--${cardThemes[index % cardThemes.length]}`;

        const head = document.createElement('div');
        head.className = 'announcement-card-head';
        const icon = document.createElement('span');
        icon.className = 'announcement-card-icon';
        icon.setAttribute('aria-hidden', 'true');
        const iconElement = document.createElement('i');
        iconElement.className = `fa-solid ${index === 0 ? 'fa-bullhorn' : index === 1 ? 'fa-book-open' : 'fa-lightbulb'}`;
        icon.append(iconElement);
        const label = document.createElement('span');
        label.className = 'announcement-card-label';
        label.textContent = `UPDATE ${String(index + 1).padStart(2, '0')}`;
        head.append(icon, label);

        const title = document.createElement('h2');
        title.textContent = item.title;
        const body = document.createElement('p');
        body.className = 'announcement-card-body';
        body.textContent = item.body;

        const date = document.createElement('time');
        date.className = 'announcement-card-date';
        date.dateTime = item.publish_at;
        const calendarIcon = document.createElement('i');
        calendarIcon.className = 'fa-regular fa-calendar';
        calendarIcon.setAttribute('aria-hidden', 'true');
        const dateText = document.createElement('span');
        dateText.textContent = new Date(item.publish_at).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        date.append(calendarIcon, dateText);

        card.append(head, title, body, date);
        announcementList.append(card);
    });

    announcementStatus.textContent = announcements.length ? '' : 'ကြေညာချက်အသစ် မရှိသေးပါ။';
}).catch((error) => {
    announcementStatus.textContent = `ကြေညာချက်များ ရယူမရပါ။ ${error.message}`;
});
