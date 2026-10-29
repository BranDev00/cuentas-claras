var sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
var items=[],tab="owed",els={},current=null,shown=0,shownCur="",uid=null,pending="";
var calm=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function $(id){return document.getElementById(id)}
function say(id,t,ok){var e=$(id);e.textContent=t||"";e.className="msg"+(ok?" ok":"")}
function back(){return location.origin+location.pathname}

/* ---------- Monedas ---------- */
var CURRENCIES=[["COP","Peso colombiano"],["USD","Dólar estadounidense"],["EUR","Euro"],["MXN","Peso mexicano"],["ARS","Peso argentino"],["CLP","Peso chileno"],["PEN","Sol peruano"],["BRL","Real brasileño"],["UYU","Peso uruguayo"],["BOB","Boliviano"],["PYG","Guaraní paraguayo"],["VES","Bolívar venezolano"],["CRC","Colón costarricense"],["GTQ","Quetzal guatemalteco"],["HNL","Lempira hondureño"],["NIO","Córdoba nicaragüense"],["DOP","Peso dominicano"],["CUP","Peso cubano"],["GBP","Libra esterlina"],["CAD","Dólar canadiense"],["CHF","Franco suizo"],["JPY","Yen japonés"],["CNY","Yuan chino"],["INR","Rupia india"],["AUD","Dólar australiano"]];
var REGION={CO:"COP",MX:"MXN",AR:"ARS",US:"USD",ES:"EUR",CL:"CLP",PE:"PEN",BR:"BRL",UY:"UYU",BO:"BOB",PY:"PYG",VE:"VES",CR:"CRC",GT:"GTQ",DO:"DOP",EC:"USD",PA:"USD",GB:"GBP",CA:"CAD"};
function initialCur(){
  try{var s=localStorage.getItem("cc-currency");if(s)return s}catch(e){}
  var r=(navigator.language||"").split("-")[1];
  return REGION[(r||"").toUpperCase()]||"USD";
}
var cur=initialCur(),fmts={};
function money(n,c){
  try{
    fmts[c]=fmts[c]||new Intl.NumberFormat("es-CO",{style:"currency",currency:c,minimumFractionDigits:0,maximumFractionDigits:2});
    return fmts[c].format(n);
  }catch(e){return c+" "+n}
}
["curSel","curAdd"].forEach(function(id){
  CURRENCIES.forEach(function(c){var o=document.createElement("option");o.value=c[0];o.textContent=c[0]+" · "+c[1];$(id).appendChild(o)});
  $(id).value=cur;
  $(id).onchange=function(){setCur(this.value)};
});
function setCur(c){
  cur=c;try{localStorage.setItem("cc-currency",c)}catch(e){}
  $("curSel").value=c;$("curAdd").value=c;render();
}

/* ---------- Pantallas ---------- */
var VIEWS=["login","reg","sent","app"],TERMS_VERSION="2026-10-29";
function view(n){VIEWS.forEach(function(v){$(v).hidden=v!==n});$("top").hidden=n!=="app";$("delOpen").hidden=n!=="app";window.scrollTo(0,0)}
function onUser(user){
  if(user){if(uid!==user.id){uid=user.id;view("app");load()}}
  else if(uid){uid=null;items=[];clearField();view("login")}
}
sb.auth.getSession().then(function(r){onUser(r.data.session&&r.data.session.user)});
sb.auth.onAuthStateChange(function(_e,s){onUser(s&&s.user)});

/* ---------- Iniciar sesión ---------- */
$("af").onsubmit=function(e){
  e.preventDefault();say("amsg","");
  sb.auth.signInWithPassword({email:$("email").value.trim(),password:$("pass").value}).then(function(r){
    if(!r.error)return;
    say("amsg",/not confirmed/i.test(r.error.message)
      ?"Aún no has confirmado tu correo. Abre el enlace que te enviamos (revisa también spam)."
      :"No pudimos entrar: revisa tu correo y contraseña.");
  });
};
$("goReg").onclick=function(){say("amsg","");view("reg")};
$("goLogin").onclick=function(){say("rmsg","");view("login")};
$("out").onclick=function(){sb.auth.signOut()};

/* ---------- Registro con verificación de correo ---------- */
$("rf").onsubmit=function(e){
  e.preventDefault();say("rmsg","");
  var em=$("remail").value.trim(),pw=$("rpass").value;
  if(pw.length<8){say("rmsg","La contraseña debe tener al menos 8 caracteres.");return}
  if(pw!==$("rpass2").value){say("rmsg","Las contraseñas no coinciden.");return}
  if(!$("rterms").checked){say("rmsg","Debes aceptar la política de privacidad y los términos para crear la cuenta.");return}
  var b=$("rbtn");b.disabled=true;
  sb.auth.signUp({email:em,password:pw,options:{emailRedirectTo:back(),data:{accepted_terms_at:new Date().toISOString(),terms_version:TERMS_VERSION}}}).then(function(r){
    b.disabled=false;
    if(r.error){say("rmsg","No pudimos crear la cuenta: "+r.error.message);return}
    if(r.data.session){
      sb.auth.signOut();
      say("rmsg","La verificación por correo está desactivada en Supabase. Actívala en Authentication > Sign In / Providers > Email > Confirm email.");
      return;
    }
    var u=r.data.user;
    if(u&&u.identities&&!u.identities.length){say("rmsg","Ese correo ya tiene una cuenta. Inicia sesión.");return}
    pending=em;$("sentTo").textContent=em;$("rf").reset();say("smsg","");view("sent");cooldown();
  });
};
$("toLogin").onclick=function(){$("email").value=pending;say("amsg","");view("login")};
$("resend").onclick=function(){
  sb.auth.resend({type:"signup",email:pending,options:{emailRedirectTo:back()}}).then(function(r){
    say("smsg",r.error?"No pudimos reenviarlo ahora. Espera un minuto e intenta de nuevo.":"Listo, te lo enviamos otra vez.",!r.error);
    cooldown();
  });
};
function cooldown(){
  var b=$("resend"),n=30;b.disabled=true;b.textContent="Reenviar correo (30s)";
  var t=setInterval(function(){
    n--;b.textContent=n>0?"Reenviar correo ("+n+"s)":"Reenviar correo";
    if(n<=0){clearInterval(t);b.disabled=false}
  },1000);
}

/* ---------- Datos ---------- */
function load(){
  sb.from("debts").select("*").order("created_at",{ascending:false}).then(function(r){
    if(r.error){say("msg","No pudimos cargar tus deudas. Recarga la página.");return}
    items=r.data;items.forEach(function(i){i.currency=i.currency||"COP"});render();
  });
}
$("f").onsubmit=function(e){
  e.preventDefault();say("msg","");
  sb.from("debts").insert({who:$("who").value.trim(),amount:parseFloat($("amt").value),currency:cur,note:$("note").value.trim()||null,direction:tab})
    .select().then(function(r){
      if(r.error){say("msg","No se pudo agregar la deuda. Intenta de nuevo.");return}
      items.unshift(r.data[0]);$("f").reset();$("curAdd").value=cur;$("addD").close();render();
    });
};
$("dPaid").onclick=function(){
  var i=current;if(!i)return;
  sb.from("debts").update({paid:!i.paid}).eq("id",i.id).then(function(r){
    if(r.error){say("msg","No se pudo actualizar.");return}
    i.paid=!i.paid;$("detD").close();
    if(i.paid)burst(i);
    render();
  });
};
$("dDel").onclick=function(){
  var i=current;if(!i)return;
  sb.from("debts").delete().eq("id",i.id).then(function(r){
    if(r.error){say("msg","No se pudo borrar.");return}
    items=items.filter(function(x){return x.id!==i.id});$("detD").close();render();
  });
};
$("clear").onclick=function(){
  var paid=items.filter(function(i){return i.paid&&i.direction===tab&&i.currency===cur});
  if(!paid.length)return;
  paid.forEach(function(i){burst(i)});
  sb.from("debts").delete().in("id",paid.map(function(i){return i.id})).then(function(r){
    if(r.error){say("msg","No se pudo quitar las pagadas.");return}
    items=items.filter(function(i){return paid.indexOf(i)<0});render();
  });
};

/* ---------- Burbujas ---------- */
function clearField(){$("field").innerHTML="";els={}}
function pack(rows,W,H){
  var placed=[],max=Math.max.apply(null,rows.filter(function(i){return !i.paid}).map(function(i){return Number(i.amount)}).concat([1]));
  var big=Math.min(W,H)*0.3,small=36;
  rows.slice().sort(function(a,b){return (a.paid-b.paid)||(b.amount-a.amount)}).forEach(function(i){
    var r=i.paid?24:small+(big-small)*Math.sqrt(Number(i.amount)/max),ok=false;
    while(!ok&&r>12){
      for(var t=0;t<2500&&!ok;t+=1){
        var ang=t*0.55,d=t*0.22,x=W/2+Math.cos(ang)*d*1.15,y=H/2+Math.sin(ang)*d*0.9;
        if(x<r||x>W-r||y<r||y>H-r)continue;
        ok=placed.every(function(p){var dx=p.x-x,dy=p.y-y;return Math.sqrt(dx*dx+dy*dy)>=p.r+r+6});
        if(ok)placed.push({i:i,x:x,y:y,r:r});
      }
      if(!ok)r*=0.9;
    }
  });
  return placed;
}
function render(){
  $("app").setAttribute("data-tab",tab);
  var rows=items.filter(function(i){return i.direction===tab&&i.currency===cur});
  var open=rows.filter(function(i){return !i.paid});
  var paidN=rows.length-open.length;
  var sum=open.reduce(function(s,i){return s+Number(i.amount)},0);
  $("lbl").textContent=tab==="owed"?"Te deben en total":"Tú debes en total";
  $("sub").textContent=open.length?open.length+(open.length===1?" deuda pendiente":" deudas pendientes"):"Nada pendiente por ahora";
  $("clearN").textContent=paidN;$("clear").disabled=!paidN;
  countTo(sum);

  /* otras monedas con deudas pendientes */
  var other={},oc=$("others");oc.innerHTML="";
  items.forEach(function(i){if(i.direction===tab&&!i.paid&&i.currency!==cur)other[i.currency]=(other[i.currency]||0)+1});
  var keys=Object.keys(other);oc.hidden=!keys.length;
  if(keys.length){
    var h=document.createElement("span");h.textContent="También tienes en:";oc.appendChild(h);
    keys.forEach(function(c){
      var b=document.createElement("button");b.type="button";b.className="chip";b.textContent=c+" · "+other[c];
      b.setAttribute("aria-label","Ver deudas en "+c);b.onclick=function(){setCur(c)};oc.appendChild(b);
    });
  }

  var f=$("field"),W=f.clientWidth,H=f.clientHeight,keep={};
  var old=f.querySelector(".empty");if(old)old.remove();
  if(!rows.length){clearField();f.innerHTML='<p class="empty">Toca “Nueva deuda” y mira crecer tu primera burbuja.</p>';return}
  pack(rows,W,H).forEach(function(p){
    var i=p.i,el=els[i.id];keep[i.id]=1;
    if(!el){
      el=document.createElement("button");el.type="button";el.innerHTML="<b></b><span></span>";
      el.onclick=function(){openDetail(el._i)};
      f.appendChild(el);els[i.id]=el;
    }
    el._i=i;
    el.className="bub "+(i.paid?"paid":i.direction);
    el.style.left=(p.x-p.r)+"px";el.style.top=(p.y-p.r)+"px";el.style.width=el.style.height=(p.r*2)+"px";
    el.setAttribute("aria-label",i.who+", "+money(i.amount,i.currency)+(i.paid?", pagada":""));
    var b=el.firstChild,s=el.lastChild;
    b.textContent=i.paid?"✓":i.who;b.style.fontSize=Math.max(10,Math.min(17,p.r/3.6))+"px";
    s.textContent=(!i.paid&&p.r>=38)?money(i.amount,i.currency):"";s.style.fontSize=Math.max(10,Math.min(15,p.r/4.6))+"px";
  });
  Object.keys(els).forEach(function(k){if(!keep[k]){els[k].remove();delete els[k]}});
}
function countTo(v){
  var from=shown,c=cur,t0=null;shown=v;
  var instant=calm||from===v||shownCur!==cur;shownCur=cur;
  if(instant){$("total").textContent=money(v,c);return}
  function step(t){
    if(!t0)t0=t;var k=Math.min(1,(t-t0)/600),e=1-Math.pow(1-k,3);
    $("total").textContent=money(from+(v-from)*e,c);
    if(k<1&&shown===v)requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
function burst(i){
  var el=els[i.id];if(calm||!el)return;
  var f=$("field"),cx=el.offsetLeft+el.offsetWidth/2,cy=el.offsetTop+el.offsetHeight/2;
  var cols=["#FFD23F","#12B76A","#F04438","#FFFFFF"];
  for(var n=0;n<18;n++){
    var p=document.createElement("i");p.className="p";p.style.left=cx+"px";p.style.top=cy+"px";p.style.background=cols[n%4];
    f.appendChild(p);var a=Math.random()*6.28,d=60+Math.random()*90;
    p.animate([{transform:"translate(0,0) scale(1)",opacity:1},{transform:"translate("+Math.cos(a)*d+"px,"+Math.sin(a)*d+"px) scale(0)",opacity:0}],{duration:800,easing:"cubic-bezier(.1,.8,.3,1)"}).onfinish=(function(q){return function(){q.remove()}})(p);
  }
}

/* ---------- Hojas y controles ---------- */
function openDetail(i){
  current=i;
  $("dWho").textContent=i.who;$("dAmt").textContent=money(i.amount,i.currency);
  $("dNote").textContent=i.note||"Sin nota";
  $("dDate").textContent=i.created_at?"Anotada el "+new Date(i.created_at).toLocaleDateString("es-CO",{day:"numeric",month:"long",year:"numeric"}):"";
  $("dPaid").textContent=i.paid?"Reabrir deuda":"Marcar como pagada";
  $("detD").showModal();
}
$("fab").onclick=function(){$("curAdd").value=cur;$("addD").showModal();$("who").focus()};
$("delOpen").onclick=function(){say("dmsg","");$("delD").showModal()};
$("delYes").onclick=function(){
  var b=this;b.disabled=true;say("dmsg","");
  sb.rpc("delete_my_account").then(function(r){
    b.disabled=false;
    if(r.error){say("dmsg","No pudimos eliminar la cuenta. Intenta de nuevo o escríbenos.");return}
    $("delD").close();sb.auth.signOut({scope:"local"});
  });
};
["addD","detD","delD"].forEach(function(id){
  var d=$(id);
  d.addEventListener("click",function(e){if(e.target===d||e.target.hasAttribute("data-close"))d.close()});
});
$("t-owed").onclick=function(){tab="owed";render()};
$("t-owe").onclick=function(){tab="owe";render()};
var rt;window.addEventListener("resize",function(){clearTimeout(rt);rt=setTimeout(function(){if(!$("app").hidden)render()},150)});
