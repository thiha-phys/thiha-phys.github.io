(() => {
    const badge=document.getElementById('announcement-notice');
    if(!badge||typeof physicsApiFetch!=='function')return;
    const storageKey='physicsLearningHubSeenAnnouncements';
    let seen=[];try{seen=JSON.parse(localStorage.getItem(storageKey)||'[]');if(!Array.isArray(seen))seen=[];}catch{}
    physicsApiFetch('public/announcements',{method:'GET'}).then(({announcements=[]})=>{
        const ids=announcements.map(item=>String(item.id));
        const onAnnouncementPage=location.pathname.endsWith('/announcement.html');
        if(onAnnouncementPage){try{localStorage.setItem(storageKey,JSON.stringify(ids));}catch{}badge.hidden=true;return;}
        const unseen=ids.filter(id=>!seen.includes(id)).length;
        badge.textContent=unseen>9?'9+':'NEW';badge.hidden=unseen===0;
    }).catch(()=>{badge.hidden=true;});
})();
