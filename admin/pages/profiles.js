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
            <div class="profile-contact-row"><span class="profile-empty-contact">${escapeText(profile.role === 'admin' ? 'Admin' : 'Customer')} · ${escapeText(profile.approvalStatus || 'approved')}</span></div>
            ${email ? `<div class="profile-contact-row"><a class="profile-contact" href="mailto:${escapeText(email)}">${emailIcon}<span>${escapeText(email)}</span></a></div>` : ''}
            ${phoneDigits
                ? `<div class="profile-contact-row"><a class="profile-contact profile-phone" href="tel:${escapeText(phoneDigits)}">${phoneIcon}<span>${escapeText(profile.phone || phoneDigits)}</span></a></div>`
                : ''}
            ${!email && !phoneDigits ? '<div class="profile-contact-row"><span class="profile-empty-contact">No contact details</span></div>' : ''}
        </div>
    `;

    if (profile.role === 'customer' && profile.approvalStatus === 'approved' && typeof profile.id === 'string') {
        const messageButton = document.createElement('a');
        messageButton.className = 'profile-message-button';
        messageButton.href = `feedback.html?userId=${encodeURIComponent(profile.id)}`;
        messageButton.setAttribute('aria-label', `Open ${name}'s discussion`);
        messageButton.title = `Message ${name}`;
        const messageIcon = document.createElement('i');
        messageIcon.className = 'fa-regular fa-comment-dots';
        messageIcon.setAttribute('aria-hidden', 'true');
        messageButton.append(messageIcon);
        article.querySelector('.profile-card-header').append(messageButton);
    }

    if (profile.approvalStatus === 'pending') {
        const actions=document.createElement('div');actions.className='profile-actions';
        for(const [label,value] of [['Approve','approved'],['Reject','rejected']]){
            const button=document.createElement('button');button.type='button';button.className=`profile-role-button ${value==='approved'?'approve':'reject'}`;button.textContent=label;
            button.addEventListener('click',async()=>{button.disabled=true;try{await AdminApi.updateUserApproval(profile.id,value);await loadProfiles();}catch(error){button.disabled=false;alert(error.message||'Account approval could not be updated.');}});actions.append(button);
        }
        article.append(actions);
    }

    if (typeof profile.id === 'string') {
        const actions = document.createElement('div');
        actions.className = 'profile-actions';
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'profile-role-button delete';
        deleteButton.textContent = 'Delete account';
        deleteButton.setAttribute('aria-label', `Delete ${name}'s account`);
        deleteButton.addEventListener('click', async () => {
            if (!window.confirm(`Permanently delete ${name}'s account? This cannot be undone.`)) return;
            deleteButton.disabled = true;
            try {
                await AdminApi.deleteUser(profile.id);
                await loadProfiles();
            } catch (error) {
                deleteButton.disabled = false;
                alert(error.message || 'Account could not be deleted.');
            }
        });
        actions.append(deleteButton);
        article.append(actions);
    }

    return article;
}

async function loadProfiles() {
    profileGrid.innerHTML = '<div class="profiles-empty">Loading profiles…</div>';
    try {
        let profiles = await AdminApi.getProfiles();
        const profileFilter = document.body.dataset.profileFilter || new URLSearchParams(location.search).get('status');
        if (profileFilter === 'pending') profiles = profiles.filter((profile) => profile.approvalStatus === 'pending');
        else profiles = profiles.filter((profile) => profile.approvalStatus !== 'pending');
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
        profileGrid.innerHTML = '<div class="profiles-empty error">The profile list could not be loaded. Reopen this page to try again.</div>';
    }
}

loadProfiles();
