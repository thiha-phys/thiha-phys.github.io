const announcementForm=document.getElementById('announcement-form');
const announcementItems=document.getElementById('announcement-items');
const announcementStatus=document.getElementById('announcement-status');
const announcementCount=document.getElementById('announcement-count');
const cancelEdit=document.getElementById('cancel-edit');

function resetEditor(){announcementForm.reset();announcementForm.elements.id.value='';cancelEdit.hidden=true;announcementForm.querySelector('[type="submit"]').textContent='သိမ်းမည်';}
function updateCount(items){announcementCount.textContent=`${items.filter(item=>item.active).length} / 3 ပြသထား`;}
async function refreshAnnouncements(){
    try{
        const items=await AdminApi.getAnnouncements();announcementItems.replaceChildren();updateCount(items);
        if(!items.length){const empty=document.createElement('p');empty.className='announcement-admin-empty';empty.textContent='ကြေညာချက် မရှိသေးပါ။';announcementItems.append(empty);return;}
        for(const item of items){
            const card=document.createElement('article');card.className=`announcement-admin-card${item.active?' is-selected':''}`;
            const top=document.createElement('div');top.className='announcement-admin-card-top';
            const status=document.createElement('span');status.className=`announcement-state${item.active?' is-selected':''}`;status.textContent=item.active?'Customer app တွင် ပြနေသည်':'မပြသေးပါ';
            const date=document.createElement('time');date.dateTime=item.publish_at;date.textContent=new Date(item.publish_at).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});top.append(status,date);
            const title=document.createElement('h3');title.textContent=item.title;
            const body=document.createElement('p');body.className='announcement-admin-body';body.textContent=item.body;
            const actions=document.createElement('div');actions.className='announcement-admin-actions';
            const toggle=document.createElement('button');toggle.type='button';toggle.className='secondary-button';toggle.textContent=item.active?'Customer app မှ ဖယ်မည်':'Customer app တွင်ပြမည်';toggle.addEventListener('click',async()=>{toggle.disabled=true;try{await AdminApi.setAnnouncementActive(item.id,!item.active);announcementStatus.textContent='ပြသမှုကို သိမ်းပြီးပါပြီ။';await refreshAnnouncements();}catch(error){announcementStatus.textContent=error.message;toggle.disabled=false;}});
            const edit=document.createElement('button');edit.type='button';edit.className='secondary-button';edit.textContent='ပြင်မည်';edit.addEventListener('click',()=>{announcementForm.elements.id.value=item.id;announcementForm.elements.title.value=item.title;announcementForm.elements.body.value=item.body;cancelEdit.hidden=false;announcementForm.querySelector('[type="submit"]').textContent='ပြင်ဆင်မှု သိမ်းမည်';announcementForm.scrollIntoView({behavior:'smooth',block:'start'});announcementForm.elements.title.focus();});
            const remove=document.createElement('button');remove.type='button';remove.className='secondary-button announcement-delete';remove.textContent='ဖျက်မည်';remove.addEventListener('click',async()=>{if(!confirm('ဒီကြေညာချက်ကို ဖျက်မှာ သေချာပါသလား။'))return;remove.disabled=true;try{await AdminApi.deleteAnnouncement(item.id);announcementStatus.textContent='ကြေညာချက်ကို ဖျက်ပြီးပါပြီ။';await refreshAnnouncements();}catch(error){announcementStatus.textContent=error.message;remove.disabled=false;}});
            actions.append(toggle,edit,remove);card.append(top,title,body,actions);announcementItems.append(card);
        }
    }catch(error){announcementStatus.textContent=error.message;}
}
announcementForm.addEventListener('submit',async event=>{event.preventDefault();if(!announcementForm.reportValidity())return;const data=new FormData(announcementForm),button=announcementForm.querySelector('[type="submit"]');button.disabled=true;try{const id=String(data.get('id')||'');if(id)await AdminApi.updateAnnouncement(id,String(data.get('title')).trim(),String(data.get('body')).trim());else await AdminApi.saveAnnouncement(String(data.get('title')).trim(),String(data.get('body')).trim());resetEditor();announcementStatus.textContent=id?'ပြင်ဆင်မှုကို သိမ်းပြီးပါပြီ။':'ကြေညာချက်ကို သိမ်းပြီးပါပြီ။ Customer app မှာပြရန် သီးခြားရွေးပါ။';await refreshAnnouncements();}catch(error){announcementStatus.textContent=error.message;}finally{button.disabled=false;}});
cancelEdit.addEventListener('click',resetEditor);
refreshAnnouncements();
