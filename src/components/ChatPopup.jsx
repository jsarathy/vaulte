// src/components/ChatPopup.jsx
import { useRef } from "react";
import { fmt } from "../constants/helpers";
import { C, FONT, border, IconChat, IconSend, IconX, IconTrash } from "../constants/design";

export default function ChatPopup({ chatOpen, setChatOpen, chatMessages, setChatMessages, chatInput, setChatInput, chatMealId, setChatMealId, chatDate, setChatDate, chatLoading, justChatHistory, CHAT_CONTEXT_LIMIT, clearChat, sendChat, confirmLog, allDays, currentDayData }) {
  const chatBottomRef = useRef(null);

  return (
    <div style={{ position:"absolute", bottom:"16px", right:"16px", zIndex:500 }}>
      {chatOpen && (
        <div style={{ position:"absolute", bottom:"60px", right:0, width:"380px", height:"520px", background:"#fff", borderRadius:"10px", boxShadow:"0 8px 32px rgba(0,0,0,0.14)", border:`0.5px solid ${C.border}`, display:"flex", flexDirection:"column", overflow:"hidden", fontFamily:FONT.sans }}>
          {/* Header */}
          <div style={{ padding:"10px 14px", borderBottom:border, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <span style={{ fontWeight:"500", fontSize:"12px", color:C.text }}>Nutrition assistant</span>
            <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
              {chatMessages.length>0&&(
                <button onClick={clearChat} title="Clear history" style={{ background:"transparent", border:`0.5px solid ${C.border}`, borderRadius:"4px", padding:"2px 8px", fontSize:"10px", color:C.muted, cursor:"pointer", fontFamily:FONT.sans, display:"flex", alignItems:"center", gap:"4px" }}>
                  <IconTrash size={10}/> Clear
                </button>
              )}
              <button onClick={()=>setChatOpen(false)} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, fontSize:"16px", lineHeight:1, padding:"0 2px" }}>×</button>
            </div>
          </div>

          {/* Context bar */}
          <div style={{ padding:"6px 10px", background:C.bg, borderBottom:border, display:"flex", alignItems:"center", gap:"6px", fontSize:"11px", flexShrink:0 }}>
            <input type="date" value={chatDate} onChange={e=>setChatDate(e.target.value)}
              style={{ fontSize:"11px", fontWeight:"500", color:C.text, border:`0.5px solid ${C.borderMid}`, borderRadius:"4px", padding:"2px 6px", fontFamily:FONT.mono, outline:"none", background:"#fff" }}/>
            <select value={chatMealId} onChange={e=>setChatMealId(e.target.value)}
              style={{ flex:1, padding:"3px 6px", border:`0.5px solid ${C.borderMid}`, borderRadius:"4px", fontSize:"11px", fontFamily:FONT.sans, background:"#fff", outline:"none" }}>
              <option value="__chat__">Chat mode</option>
              {(allDays.find(d=>d.date===chatDate)||currentDayData)?.meals?.filter(m=>!m.is_exercise).map(m=>(
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:"auto", padding:"10px", display:"flex", flexDirection:"column", gap:"7px" }}>
            {chatMessages.length===0&&(
              <div style={{ background:C.bg, border:`0.5px solid ${C.border}`, borderRadius:"6px", padding:"10px 12px", textAlign:"center", fontSize:"11px", color:C.muted, marginTop:"8px", lineHeight:1.6 }}>
                <div style={{ fontWeight:"500", color:C.text, marginBottom:"4px" }}>Chat mode</div>
                Ask nutrition questions, or switch to a meal slot above to log food by description.
              </div>
            )}
            {chatMessages.length>0&&(
              <div style={{ textAlign:"center", fontSize:"10px", color:C.hint, padding:"2px 0 2px" }}>
                {justChatHistory.length>= CHAT_CONTEXT_LIMIT ? `Last ${CHAT_CONTEXT_LIMIT} messages` : `${justChatHistory.length} messages`}
              </div>
            )}
            {chatMessages.map(msg=>{
              if (msg.type==="user") return (
                <div key={msg.id} style={{ background:C.blue, color:"#fff", alignSelf:"flex-end", borderRadius:"10px 10px 3px 10px", padding:"7px 11px", fontSize:"12px", lineHeight:1.5, maxWidth:"82%" }}>{msg.text}</div>
              );
              if (msg.type==="error") return (
                <div key={msg.id} style={{ background:C.dangerBg, color:C.danger, alignSelf:"center", border:`0.5px solid #f09595`, fontSize:"11px", borderRadius:"6px", padding:"7px 11px" }}>{msg.text}</div>
              );
              if (msg.type==="preview"&&!msg.confirmed) {
                const tKcal=msg.items.reduce((s,i)=>s+i.kcal,0);
                const tFat=msg.items.reduce((s,i)=>s+i.fat,0);
                const tCarbs=msg.items.reduce((s,i)=>s+i.carbs,0);
                const tFibre=msg.items.reduce((s,i)=>s+i.fibre,0);
                const tProt=msg.items.reduce((s,i)=>s+i.protein,0);
                return (
                  <div key={msg.id} style={{ background:"#fff", border:`0.5px solid ${C.border}`, alignSelf:"flex-start", borderRadius:"10px 10px 10px 3px", padding:"9px 11px", fontSize:"12px", maxWidth:"96%", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontSize:"10px", color:C.muted, marginBottom:"6px" }}>Adding to <strong style={{ color:C.text }}>{msg.mealName}</strong></div>
                    <div style={{ overflowX:"auto" }}>
                      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"10px", minWidth:"280px" }}>
                        <thead><tr style={{ background:C.bg }}>
                          {["Item","kcal","Fat","Carbs","Fibre","Prot"].map(h=><th key={h} style={{ color:C.hint, padding:"3px 5px", textAlign:h==="Item"?"left":"right", fontWeight:"500", fontSize:"9px", textTransform:"uppercase", letterSpacing:"0.4px", fontFamily:FONT.sans }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {msg.items.map((item,i)=>(
                            <tr key={i} style={{ borderBottom:`0.5px solid ${C.border}` }}>
                              <td style={{ padding:"3px 5px", maxWidth:"130px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:C.text }}>{item.name}</td>
                              {[item.kcal,item.fat,item.carbs,item.fibre,item.protein].map((v,j)=><td key={j} style={{ padding:"3px 5px", textAlign:"right", color:C.muted, fontFamily:FONT.mono }}>{fmt(v)}{j>0?"g":""}</td>)}
                            </tr>
                          ))}
                          <tr style={{ background:C.bg }}>
                            <td style={{ padding:"3px 5px", fontWeight:"500", color:C.text, fontSize:"10px" }}>Total</td>
                            {[tKcal,tFat,tCarbs,tFibre,tProt].map((v,i)=><td key={i} style={{ padding:"3px 5px", textAlign:"right", fontWeight:"500", color:C.text, fontFamily:FONT.mono }}>{fmt(v)}{i>0?"g":""}</td>)}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display:"flex", gap:"6px", marginTop:"8px", justifyContent:"flex-end" }}>
                      <button onClick={()=>setChatMessages(prev=>prev.filter(m=>m.id!==msg.id))}
                        style={{ background:"transparent", border:`0.5px solid ${C.borderMid}`, color:C.muted, borderRadius:"4px", padding:"4px 10px", fontSize:"11px", cursor:"pointer", fontFamily:FONT.sans }}>Discard</button>
                      <button onClick={()=>confirmLog(msg.id)}
                        style={{ background:C.blue, color:"#fff", border:"none", borderRadius:"4px", padding:"4px 10px", fontSize:"11px", cursor:"pointer", fontFamily:FONT.sans, fontWeight:"500" }}>Log to {msg.mealName}</button>
                    </div>
                  </div>
                );
              }
              if (msg.type==="preview"&&msg.confirmed) return (
                <div key={msg.id} style={{ alignSelf:"flex-start", fontSize:"11px", color:C.greenText, fontWeight:"500" }}>
                  Logged {msg.items.length} item{msg.items.length!==1?"s":""}
                </div>
              );
              return (
                <div key={msg.id} style={{ background:C.bg, color:C.text, alignSelf:"flex-start", border:`0.5px solid ${C.border}`, borderRadius:"10px 10px 10px 3px", padding:"8px 11px", fontSize:"12px", lineHeight:1.6, maxWidth:"88%" }}
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
              style={{ flex:1, padding:"7px 9px", border:`0.5px solid ${C.borderMid}`, borderRadius:"6px", fontSize:"12px", resize:"none", height:"46px", fontFamily:FONT.sans, outline:"none", color:C.text, background:C.bg }}/>
            <button onClick={sendChat} disabled={chatLoading}
              style={{ background:chatLoading?C.hint:C.blue, color:"#fff", border:"none", borderRadius:"6px", padding:"0 12px", cursor:chatLoading?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", alignSelf:"stretch" }}>
              <IconSend size={13}/>
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
