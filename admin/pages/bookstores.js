const rowsElement=document.getElementById('store-rows');
const statusElement=document.getElementById('store-status');

function cellInput(row,key,value,type='text'){
    const cell=document.createElement('td'),input=document.createElement('input');
    input.dataset.field=key;input.type=type;input.value=value??'';
    if(type==='checkbox')input.checked=value!==false;
    cell.append(input);row.append(cell);
}
function renderStores(stores){
    rowsElement.replaceChildren();
    for(const store of stores){
        const row=document.createElement('tr');
        cellInput(row,'active',store.active,'checkbox');
        cellInput(row,'id',store.id);
        cellInput(row,'city',store.city);
        cellInput(row,'name',store.name);
        cellInput(row,'address',store.address);
        cellInput(row,'phones',(store.phones||[]).join(', '));
        const cell=document.createElement('td'),remove=document.createElement('button');
        remove.type='button';remove.className='secondary-button';remove.textContent='ဖယ်ရှား';remove.addEventListener('click',()=>row.remove());cell.append(remove);row.append(cell);
        rowsElement.append(row);
    }
}
function readStores(){
    return [...rowsElement.querySelectorAll('tr')].map(row=>{
        const values=Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input=>[input.dataset.field,input.type==='checkbox'?input.checked:input.value.trim()]));
        values.phones=values.phones.split(',').map(phone=>phone.trim()).filter(Boolean);
        return values;
    });
}
async function loadStores(){
    statusElement.textContent='စာရင်းရယူနေသည်…';
    try{renderStores(await AdminApi.getBookstores());statusElement.textContent='Database မှ ဆိုင်စာရင်းကို ရယူပြီးပါပြီ။';}
    catch(error){statusElement.textContent=`ရယူမရပါ။ ${error.message}`;statusElement.classList.add('error');}
}
document.getElementById('add-store').addEventListener('click',()=>{
    const stores=readStores();
    const numericIds=stores.map(store=>String(store.id).trim()).filter(id=>/^\d+$/.test(id)).map(Number);
    let nextId=(numericIds.length?Math.max(...numericIds):0)+1;
    const used=new Set(stores.map(store=>String(store.id).trim()));
    while(used.has(String(nextId)))nextId++;
    renderStores([...stores,{id:String(nextId),city:'',name:'',address:'',phones:[],active:true}]);
    rowsElement.lastElementChild?.querySelector('[data-field="city"]')?.focus();
});
document.getElementById('save-stores').addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;statusElement.className='status-message';statusElement.textContent='Database ထဲသိမ်းနေသည်…';
    try{renderStores(await AdminApi.saveBookstores(readStores()));statusElement.textContent='ဆိုင်စာရင်းကို database ထဲ သိမ်းပြီးပါပြီ။';statusElement.classList.add('success');}
    catch(error){statusElement.textContent=`သိမ်းမရပါ။ ${error.message}`;statusElement.classList.add('error');}
    finally{button.disabled=false;}
});
loadStores();
