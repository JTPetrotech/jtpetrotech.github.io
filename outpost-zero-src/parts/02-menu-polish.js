/* ---------- menu polish ----------
   A tactical finish for the menus, layered over 00-head.html's styles: the
   card gets corner brackets and an amber rail, the title a stencil sheen,
   choices glow when picked, and the go button sweeps when you land on it.
   It is added from here rather than written into the head so it can be
   changed without touching the page's own stylesheet. Selectors only - no
   ids the game uses are renamed or moved. */
(function () {
  const css = `
.ov{background:
  radial-gradient(60% 45% at 50% 0%,rgba(255,181,71,.14),transparent 70%),
  repeating-linear-gradient(0deg,rgba(255,255,255,.018) 0 1px,transparent 1px 3px),
  radial-gradient(ellipse at center,rgba(12,16,19,.5),rgba(12,16,19,.9))}
.ov .card{position:relative;background:linear-gradient(180deg,rgba(24,32,38,.92),rgba(14,19,23,.94));
  border-color:rgba(214,228,234,.14);
  box-shadow:0 30px 80px -24px rgba(0,0,0,.85),inset 0 1px 0 rgba(255,255,255,.05);
  --br:linear-gradient(var(--signal),var(--signal));
  background-image:
    var(--br),var(--br),var(--br),var(--br),var(--br),var(--br),var(--br),var(--br),
    linear-gradient(180deg,rgba(24,32,38,.92),rgba(14,19,23,.94));
  background-size:18px 2px,2px 18px,18px 2px,2px 18px,18px 2px,2px 18px,18px 2px,2px 18px,auto;
  background-position:0 0,0 0,100% 0,100% 0,0 100%,0 100%,100% 100%,100% 100%,0 0;
  background-repeat:no-repeat}
.ov .card::before{content:"";position:absolute;left:28px;right:28px;top:0;height:3px;
  background:linear-gradient(90deg,var(--signal),rgba(255,181,71,.15) 60%,transparent)}
.ov:not([hidden]) .card{animation:ozRise .4s cubic-bezier(.2,.8,.2,1) both}
@keyframes ozRise{from{opacity:0;transform:translateY(14px)}}

.eyebrow{display:inline-flex;align-items:center;gap:10px}
.eyebrow::before{content:"";width:26px;height:10px;flex:0 0 auto;
  background:repeating-linear-gradient(135deg,var(--signal) 0 4px,transparent 4px 8px)}
h1{background:linear-gradient(180deg,#ffffff 0%,#e3eaec 50%,#a9b6bb 51%,#dfe6e8 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 3px 0 rgba(0,0,0,.5))}
.sec>.k{color:#c9d4d8;display:flex;align-items:center;gap:10px}
.sec>.k::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--line2),transparent)}

.chips button{transition:border-color .14s,background .14s,color .14s,box-shadow .14s,transform .14s}
.chips button:hover:not(:disabled),.chips button.pn-focus{border-color:var(--line2);background:rgba(255,255,255,.08);transform:translateY(-1px)}
.chips button.on{background:linear-gradient(180deg,rgba(255,181,71,.2),rgba(255,181,71,.08));
  box-shadow:0 0 0 1px rgba(255,181,71,.35) inset,0 10px 24px -14px rgba(255,181,71,.9)}
.chips button.on b{color:#ffd79a}

button.go{position:relative;overflow:hidden;background:linear-gradient(180deg,#ffc76e,#ffa928);
  box-shadow:0 10px 26px -12px rgba(255,181,71,.9);transition:filter .12s,transform .12s}
button.go::after{content:"";position:absolute;top:0;bottom:0;width:40%;left:-60%;
  background:linear-gradient(100deg,transparent,rgba(255,255,255,.45),transparent);transform:skewX(-18deg);transition:left .45s ease}
button.go:hover::after,button.go.pn-focus::after{left:120%}
button.go:hover:not(:disabled),button.go.pn-focus{transform:translateY(-2px);filter:brightness(1.06)}
button.alt{transition:border-color .14s,background .14s,transform .14s}
button.alt:hover,button.alt.pn-focus{border-color:var(--signal);background:rgba(255,181,71,.08);transform:translateY(-1px)}
input.txt,select.txt{transition:border-color .14s,box-shadow .14s}
input.txt:focus,select.txt:focus{border-color:var(--signal);box-shadow:0 0 0 3px rgba(255,181,71,.18);outline:none}
a.arcade{transition:color .14s,border-color .14s}
a.arcade:hover{border-color:var(--signal)}

@media (prefers-reduced-motion:reduce){.ov:not([hidden]) .card{animation:none}button.go::after{display:none}}
`;
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
})();
