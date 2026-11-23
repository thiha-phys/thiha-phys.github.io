const announcementForm=document.getElementById('announcement-form');
const announcementItems=document.getElementById('announcement-items');
const announcementStatus=document.getElementById('announcement-status');
async function refreshAnnouncements(){
    try{const items=await AdminApi.getAnnouncements();announcementItems.replaceChildren();for(const item of items){const card=document.createElement('article');card.className='panel';const title=document.createElement('h3');title.textContent=item.title;const body=document.createElement('p');body.textContent=item.body;const date=document.createElement('small');date.textContent=new Date(item.publish_at).toLocaleString();card.append(title,body,date);announcementItems.append(card);}}
    catch(error){announcementStatus.textContent=error.message;}
}
announcementForm.addEventListener('submit',async event=>{event.preventDefault();if(!announcementForm.reportValidity())return;const data=new FormData(announcementForm),button=announcementForm.querySelector('button');button.disabled=true;try{await AdminApi.saveAnnouncement(String(data.get('title')).trim(),String(data.get('body')).trim());announcementForm.reset();announcementStatus.textContent='Database ထဲသိမ်းပြီး customer app သို့ ထုတ်ပြန်ပါပြီ။';await refreshAnnouncements();}catch(error){announcementStatus.textContent=error.message;}finally{button.disabled=false;}});
refreshAnnouncements();
