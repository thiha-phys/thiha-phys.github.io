const announcementList=document.getElementById('announcement-list');
const announcementStatus=document.getElementById('announcement-status');
physicsApiFetch('public/announcements',{method:'GET'}).then(result=>{
    const announcements=result.announcements||[];
    announcementList.replaceChildren();
    for(const item of announcements){
        const card=document.createElement('article');card.className='coming-soon-card';
        const title=document.createElement('h2');title.textContent=item.title;
        const body=document.createElement('p');body.textContent=item.body;
        const date=document.createElement('small');date.textContent=new Date(item.publish_at).toLocaleDateString();
        card.append(title,body,date);announcementList.append(card);
    }
    announcementStatus.textContent=announcements.length?'':'ကြေညာချက်အသစ် မရှိသေးပါ။';
}).catch(error=>{announcementStatus.textContent=`ကြေညာချက်များ ရယူမရပါ။ ${error.message}`;});
