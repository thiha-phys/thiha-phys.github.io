const announcementList=document.getElementById('announcement-list');
const announcementStatus=document.getElementById('announcement-status');

physicsApiFetch('public/announcements',{method:'GET'}).then(result=>{
    const announcements=result.announcements||[];
    announcementList.replaceChildren();
    announcements.forEach((item,index)=>{
        const card=document.createElement('article');card.className='announcement-card';card.style.setProperty('--card-index',String(index));
        const ornament=document.createElement('span');ornament.className='announcement-card-orbit';ornament.setAttribute('aria-hidden','true');
        const head=document.createElement('div');head.className='announcement-card-head';
        const icon=document.createElement('span');icon.className='announcement-card-icon';icon.innerHTML='<i class="fa-solid fa-bullhorn" aria-hidden="true"></i>';
        const label=document.createElement('span');label.className='announcement-card-label';label.textContent='PHYSICS LEARNING HUB';head.append(icon,label);
        const title=document.createElement('h2');title.textContent=item.title;
        const body=document.createElement('p');body.className='announcement-card-body';body.textContent=item.body;
        const date=document.createElement('time');date.className='announcement-card-date';date.dateTime=item.publish_at;date.innerHTML=`<i class="fa-regular fa-calendar" aria-hidden="true"></i> ${new Date(item.publish_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}`;
        card.append(ornament,head,title,body,date);announcementList.append(card);
    });
    announcementStatus.textContent=announcements.length?'':'ကြေညာချက်အသစ် မရှိသေးပါ။';
}).catch(error=>{announcementStatus.textContent=`ကြေညာချက်များ ရယူမရပါ။ ${error.message}`;});
