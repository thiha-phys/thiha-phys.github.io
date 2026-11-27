const profileGrid = document.getElementById('profiles-grid');
const profileCount = document.getElementById('profile-count');
const profileMessageDialog = document.getElementById('profile-message-dialog');
const profileMessageForm = document.getElementById('profile-message-form');
const profileMessageInput = document.getElementById('profile-message-input');
const profileMessageRecipient = document.getElementById('profile-message-recipient');
const profileMessageStatus = document.getElementById('profile-message-status');
const profileMessageSendButton = profileMessageForm?.querySelector('[type="submit"]');
const profileMessageCancelButton = document.getElementById('profile-message-cancel');
let activeMessageRecipient = null;
let sendingProfileMessage = false;

function initialsFromName(name) {
    const text = String(name || '').trim();
    if (!text) return 'P';
    const parts = text.split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join('').slice(0, 2) || 'P';
}

function normalizePhoneForDial(phone) {
    return String(phone || '').replace(/\D/g, '');
}

function openProfileMessage(profile) {
    if (!profileMessageDialog || !profileMessageForm) return;
    activeMessageRecipient = profile;
    profileMessageForm.reset();
    profileMessageStatus.textContent = '';
    profileMessageStatus.classList.remove('is-success');
    profileMessageRecipient.textContent = String(profile.name || '').trim() || 'Customer';
    profileMessageDialog.showModal();
    profileMessageInput.focus();
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
        const messageButton = document.createElement('button');
        messageButton.className = 'profile-message-button';
        messageButton.type = 'button';
        messageButton.setAttribute('aria-label', `Send a message to ${name}`);
        messageButton.title = `Message ${name}`;
        const messageIcon = document.createElement('i');
        messageIcon.className = 'fa-regular fa-comment-dots';
        messageIcon.setAttribute('aria-hidden', 'true');
        messageButton.append(messageIcon);
        messageButton.addEventListener('click', () => openProfileMessage(profile));
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

    return article;
}

if (profileMessageForm && profileMessageDialog && profileMessageInput &&
    profileMessageStatus && profileMessageSendButton && profileMessageCancelButton) {
    profileMessageForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (sendingProfileMessage) return;
        const body = profileMessageInput.value.trim();
        if (!body) {
            profileMessageStatus.textContent = 'Write a message before sending.';
            profileMessageInput.focus();
            return;
        }
        if (!activeMessageRecipient) {
            profileMessageStatus.textContent = 'Choose a customer before sending.';
            return;
        }

        const recipientId = activeMessageRecipient.id;
        const recipientName = String(activeMessageRecipient.name || '').trim() || 'Customer';
        sendingProfileMessage = true;
        profileMessageSendButton.disabled = true;
        profileMessageCancelButton.disabled = true;
        profileMessageStatus.classList.remove('is-success');
        profileMessageStatus.textContent = 'Sending message…';
        try {
            const result = await AdminApi.sendDiscussionReply(recipientId, body);
            if (!result.message || result.message.userId !== recipientId ||
                result.message.senderRole !== 'admin' || typeof result.message.id !== 'string') {
                throw new Error('The server could not confirm the message was delivered.');
            }
            profileMessageInput.value = '';
            profileMessageStatus.classList.add('is-success');
            profileMessageStatus.textContent = `Message sent to ${recipientName}'s discussion.`;
        } catch (error) {
            console.error('Unable to send a direct discussion message.', error);
            profileMessageStatus.textContent = error.message || 'Could not send the message. Please try again.';
        } finally {
            sendingProfileMessage = false;
            profileMessageSendButton.disabled = false;
            profileMessageCancelButton.disabled = false;
            profileMessageInput.focus();
        }
    });

    profileMessageCancelButton.addEventListener('click', () => profileMessageDialog.close());
    profileMessageDialog.addEventListener('cancel', (event) => {
        if (profileMessageSendButton.disabled) event.preventDefault();
    });
    profileMessageDialog.addEventListener('close', () => {
        activeMessageRecipient = null;
        profileMessageForm.reset();
        profileMessageStatus.textContent = '';
        profileMessageStatus.classList.remove('is-success');
    });
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
