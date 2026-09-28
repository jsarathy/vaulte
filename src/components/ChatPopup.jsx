// src/components/ChatPopup.jsx
import { useRef, useState, useEffect } from "react";
import { fmt } from "../constants/helpers";
import { C, FONT, border, IconChat, IconSend, IconX, IconTrash } from "../constants/design";

export default function ChatPopup({ chatOpen, setChatOpen, chatMessages, setChatMessages, chatInput, setChatInput, chatMealId, setChatMealId, chatDate, setChatDate, chatLoading, justChatHistory, CHAT_CONTEXT_LIMIT, clearChat, sendChat, confirmLog, allDays, currentDayData }) {
  const chatBottomRef = useRef(null);

  // Resizable window (Fix 9): drag the top edge, left edge or top-left corner.
  // Anchored bottom-right above the bubble, so growing up/left keeps it on screen. Size is remembered.
  // Bounded by the panel the bubble sits in (it clips overflow), not the whole browser window.
  const MIN = { w: 340, h: 420 };
  const wrapRef = useRef(null);
  const clamp = (w, h) => {
    const box = wrapRef.current?.offsetParent;
    const maxW = (box ? box.clientWidth : window.innerWidth) - 32;
    const maxH = (box ? box.clientHeight : window.innerHeight) - 92; // room for the bubble below
    return {
      w: Math.round(Math.min(Math.max(w, MIN.w), Math.max(MIN.w, maxW))),
      h: Math.round(Math.min(Math.max(h, MIN.h), Math.max(MIN.h, maxH))),
    };
  };
  const [size, setSize] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem("vaulte_chat_size") || "null"); if (v?.w && v?.h) return clamp(v.w, v.h); } catch {}
    return clamp(540, 680);
  });
  const sizeRef = useRef(size); sizeRef.current = size;
  useEffect(() => {
    const onResize = () => setSize(s => clamp(s.w, s.h));
    onResize(); // re-fit to the panel once mounted / opened
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [chatOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const startResize = (dirX, dirY) => (e) => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, sw = sizeRef.current.w, sh = sizeRef.current.h;
    const move = ev => setSize(clamp(dirX ? sw + (sx - ev.clientX) : sw, dirY ? sh + (sy - ev.clientY) : sh));
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
      try { localStorage.setItem("vaulte_chat_size", JSON.stringify(sizeRef.current)); } catch {}
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  return (
    <div ref={wrapRef} style={{ position:"absolute", bottom:"16px", right:"16px", zIndex:500 }}>
      {chatOpen && (
        <div style={{ position:"absolute", bottom:"60px", right:0, width:`${size.w}px`, height:`${size.h}px`, background:"#fff", borderRadius:"10px", boxShadow:"0 8px 32px rgba(0,0,0,0.14)", border:`0.5px solid ${C.border}`, display:"flex", flexDirection:"column", overflow:"hidden", fontFamily:FONT.sans }}>
          {/* Resize handles: top edge, left edge, top-left corner */}
          <div onPointerDown={startResize(false, true)} title="Drag to resize"
            style={{ position:"absolute", top:0, left:12, right:0, height:"6px", cursor:"ns-resize", zIndex:2 }}/>
          <div onPointerDown={startResize(true, false)} title="Drag to resize"
            style={{ position:"absolute", top:12, left:0, bottom:0, width:"6px", cursor:"ew-resize", zIndex:2 }}/>
          <div onPointerDown={startResize(true, true)} title="Drag to resize"
            style={{ position:"absolute", top:0, left:0, width:"14px", height:"14px", cursor:"nwse-resize", zIndex:3 }}/>
          {/* Header */}
          <div style={{ padding:"10px 14px", borderBottom:border, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <span style={{ fontWeight:"500", fontSize:"18px", color:C.text }}>Nutrition assistant</span>
            <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
              {chatMessages.length>0&&(
                <button onClick={clearChat} title="Clear history" style={{ background:"transparent", border:`0.5px solid ${C.border}`, borderRadius:"4px", padding:"2px 8px", fontSize:"15px", color:C.muted, cursor:"pointer", fontFamily:FONT.sans, display:"flex", alignItems:"center", gap:"4px" }}>
                  <IconTrash size={15}/> Clear
                </button>
              )}
              <button onClick={()=>setChatOpen(false)} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, fontSize:"24px", lineHeight:1, padding:"0 2px" }}>×</button>
            </div>
          </div>

          {/* Context bar */}
          <div style={{ padding:"6px 10px", background:C.bg, borderBottom:border, display:"flex", alignItems:"center", gap:"6px", fontSize:"16px", flexShrink:0 }}>
            <input type="date" value={chatDate} onChange={e=>setChatDate(e.target.value)}
              style={{ fontSize:"16px", fontWeight:"500", color:C.text, border:`0.5px solid ${C.borderMid}`, borderRadius:"4px", padding:"2px 6px", fontFamily:FONT.mono, outline:"none", background:"#fff" }}/>
            <select value={chatMealId} onChange={e=>setChatMealId(e.target.value)}
              style={{ flex:1, padding:"3px 6px", border:`0.5px solid ${C.borderMid}`, borderRadius:"4px", fontSize:"16px", fontFamily:FONT.sans, background:"#fff", outline:"none" }}>
              <option value="__chat__">Chat mode</option>
              {(allDays.find(d=>d.date===chatDate)||currentDayData)?.meals?.filter(m=>!m.is_exercise).map(m=>(
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:"auto", padding:"10px", display:"flex", flexDirection:"column", gap:"7px" }}>
            {chatMessages.length===0&&(
              <div style={{ background:C.bg, border:`0.5px solid ${C.border}`, borderRadius:"6px", padding:"10px 12px", textAlign:"center", fontSize:"16px", color:C.muted, marginTop:"8px", lineHeight:1.6 }}>
                <div style={{ fontWeight:"500", color:C.text, marginBottom:"4px" }}>Chat mode</div>
                Ask nutrition questions, or switch to a meal slot above to log food by description.
              </div>
            )}
            {chatMessages.length>0&&(
              <div style={{ textAlign:"center", fontSize:"15px", color:C.hint, padding:"2px 0 2px" }}>
                {justChatHistory.length>= CHAT_CONTEXT_LIMIT ? `Last ${CHAT_CONTEXT_LIMIT} messages` : `${justChatHistory.length} messages`}
              </div>
            )}
            {chatMessages.map(msg=>{
              if (msg.type==="user") return (
                <div key={msg.id} style={{ background:C.blue, color:"#fff", alignSelf:"flex-end", borderRadius:"10px 10px 3px 10px", padding:"7px 11px", fontSize:"18px", lineHeight:1.5, maxWidth:"82%" }}>{msg.text}</div>
              );
              if (msg.type==="error") return (
                <div key={msg.id} style={{ background:C.dangerBg, color:C.danger, alignSelf:"center", border:`0.5px solid #f09595`, fontSize:"16px", borderRadius:"6px", padding:"7px 11px" }}>{msg.text}</div>
              );
              if (msg.type==="preview"&&!msg.confirmed) {
                const tKcal=msg.items.reduce((s,i)=>s+i.kcal,0);
                const tFat=msg.items.reduce((s,i)=>s+i.fat,0);
                const tCarbs=msg.items.reduce((s,i)=>s+i.carbs,0);
                const tFibre=msg.items.reduce((s,i)=>s+i.fibre,0);
                const tProt=msg.items.reduce((s,i)=>s+i.protein,0);
                return (
                  <div key={msg.id} style={{ background:"#fff", border:`0.5px solid ${C.border}`, alignSelf:"flex-start", borderRadius:"10px 10px 10px 3px", padding:"9px 11px", fontSize:"18px", maxWidth:"96%", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontSize:"15px", color:C.muted, marginBottom:"6px" }}>Adding to <strong style={{ color:C.text }}>{msg.mealName}</strong></div>
                    <div style={{ overflowX:"auto" }}>
                      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"15px", minWidth:"400px" }}>
                        <thead><tr style={{ background:C.bg }}>
                          {["Item","kcal","Fat","Carbs","Fibre","Prot"].map(h=><th key={h} style={{ color:C.hint, padding:"3px 5px", textAlign:h==="Item"?"left":"right", fontWeight:"500", fontSize:"14px", textTransform:"uppercase", letterSpacing:"0.4px", fontFamily:FONT.sans }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {msg.items.map((item,i)=>(
                            <tr key={i} style={{ borderBottom:`0.5px solid ${C.border}` }}>
                              <td style={{ padding:"3px 5px", maxWidth:"200px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:C.text }}>{item.name}</td>
                              {[item.kcal,item.fat,item.carbs,item.fibre,item.protein].map((v,j)=><td key={j} style={{ padding:"3px 5px", textAlign:"right", color:C.muted, fontFamily:FONT.mono }}>{fmt(v)}{j>0?"g":""}</td>)}
                            </tr>
                          ))}
                          <tr style={{ background:C.bg }}>
                            <td style={{ padding:"3px 5px", fontWeight:"500", color:C.text, fontSize:"15px" }}>Total</td>
                            {[tKcal,tFat,tCarbs,tFibre,tProt].map((v,i)=><td key={i} style={{ padding:"3px 5px", textAlign:"right", fontWeight:"500", color:C.text, fontFamily:FONT.mono }}>{fmt(v)}{i>0?"g":""}</td>)}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display:"flex", gap:"6px", marginTop:"8px", justifyContent:"flex-end" }}>
                      <button onClick={()=>setChatMessages(prev=>prev.filter(m=>m.id!==msg.id))}
                        style={{ background:"transparent", border:`0.5px solid ${C.borderMid}`, color:C.muted, borderRadius:"4px", padding:"4px 10px", fontSize:"16px", cursor:"pointer", fontFamily:FONT.sans }}>Discard</button>
                      <button onClick={()=>confirmLog(msg.id)}
                        style={{ background:C.blue, color:"#fff", border:"none", borderRadius:"4px", padding:"4px 10px", fontSize:"16px", cursor:"pointer", fontFamily:FONT.sans, fontWeight:"500" }}>Log to {msg.mealName}</button>
                    </div>
                  </div>
                );
              }
              if (msg.type==="preview"&&msg.confirmed) return (
                <div key={msg.id} style={{ alignSelf:"flex-start", fontSize:"16px", color:C.greenText, fontWeight:"500" }}>
                  Logged {msg.items.length} item{msg.items.length!==1?"s":""}
                </div>
              );
              return (
                <div key={msg.id} style={{ background:C.bg, color:C.text, alignSelf:"flex-start", border:`0.5px solid ${C.border}`, borderRadius:"10px 10px 10px 3px", padding:"8px 11px", fontSize:"18px", lineHeight:1.6, maxWidth:"88%" }}
                  dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g,"<br/>") }}/>
              );
            })}
            <div ref={chatBottomRef}/>
          </div>

          {/* Input */}
          <div style={{ padding:"8px 10px", borderTop:border, display:"flex", gap:"6px", flexShrink:0, background:"#fff" }}>
            <textarea value={chatInput} onChange={e=>setChatInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat();} }}
              placeholder={chatMealId==="__chat__" ? "Ask me anything…" : "Describe what you ate…"}
              style={{ flex:1, padding:"7px 9px", border:`0.5px solid ${C.borderMid}`, borderRadius:"6px", fontSize:"18px", resize:"none", height:"66px", fontFamily:FONT.sans, outline:"none", color:C.text, background:C.bg }}/>
            <button onClick={sendChat} disabled={chatLoading}
              style={{ background:chatLoading?C.hint:C.blue, color:"#fff", border:"none", borderRadius:"6px", padding:"0 12px", cursor:chatLoading?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", alignSelf:"stretch" }}>
              <IconSend size={19}/>
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button onClick={()=>setChatOpen(o=>!o)} title="Nutrition assistant"
        style={{ width:"46px", height:"46px", borderRadius:"50%", background:chatOpen?"#fff":C.blue, color:chatOpen?C.blue:"#fff", border:`0.5px solid ${chatOpen?C.blue:C.blue}`, boxShadow:"0 2px 12px rgba(55,138,221,0.3)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
        {chatOpen
          ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
          : <IconChat size={18}/>
        }
      </button>
    </div>
  );
}
