const profileGrid = document.getElementById('profiles-grid');
const profileCount = document.getElementById('profile-count');

function initialsFromName(name) {
    const text = String(name || '').trim();
    if (!text) return 'P';
    const parts = text.split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join('').slice(0, 2) || 'P';
}

function normalizePhoneForDial(phone) {
    return String(phone || '').replace(/\D/g, '');
}

function renderProfileCard(profile) {
    const article = document.createElement('article');
    article.className = 'profile-card';

    const phoneDigits = normalizePhoneForDial(profile.phone);
    const email = String(profile.email || '').trim();
    const job = String(profile.job || '').trim();
    const name = String(profile.name || '').trim() || 'Unnamed profile';
    const emailIcon = '<i class="fa-regular fa-envelope" aria-hidden="true"></i>';
    const phoneIcon = '<i class="fa-solid fa-phone" aria-hidden="true"></i>';

    article.innerHTML = `
        <div class="profile-card-header">
            <div class="profile-avatar">${escapeText(initialsFromName(name))}</div>
            <div class="profile-heading">
                <h3>${escapeText(name)}</h3>
                <p>${escapeText(job || 'No job added')}</p>
            </div>
        </div>
        <div class="profile-meta">
            ${email ? `<div class="profile-contact-row"><a class="profile-contact" href="mailto:${escapeText(email)}">${emailIcon}<span>${escapeText(email)}</span></a></div>` : ''}
            ${phoneDigits
                ? `<div class="profile-contact-row"><a class="profile-contact profile-phone" href="tel:${escapeText(phoneDigits)}">${phoneIcon}<span>${escapeText(profile.phone || phoneDigits)}</span></a></div>`
                : ''}
            ${!email && !phoneDigits ? '<div class="profile-contact-row"><span class="profile-empty-contact">No contact details</span></div>' : ''}
        </div>
    `;

    return article;
}

async function loadProfiles() {
    profileGrid.innerHTML = '<div class="profiles-empty">Loading profiles…</div>';
    try {
        const profiles = await AdminApi.getProfiles();
        profileGrid.replaceChildren();
        if (!Array.isArray(profiles) || profiles.length === 0) {
            profileCount.textContent = '0';
            profileGrid.innerHTML = '<div class="profiles-empty">No profile has been created yet.</div>';
            return;
        }

        profileCount.textContent = String(profiles.length);
        profiles.forEach((profile) => {
            profileGrid.appendChild(renderProfileCard(profile));
        });
    } catch (error) {
        console.error('Unable to load profiles.', error);
        profileCount.textContent = '0';
        profileGrid.innerHTML = '<div class="profiles-empty error">The profile list could not be loaded. Please refresh and try again.</div>';
    }
}

loadProfiles();
