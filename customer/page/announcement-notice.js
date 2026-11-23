(() => {
    const badge=document.getElementById('announcement-notice');
    if(!badge||typeof physicsApiFetch!=='function')return;
    const storageKey='physicsLearningHubSeenAnnouncements';
    let seen=[];try{seen=JSON.parse(localStorage.getItem(storageKey)||'[]');if(!Array.isArray(seen))seen=[];}catch{}
    async function refreshAnnouncementBadge(){
      try {
        const {announcements=[]}=await physicsApiFetch('public/announcements',{method:'GET'});
        const ids=announcements.map(item=>`${item.id}:${item.publish_at||''}`);
        const onAnnouncementPage=location.pathname.endsWith('/announcement.html');
        if(onAnnouncementPage){seen=ids;try{localStorage.setItem(storageKey,JSON.stringify(seen));}catch{}badge.hidden=true;return;}
        const unseen=ids.filter(id=>!seen.includes(id)).length;
        badge.textContent=unseen>99?'99+':String(unseen);badge.setAttribute('aria-label',`${unseen} unread announcements`);badge.hidden=unseen===0;
      } catch(error) {
        console.warn('Could not refresh announcement count.',error);
      }
    }
    refreshAnnouncementBadge();
    window.addEventListener('focus',refreshAnnouncementBadge);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshAnnouncementBadge();});
    window.setInterval(refreshAnnouncementBadge,60000);
})();
