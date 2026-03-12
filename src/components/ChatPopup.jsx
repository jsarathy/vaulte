// src/components/ChatPopup.jsx
import { useRef } from "react";
import { fmt } from "../utils";

export default function ChatPopup({
  chatOpen, setChatOpen,
  chatMessages, setChatMessages, chatInput, setChatInput,
  chatMealId, setChatMealId, chatDate, setChatDate,
  chatLoading, justChatHistory,
  CHAT_CONTEXT_LIMIT, chatBottomRef,
  allDays, currentDayData,
  sendChat, confirmLog, clearChat, S,
}) {
  return (
    {/* ── FLOATING CHAT BUTTON + POPUP ── */}
        <div style={{ position:"absolute", bottom:"16px", right:"16px", zIndex:500 }}>
          {/* Popup */}
          {chatOpen && (
            <div style={{ position:"absolute", bottom:"56px", right:0, width:"380px", height:"520px", background:"#fff", borderRadius:"12px", boxShadow:"0 8px 40px rgba(0,0,0,0.22)", border:"1px solid #DDEAF6", display:"flex", flexDirection:"column", overflow:"hidden" }}>
              {/* Popup header */}
              <div style={{ background:"#1F4E79", color:"#fff", padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
                <span style={{ fontWeight:"bold", fontSize:"13px" }}>🤖 Claude — Nutrition Assistant</span>
                <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                  {chatMessages.length > 0 && (
                    <button onClick={clearChat} title="Clear chat history"
                      style={{ background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", borderRadius:"4px", padding:"2px 8px", fontSize:"11px", cursor:"pointer" }}>
                      🗑 Clear
                    </button>
                  )}
                  <button onClick={() => setChatOpen(false)}
                    style={{ background:"none", border:"none", color:"#fff", fontSize:"18px", cursor:"pointer", lineHeight:1, padding:"0 2px" }}>×</button>
                </div>
              </div>

              {/* Meal bar */}
              <div style={{ padding:"7px 10px", background:"#D6E4F0", borderBottom:"1px solid #DDEAF6", display:"flex", alignItems:"center", gap:"7px", fontSize:"12px", flexShrink:0 }}>
                <input type="date" value={chatDate} onChange={e=>setChatDate(e.target.value)}
                  style={{ fontSize:"11px", fontWeight:"600", color:"#1F4E79", border:"1px solid #DDEAF6", borderRadius:"5px", padding:"2px 6px", cursor:"pointer" }}/>
                <select value={chatMealId} onChange={e=>setChatMealId(e.target.value)}
                  style={{ flex:1, padding:"3px 6px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"11px", background:"#fff" }}>
                  <option value="__chat__">💬 Just Chat</option>
                  {(allDays.find(d=>d.date===chatDate)||currentDayData)?.meals?.filter(m=>!m.is_exercise).map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Messages */}
              <div style={{ flex:1, overflowY:"auto", padding:"10px", display:"flex", flexDirection:"column", gap:"8px" }}>
                {chatMessages.length === 0 && (
                  <div style={{ background:"#FFF8E1", color:"#5D4037", alignSelf:"center", border:"1px solid #FFE082", fontSize:"11px", borderRadius:"6px", padding:"10px 12px", textAlign:"center", marginTop:"8px" }}>
                    👋 <strong>Just Chat</strong> — nutrition, recipes, health questions<br/><br/>
                    <strong>Meal slots</strong> — describe food to log it automatically
                  </div>
                )}
                {chatMessages.length > 0 && (
                  <div style={{ textAlign:"center", fontSize:"10px", color:"#A0B4C8", padding:"2px 0 4px" }}>
                    {justChatHistory.length >= CHAT_CONTEXT_LIMIT ? `Last ${CHAT_CONTEXT_LIMIT} messages in context` : `${justChatHistory.length} messages`}
                  </div>
                )}
                {chatMessages.map(msg => {
                  if (msg.type === "user") return (
                    <div key={msg.id} style={{ background:"#2E75B6", color:"#fff", alignSelf:"flex-end", borderRadius:"10px 10px 3px 10px", padding:"8px 11px", fontSize:"12px", lineHeight:1.5, maxWidth:"80%" }}>{msg.text}</div>
                  );
                  if (msg.type === "error") return (
                    <div key={msg.id} style={{ background:"#FFEBEE", color:"#c62828", alignSelf:"center", border:"1px solid #FFCDD2", fontSize:"11px", borderRadius:"6px", padding:"7px 11px" }}>{msg.text}</div>
                  );
                  if (msg.type === "preview" && !msg.confirmed) {
                    const tKcal = msg.items.reduce((s,i)=>s+i.kcal,0);
                    const tFat  = msg.items.reduce((s,i)=>s+i.fat,0);
                    const tCarbs= msg.items.reduce((s,i)=>s+i.carbs,0);
                    const tFibre= msg.items.reduce((s,i)=>s+i.fibre,0);
                    const tProt = msg.items.reduce((s,i)=>s+i.protein,0);
                    return (
                      <div key={msg.id} style={{ background:"#fff", border:"1px solid #DDEAF6", alignSelf:"flex-start", borderRadius:"10px 10px 10px 3px", padding:"9px 11px", fontSize:"12px", maxWidth:"95%", boxShadow:"0 1px 3px rgba(0,0,0,0.07)" }}>
                        <div style={{ fontSize:"10px", color:"#6B8CAE", marginBottom:"5px" }}>Adding to <strong>{msg.mealName}</strong>:</div>
                        <div style={{ overflowX:"auto" }}>
                          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"10px", minWidth:"280px" }}>
                            <thead><tr style={{ background:"#D6E4F0" }}>
                              {["Item","kcal","Fat","Carbs","Fibre","Prot"].map(h => <th key={h} style={{ color:"#1F4E79", padding:"2px 5px", textAlign:h==="Item"?"left":"right", fontWeight:"bold" }}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                              {msg.items.map((item,i) => (
                                <tr key={i} style={{ borderBottom:"1px solid #EEF4FA" }}>
                                  <td style={{ padding:"2px 5px", maxWidth:"130px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</td>
                                  {[item.kcal,item.fat,item.carbs,item.fibre,item.protein].map((v,j) => <td key={j} style={{ padding:"2px 5px", textAlign:"right" }}>{fmt(v)}{j>0?"g":""}</td>)}
                                </tr>
                              ))}
                              <tr style={{ background:"#D6E4F0", fontWeight:"bold" }}>
                                <td style={{ padding:"2px 5px" }}>Total</td>
                                {[tKcal,tFat,tCarbs,tFibre,tProt].map((v,i) => <td key={i} style={{ padding:"2px 5px", textAlign:"right" }}>{fmt(v)}{i>0?"g":""}</td>)}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div style={{ display:"flex", gap:"6px", marginTop:"8px", justifyContent:"flex-end" }}>
                          <button onClick={() => setChatMessages(prev => prev.filter(m => m.id !== msg.id))} style={{ ...S.btn("outline"), ...S.btn("sm") }}>✕ Discard</button>
                          <button onClick={() => confirmLog(msg.id)} style={{ ...S.btn("success"), ...S.btn("sm") }}>✓ Log to {msg.mealName}</button>
                        </div>
                      </div>
                    );
                  }
                  if (msg.type === "preview" && msg.confirmed) return (
                    <div key={msg.id} style={{ alignSelf:"flex-start", fontSize:"11px", color:"#2E7D32", fontWeight:"bold" }}>✓ Logged {msg.items.length} item{msg.items.length!==1?"s":""}</div>
                  );
                  return (
                    <div key={msg.id} style={{ background:"#F7FAFD", color:"#1a2a3a", alignSelf:"flex-start", border:"1px solid #DDEAF6", borderRadius:"10px 10px 10px 3px", padding:"8px 11px", fontSize:"12px", lineHeight:1.5, maxWidth:"88%", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" }}
                      dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g,"<br/>") }} />
                  );
                })}
                <div ref={chatBottomRef}/>
              </div>

              {/* Input */}
              <div style={{ padding:"8px 10px", borderTop:"1px solid #DDEAF6", display:"flex", gap:"6px", flexShrink:0, background:"#fff" }}>
                <textarea value={chatInput} onChange={e=>setChatInput(e.target.value)}
                  onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat();} }}
                  placeholder={chatMealId==="__chat__" ? "Ask me anything…" : "Describe what you ate…"}
                  style={{ flex:1, padding:"7px 9px", border:"1px solid #DDEAF6", borderRadius:"6px", fontSize:"12px", resize:"none", height:"48px", background:"#F0F4F8", fontFamily:"inherit" }}/>
                <button onClick={sendChat} disabled={chatLoading}
                  style={{ background:chatLoading?"#ccc":"#2E75B6", color:"#fff", border:"none", borderRadius:"6px", padding:"0 12px", cursor:chatLoading?"not-allowed":"pointer", fontSize:"16px", fontWeight:"bold", alignSelf:"stretch" }}>
                  ➤
                </button>
              </div>
            </div>
          )}

          {/* Floating button */}
          <button onClick={() => setChatOpen(o => !o)}
            title="Claude Nutrition Assistant"
            style={{ width:"48px", height:"48px", borderRadius:"50%", background:"#1F4E79", color:"#fff", border:"2px solid #2E75B6", boxShadow:"0 4px 16px rgba(0,0,0,0.25)", cursor:"pointer", fontSize:"22px", display:"flex", alignItems:"center", justifyContent:"center", transition:"transform 0.15s", transform: chatOpen?"scale(0.9)":"scale(1)" }}>
            {chatOpen ? "×" : "🤖"}
          </button>
        </div>
  );
}
