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

    article.innerHTML = `
        <div class="profile-card-header">
            <div class="profile-avatar">${escapeText(initialsFromName(name))}</div>
            <div class="profile-heading">
                <h3>${escapeText(name)}</h3>
                <p>${escapeText(job || 'No job added')}</p>
            </div>
        </div>
        <div class="profile-meta">
            <div class="profile-row">
                <span class="profile-label">Email</span>
                <a href="${email ? `mailto:${escapeText(email)}` : '#'}" class="profile-value ${email ? '' : 'is-empty'}">${escapeText(email || 'No email')}</a>
            </div>
            <div class="profile-row">
                <span class="profile-label">Phone</span>
                ${phoneDigits
                    ? `<a class="profile-value profile-phone" href="tel:${escapeText(phoneDigits)}">${escapeText(profile.phone || phoneDigits)}</a>`
                    : '<span class="profile-value is-empty">No phone</span>'}
            </div>
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
