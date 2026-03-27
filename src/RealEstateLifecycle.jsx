// src/RealEstateLifecycle.jsx
import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

// ── Data ──────────────────────────────────────────────────────────────────────

const SELLER_PHASES = [
  { num:1, title:"Pre-Sale Preparation",            color:"#0D1B2A" },
  { num:2, title:"Marketing & Buyer Engagement",    color:"#1558C0" },
  { num:3, title:"Offer, Negotiation & ATS",        color:"#0E7490" },
  { num:4, title:"Legal Due Diligence",             color:"#7C3AED" },
  { num:5, title:"Home Loan & Financial Compliance",color:"#B45309" },
  { num:6, title:"TDS & Capital Gains",             color:"#DC2626" },
  { num:7, title:"Registration Day",                color:"#0D1B2A" },
  { num:8, title:"Post-Registration",               color:"#374151" },
];

const SELLER_ITEMS = [
  { ph:1, day:1,   task:"Obtain Encumbrance Certificate (30 years) from TNREGINET / Kaveri / Landeed", docs:["Encumbrance Certificate (EC) — 30 years"] },
  { ph:1, day:3,   task:"Commission independent property valuation from certified valuer", docs:["Independent Valuation Report","Circle Rate printout"] },
  { ph:1, day:5,   task:"Compile full title chain — Mother Deed + all subsequent sale deeds", docs:["Mother Deed","All Prior Sale Deeds","Title Chain Summary"] },
  { ph:1, day:7,   task:"Obtain Khata Certificate & Khata Extract from BBMP / local body", docs:["Khata Certificate","Khata Extract"] },
  { ph:1, day:7,   task:"Obtain latest Property Tax receipts (minimum 3 years)", docs:["Property Tax Receipts (3 years)"] },
  { ph:1, day:10,  task:"Obtain Occupancy Certificate (OC) from local planning authority", docs:["Occupancy Certificate (OC)"] },
  { ph:1, day:10,  task:"Obtain Sanctioned Building Plan approved by BBMP / CMDA / HMDA", docs:["Sanctioned Building Plan"] },
  { ph:1, day:12,  task:"Obtain Housing Society NOC and clearance of all maintenance dues", docs:["Society NOC","Maintenance Clearance Certificate","Share Certificate"] },
  { ph:1, day:14,  task:"Obtain Bank NOC / Foreclosure Letter if property is mortgaged", docs:["Bank NOC / Foreclosure Letter","CERSAI Satisfaction Report"] },
  { ph:2, day:21,  task:"List property on portals — confirm RERA registration displayed", docs:["RERA Certificate","Portal listing screenshots"] },
  { ph:2, day:30,  task:"Conduct site visits — maintain visitor log with PAN numbers", docs:["Visitor log with PAN","NDA if required"] },
  { ph:3, day:42,  task:"Evaluate and shortlist best offer — compare against valuation report", docs:["Offer comparison sheet","Valuation report"] },
  { ph:3, day:45,  task:"Accept offer in writing — issue Letter of Intent / MOU to buyer", docs:["Letter of Intent (LOI) / MOU","RTGS confirmation of token advance"] },
  { ph:3, day:49,  task:"Sign Agreement to Sell on stamp paper — include possession date, penalty clause, fixtures", docs:["Signed Agreement to Sell (ATS)","Stamp duty on ATS","PAN + Aadhaar (both parties)"] },
  { ph:4, day:55,  task:"Appoint property lawyer — instruct to respond to buyer's legal queries", docs:["Lawyer engagement letter"] },
  { ph:4, day:60,  task:"Provide full document set to buyer's lawyer — EC, title chain, OC, Khata, building plan", docs:["EC","Title Chain","OC","Khata","Building Plan"] },
  { ph:4, day:67,  task:"Respond to legal due diligence queries from buyer's advocate", docs:["Legal query responses","Additional title documents"] },
  { ph:4, day:70,  task:"Confirm buyer's lawyer has issued clear title opinion", docs:["Copy of buyer's Legal Opinion Letter"] },
  { ph:5, day:72,  task:"Provide property documents to buyer's lender for technical valuation", docs:["Building Plan (for valuer access)","OC copy"] },
  { ph:5, day:80,  task:"Facilitate lender's technical valuer site visit — provide building plan and OC", docs:["Valuer access confirmation"] },
  { ph:5, day:98,  task:"Hand over all original title documents to lender for MODT execution", docs:["All Original Title Deeds","Mother Deed","MODT execution acknowledgement"] },
  { ph:5, day:105, task:"Confirm RTGS receipt of loan disbursement from lender", docs:["RTGS confirmation from lender","Loan disbursement letter"] },
  { ph:6, day:108, task:"Confirm buyer is deducting 1% TDS on each payment instalment", docs:["Buyer's TDS deduction confirmation per instalment"] },
  { ph:6, day:112, task:"Confirm buyer has filed Form 26QB within 30 days of each payment", docs:["Form 26QB Acknowledgement Number"] },
  { ph:6, day:115, task:"Receive Form 16B from buyer — verify TDS credit in Form 26AS / AIS", docs:["Form 16B","Form 26AS / AIS Statement"] },
  { ph:6, day:115, task:"CA finalises capital gains computation and exemption strategy", docs:["Capital Gains Worksheet (final)","Sec 54 / 54EC / 54F Workings"] },
  { ph:6, day:118, task:"Open Capital Gains Account Scheme (CGAS) if reinvestment of gains is pending", docs:["CGAS Account Proof","Bank Deposit Challan"] },
  { ph:7, day:120, task:"Confirm buyer's stamp duty e-challan payment has been received", docs:["Stamp Duty e-Challan (buyer's confirmation)"] },
  { ph:7, day:121, task:"Attend Sub-Registrar's office — physical presence and biometric verification mandatory", docs:["PAN Card","Aadhaar Card","Passport-size Photographs","Power of Attorney (if proxy)"] },
  { ph:7, day:121, task:"⚠ Confirm FULL balance consideration received BEFORE signing Sale Deed", docs:["RTGS Confirmation of Full Balance — verify BEFORE signing"] },
  { ph:7, day:121, task:"Sign Sale Deed — hand over all original documents, keys and possession letter", docs:["Signed Sale Deed","Original Title Deeds (all)","Keys","Possession Letter"] },
  { ph:8, day:123, task:"Close existing mortgage — obtain Loan Closure Certificate and Bank NOC", docs:["Loan Closure Certificate","Bank NOC"] },
  { ph:8, day:128, task:"Confirm lender has filed CERSAI Satisfaction Entry post-closure", docs:["CERSAI Satisfaction Entry + Report"] },
  { ph:8, day:130, task:"Formally resign from Housing Society and clear all outstanding dues", docs:["Society Resignation Letter","Maintenance Clearance Certificate"] },
  { ph:8, day:150, task:"File ITR-2 with Capital Gains schedule — claim Sec 54 / 54EC / 54F exemption", docs:["ITR-2 Filed Acknowledgement","Capital Gains Declaration","Exemption Proof"] },
  { ph:8, day:180, task:"Purchase 54EC bonds within 6 months of sale if claiming LTCG exemption", docs:["54EC Bond Purchase Receipt (NHAI / REC bonds)"] },
];

const BUYER_PHASES = [
  { num:1, title:"Pre-Purchase Financial Planning",    color:"#1558C0" },
  { num:2, title:"Property Search & Shortlisting",     color:"#0E7490" },
  { num:3, title:"Token Advance & Agreement to Sell",  color:"#7C3AED" },
  { num:4, title:"Legal Due Diligence",                color:"#B45309" },
  { num:5, title:"Home Loan Processing",               color:"#1E6B35" },
  { num:6, title:"TDS Compliance",                     color:"#DC2626" },
  { num:7, title:"Registration Day",                   color:"#0D1B2A" },
  { num:8, title:"Post-Registration",                  color:"#374151" },
];

const BUYER_ITEMS = [
  { ph:1, day:14, task:"Calculate total acquisition cost — price + stamp duty 5–8% + registration 1% + GST (if new) + brokerage", docs:["Budget Worksheet","Circle Rate printout","Stamp Duty Calculator"] },
  { ph:1, day:14, task:"Check CIBIL score (750+ preferred) — resolve any defaults or errors before applying", docs:["CIBIL Report","PAN Card"] },
  { ph:1, day:17, task:"Apply 40% EMI rule — calculate maximum loan eligibility based on net monthly income", docs:["Salary Slips (3 months)","Bank Statement (6 months)","Existing EMI schedule"] },
  { ph:1, day:19, task:"Collate all income documents for loan pre-approval", docs:["Salary Slips (3 months)","Form 16 (2 years)","ITR (2 years)","Bank Statements (6 months)","Aadhaar + PAN"] },
  { ph:1, day:24, task:"Apply to 2–3 lenders for pre-approval letter (valid 90–120 days)", docs:["Loan Application Form","KYC documents","Income documents","Existing loan statements"] },
  { ph:2, day:31, task:"Search portals — shortlist 5–8 properties, note RERA registration numbers", docs:["Shortlist with RERA numbers","Price comparison sheet"] },
  { ph:2, day:31, task:"Verify RERA registration on state portal for each shortlisted property", docs:["RERA Certificate for each property"] },
  { ph:2, day:31, task:"Check property not in flood zone, litigation zone or government acquisition notification", docs:["EC initial check","RERA Certificate","Local body records"] },
  { ph:2, day:35, task:"Receive pre-approval letter from lender — confirm loan amount and conditions", docs:["Pre-Approval Letter (valid 90–120 days)"] },
  { ph:2, day:35, task:"Conduct site visits — verify carpet area, construction quality, parking, common areas", docs:["Site visit notes","Floor plan","Amenities list"] },
  { ph:2, day:35, task:"Compare asking price against registered transaction data for the micro-market", docs:["Registered transaction comparables (IGRS / Kaveri)","Valuation report"] },
  { ph:2, day:42, task:"Negotiate price, possession date and fixture inclusions — agree heads of terms", docs:["MOU / Heads of Terms (signed by both parties)"] },
  { ph:3, day:43, task:"Engage property lawyer for preliminary title check and ATS review", docs:["EC (initial)","RERA Certificate","ATS draft"] },
  { ph:3, day:45, task:"Pay token advance 1–2% via RTGS/cheque — obtain signed receipt with refund / forfeiture terms", docs:["Token Advance Receipt","RTGS confirmation","Bank statement"] },
  { ph:3, day:49, task:"Sign Agreement to Sell on stamp paper — confirm possession date, penalty clause, fixtures", docs:["Signed ATS","Stamp duty on ATS","PAN + Aadhaar (both parties)"] },
  { ph:3, day:53, task:"Submit ATS + full document set to lender — initiate formal home loan application", docs:["ATS Copy","KYC documents","Income documents","Ownership documents from seller"] },
  { ph:4, day:60, task:"Obtain Encumbrance Certificate (30 years) — TNREGINET / Kaveri / Landeed", docs:["EC (30 yr)"] },
  { ph:4, day:63, task:"Lawyer conducts 30-year title search — confirms unbroken ownership chain", docs:["Mother Deed","Chain of Title (30 yr)","Previous sale deeds"] },
  { ph:4, day:63, task:"Verify Khata / Patta status — A-Khata mandatory in Karnataka", docs:["Khata Certificate","Khata Extract"] },
  { ph:4, day:63, task:"Verify Occupancy Certificate — mandatory for ready-to-move properties", docs:["Occupancy Certificate (OC)"] },
  { ph:4, day:63, task:"Match physical construction against Sanctioned Building Plan — identify deviations", docs:["Sanctioned Building Plan (BBMP / CMDA / HMDA)","Physical inspection notes"] },
  { ph:4, day:67, task:"Collect Society NOC from seller — no pending maintenance dues", docs:["Society NOC","Share Certificate","Maintenance Clearance Certificate"] },
  { ph:4, day:67, task:"Collect NOC from seller's bank if property is mortgaged", docs:["Bank NOC / Foreclosure Letter","CERSAI Satisfaction Report"] },
  { ph:4, day:70, task:"Buyer's lawyer issues Legal Opinion letter — clear and marketable title confirmed", docs:["Legal Opinion Letter — buyer's advocate"] },
  { ph:5, day:72, task:"Submit complete income + property document set to lender for formal credit appraisal", docs:["Loan Application","KYC","Income documents","ATS","Legal opinion","EC (30 yr)"] },
  { ph:5, day:80, task:"Arrange access for lender's technical valuer — provide building plan and OC", docs:["Access confirmation","Sanctioned Building Plan","OC for valuer"] },
  { ph:5, day:91, task:"Receive and review Sanction Letter — check loan amount, rate, tenure, conditions", docs:["Sanction Letter","Rate and tenure review"] },
  { ph:5, day:93, task:"Accept Sanction Letter — sign and return to lender within stipulated period", docs:["Signed Sanction Letter Acceptance"] },
  { ph:5, day:98, task:"Execute Loan Agreement + NACH / ECS mandate for EMI auto-debit", docs:["Signed Loan Agreement","NACH Mandate","ECS form","Post-dated cheques if required"] },
  { ph:6, day:108, task:"Deduct 1% TDS from each payment tranche (mandatory for properties above ₹50 lakh)", docs:["TDS Deduction records per payment","Seller's PAN"] },
  { ph:6, day:112, task:"File Form 26QB via TRACES / TIN-NSDL within 30 days of each payment", docs:["Form 26QB filed","TDS Challan","Acknowledgement number"] },
  { ph:6, day:115, task:"Issue Form 16B (TDS certificate) to seller within 15 days of Form 26QB filing", docs:["Form 16B — downloaded from TRACES"] },
  { ph:6, day:118, task:"⚠ Confirm Form 26QB Acknowledgement is ready — Sub-Registrar will check this on Registration Day", docs:["Form 26QB Acknowledgement (MANDATORY for registration)"] },
  { ph:7, day:120, task:"Pay stamp duty (5–7%) + registration fee (1%) via e-challan before Registration Day", docs:["Stamp Duty e-Challan","Registration Fee receipt"] },
  { ph:7, day:121, task:"Attend Sub-Registrar's office — physical presence and biometric verification mandatory", docs:["PAN Card","Aadhaar Card","Passport photos","POA if proxy"] },
  { ph:7, day:121, task:"Sign Sale Deed in presence of registering officer — confirm all details match ATS", docs:["Sale Deed on stamp paper","Form 26QB Acknowledgement","All identity documents"] },
  { ph:7, day:121, task:"Confirm balance consideration paid to seller BEFORE signing Sale Deed", docs:["RTGS / Cheque confirmation — verify BEFORE signing"] },
  { ph:7, day:122, task:"Receive registered Sale Deed — submit original to lender if property is financed", docs:["Registered Sale Deed (original)","Lender submission acknowledgement"] },
  { ph:8, day:123, task:"Submit original registered Sale Deed to lender for custody (equitable mortgage)", docs:["Registered Sale Deed","Submission acknowledgement from lender"] },
  { ph:8, day:128, task:"Apply for Khata / Mutation transfer to buyer's name", docs:["Khata Transfer Application","Sale Deed copy","Tax receipts"] },
  { ph:8, day:130, task:"Apply to Housing Society for membership — obtain new Share Certificate in buyer's name", docs:["Society membership application","Sale Deed copy","Share Certificate (buyer's name)"] },
  { ph:8, day:135, task:"Transfer electricity, water and gas connections to buyer's name", docs:["Sale Deed copy","Applications to utility providers","NOC from seller"] },
  { ph:8, day:150, task:"Claim Section 24(b) home loan interest deduction (₹2L) + Section 80C principal (₹1.5L) in ITR", docs:["Annual Interest Certificate from lender","ITR with housing loan details"] },
];

const LENDER_PHASES = [
  { num:1, title:"Pre-Engagement Setup & Policy",           color:"#0D1B2A" },
  { num:2, title:"Awaiting Application",                    color:"#718096" },
  { num:3, title:"Credit Appraisal & Due Diligence",        color:"#7C3AED" },
  { num:4, title:"Sanction, Documentation & Disbursement",  color:"#1558C0" },
  { num:5, title:"Post-Disbursement Compliance",            color:"#1E6B35" },
];

const LENDER_ITEMS = [
  { ph:1, day:1,   task:"Policy & product setup — establish interest rate schedule, LTV grid, FOIR limits, minimum CIBIL threshold", docs:["Interest Rate Schedule","Credit Policy Document","LTV Grid"] },
  { ph:1, day:1,   task:"Empanel certified technical valuers and legal advocates for the transaction geographies", docs:["Panel of Valuers (RICS / IBBI registered)","Panel of Lawyers (empanelled advocates)"] },
  { ph:1, day:3,   task:"Maintain and publish Ready Reckoner / Circle Rate schedule — used for LTV cap calculation", docs:["Circle Rate Schedule by micro-market"] },
  { ph:1, day:24,  task:"Issue in-principle pre-approval letter based on buyer's income and CIBIL submitted", docs:["Pre-Approval Letter (valid 90–120 days)","CIBIL report pulled","FOIR calculation"] },
  { ph:2, day:31,  task:"— Awaiting formal loan application with ATS from buyer —", docs:[] },
  { ph:3, day:53,  task:"Receive formal loan application — acknowledge and begin credit appraisal", docs:["Loan Application Form","ATS Copy","KYC + Income Documents","EC initial"] },
  { ph:3, day:60,  task:"CIBIL verification (750+ preferred) + FOIR check (EMIs ≤ 40–50% of net income)", docs:["CIBIL Report","FOIR Calculation Worksheet","LTV Assessment"] },
  { ph:3, day:63,  task:"Technical Valuer visits property — verifies carpet area, construction quality, deviations from plan, FMV", docs:["Technical Valuation Report","Carpet Area Certificate","Deviation report if any"] },
  { ph:3, day:63,  task:"Empanelled lawyer independently reviews 30-year title chain and issues legal opinion", docs:["Legal Opinion Letter (lender's empanelled advocate)","EC (30 yr) review"] },
  { ph:4, day:72,  task:"Complete formal credit appraisal — CIBIL, FOIR, LTV, employment verification", docs:["Credit Appraisal Memo","CIBIL Report (final)","FOIR Calculation","LTV Grid"] },
  { ph:4, day:80,  task:"Technical Valuation complete — confirm Fair Market Value and LTV compliance", docs:["Final Technical Valuation Report","FMV vs Circle Rate comparison"] },
  { ph:4, day:84,  task:"Legal Opinion received from empanelled lawyer — clear and marketable title confirmed", docs:["Legal Opinion Letter","Title Chain confirmation"] },
  { ph:4, day:91,  task:"Issue conditional Sanction Letter — loan amount, interest rate, tenure, pre-conditions", docs:["Sanction Letter","Pre-disbursement conditions checklist"] },
  { ph:4, day:98,  task:"Collect ALL original title documents from seller — execute MODT (equitable mortgage)", docs:["MODT (Memorandum of Deposit of Title Deeds)","All Original Title Deeds","Mother Deed"] },
  { ph:4, day:100, task:"MODT stamped at Sub-Registrar if required by state law (Karnataka, Tamil Nadu)", docs:["MODT Stamp Receipt","Sub-Registrar acknowledgement"] },
  { ph:4, day:105, task:"Confirm Form 26QB TDS filing by buyer before releasing disbursement", docs:["Form 26QB Copy — compliance check","TDS Challan"] },
  { ph:4, day:105, task:"Release loan funds directly to seller via RTGS — confirm receipt", docs:["Disbursement Letter","RTGS Confirmation to Seller","Disbursement Schedule"] },
  { ph:5, day:120, task:"File CERSAI charge (security interest registration) within 30 days of disbursement", docs:["CERSAI Charge Number","CERSAI filing receipt"] },
  { ph:5, day:120, task:"Coordinate final disbursement tranche on or before Registration Day", docs:["Disbursement on stamp duty payment confirmation","Registration Day RTGS"] },
  { ph:5, day:122, task:"Collect registered Sale Deed from buyer — add to security folder with MODT and title documents", docs:["Registered Sale Deed (custody)","Security Folder acknowledgement"] },
  { ph:5, day:123, task:"Safely retain all original title documents and MODT in secure custody", docs:["Document Custody Confirmation","MODT","All Original Title Deeds"] },
  { ph:5, day:135, task:"Provide annual interest certificate for buyer's Section 24(b) deduction", docs:["Annual Interest Certificate (issued each April)"] },
];

const PERSONAS = {
  seller: { label:"Seller",  icon:"🏠", phases: SELLER_PHASES, items: SELLER_ITEMS, desc:"You're selling a property" },
  buyer:  { label:"Buyer",   icon:"🔑", phases: BUYER_PHASES,  items: BUYER_ITEMS,  desc:"You're purchasing a property" },
  lender: { label:"Lender",  icon:"🏦", phases: LENDER_PHASES, items: LENDER_ITEMS, desc:"You're financing the transaction" },
};

// Status colours
const STATUS = {
  none:      { bg:"#FEF2F2", border:"#EF4444", dot:"#EF4444", label:"No link" },
  review:    { bg:"#FFFBEB", border:"#F59E0B", dot:"#F59E0B", label:"Under review" },
  validated: { bg:"#F0FDF4", border:"#22C55E", dot:"#22C55E", label:"Validated" },
  failed:    { bg:"#FEF2F2", border:"#EF4444", dot:"#EF4444", label:"Failed" },
};

const C = {
  navy:"#0D1B2A", blue:"#1558C0", blueLt:"#3B76D4",
  pale:"#EEF4FF", pale2:"#D9E8FF", border:"#E2E8F0",
  slate:"#475569", mist:"#F8FAFC", white:"#FFFFFF",
  text:"#1E293B", hint:"#94A3B8",
};

// ── Firestore helpers ─────────────────────────────────────────────────────────

function txDocRef(uid, txId, persona) {
  return doc(db, "users", uid, "re_transactions", `${txId}_${persona}`);
}

async function loadTxState(uid, txId, persona) {
  const snap = await getDoc(txDocRef(uid, txId, persona));
  return snap.exists() ? (snap.data().items || {}) : {};
}

async function saveTxState(uid, txId, persona, items) {
  await setDoc(txDocRef(uid, txId, persona), { txId, persona, items }, { merge:true });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusDot({ status }) {
  const s = STATUS[status] || STATUS.none;
  return (
    <span style={{
      display:"inline-block", width:10, height:10,
      borderRadius:"50%", background:s.dot,
      border:`2px solid ${s.border}`, flexShrink:0,
    }} />
  );
}

function CheckItem({ item, idx, itemState, onUpdate, onOpenComments }) {
  const { status="none", link="", reviewerComments="" } = itemState || {};
  const isWarning = item.task.startsWith("⚠");
  const [linkVal, setLinkVal] = useState(link);
  const [showReviewActions, setShowReviewActions] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [showCommentInput, setShowCommentInput] = useState(false);

  // When link changes, auto-set status to review
  const handleLinkChange = (val) => {
    setLinkVal(val);
    const newStatus = val.trim() ? "review" : "none";
    onUpdate(idx, { status: newStatus, link: val, reviewerComments });
  };

  const handleValidate = () => {
    onUpdate(idx, { status:"validated", link: linkVal, reviewerComments });
    setShowReviewActions(false);
  };

  const handleFail = () => {
    onUpdate(idx, { status:"failed", link: linkVal, reviewerComments: commentDraft || reviewerComments });
    setShowCommentInput(false);
    setShowReviewActions(false);
  };

  const s = STATUS[status] || STATUS.none;

  return (
    <div style={{
      padding:"12px 18px", borderBottom:`1px solid ${C.border}`,
      background: status === "validated" ? "#FAFFFE" : status === "failed" ? "#FFFAFA" : C.white,
      transition:"background 0.2s",
    }}>
      <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>

        {/* Status checkbox */}
        <div style={{
          width:20, height:20, borderRadius:4, flexShrink:0, marginTop:2,
          border:`2px solid ${s.border}`, background:s.bg,
          display:"flex", alignItems:"center", justifyContent:"center",
          cursor:"pointer",
        }}
          onClick={() => setShowReviewActions(v => !v)}
          title={s.label}
        >
          {status === "validated" && <span style={{ fontSize:11, color:"#22C55E", fontWeight:700 }}>✓</span>}
          {status === "failed"    && <span style={{ fontSize:11, color:"#EF4444", fontWeight:700 }}>✕</span>}
          {status === "review"    && <span style={{ fontSize:10, color:"#F59E0B", fontWeight:700 }}>…</span>}
        </div>

        {/* Main content */}
        <div style={{ flex:1, minWidth:0 }}>

          {/* Day badge + task */}
          <div style={{ display:"flex", gap:8, alignItems:"baseline", flexWrap:"wrap", marginBottom:6 }}>
            <span style={{
              fontSize:10, fontWeight:600, color:C.slate,
              background:C.pale, border:`1px solid ${C.pale2}`,
              borderRadius:20, padding:"1px 8px", flexShrink:0,
              fontFamily:"'DM Mono', monospace",
            }}>Day {item.day}</span>
            <span className="re-item-task" style={{ fontWeight: isWarning ? 600 : 400, color: isWarning ? "#DC2626" : "#1E293B" }}>{item.task}</span>
          </div>

          {/* Documents */}
          {item.docs.length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
              {item.docs.map((d,i) => (
                <span key={i} className="re-item-doc" style={{
                  color:C.slate, background:C.mist,
                  border:`1px solid ${C.border}`, borderRadius:4,
                  padding:"2px 7px",
                }}>📄 {d}</span>
              ))}
            </div>
          )}

          {/* Link row */}
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <input
              type="url"
              value={linkVal}
              onChange={e => handleLinkChange(e.target.value)}
              placeholder="Paste document link…"
              style={{
                flex:1, minWidth:180, padding:"5px 9px",
                border:`1px solid ${linkVal ? C.blueLt : C.border}`,
                borderRadius:5, fontSize:12, color:C.text,
                background: linkVal ? C.pale : C.mist, outline:"none",
                fontFamily:"inherit",
              }}
            />
            {linkVal && (
              <a href={linkVal} target="_blank" rel="noopener noreferrer"
                style={{
                  fontSize:11, fontWeight:600, color:C.blue,
                  background:C.pale, border:`1px solid ${C.pale2}`,
                  borderRadius:5, padding:"5px 10px", textDecoration:"none",
                  whiteSpace:"nowrap", flexShrink:0,
                }}>Open ↗</a>
            )}
            {/* Status badge */}
            <span style={{
              fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:20, flexShrink:0,
              color: s.dot, background: s.bg, border:`1px solid ${s.border}`,
            }}>{s.label}</span>

            {/* Reviewer comments link if failed */}
            {status === "failed" && reviewerComments && (
              <button onClick={() => onOpenComments(reviewerComments)}
                style={{
                  fontSize:11, color:"#DC2626", background:"#FEF2F2",
                  border:"1px solid #FCA5A5", borderRadius:5,
                  padding:"4px 10px", cursor:"pointer", fontFamily:"inherit",
                  fontWeight:500, whiteSpace:"nowrap", flexShrink:0,
                }}>
                💬 Reviewer comments
              </button>
            )}
          </div>

          {/* Reviewer actions (shown on click of checkbox) */}
          {showReviewActions && (
            <div style={{
              marginTop:10, padding:"10px 12px", background:C.pale,
              border:`1px solid ${C.pale2}`, borderRadius:6,
            }}>
              <div style={{ fontSize:11, fontWeight:600, color:C.slate, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.04em" }}>Reviewer Actions</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <button onClick={handleValidate}
                  style={{ fontSize:12, fontWeight:600, color:"#fff", background:"#22C55E", border:"none", borderRadius:5, padding:"6px 14px", cursor:"pointer" }}>
                  ✓ Validate
                </button>
                <button onClick={() => setShowCommentInput(v => !v)}
                  style={{ fontSize:12, fontWeight:600, color:"#fff", background:"#EF4444", border:"none", borderRadius:5, padding:"6px 14px", cursor:"pointer" }}>
                  ✕ Fail
                </button>
                <button onClick={() => setShowReviewActions(false)}
                  style={{ fontSize:12, color:C.slate, background:"transparent", border:`1px solid ${C.border}`, borderRadius:5, padding:"6px 14px", cursor:"pointer" }}>
                  Cancel
                </button>
              </div>
              {showCommentInput && (
                <div style={{ marginTop:8 }}>
                  <textarea
                    value={commentDraft}
                    onChange={e => setCommentDraft(e.target.value)}
                    placeholder="Enter reviewer comments…"
                    rows={2}
                    style={{
                      width:"100%", padding:"7px 10px", fontSize:12,
                      border:"1px solid #FCA5A5", borderRadius:5,
                      fontFamily:"inherit", resize:"vertical", outline:"none",
                      background:"#FFFAFA", boxSizing:"border-box",
                    }}
                  />
                  <button onClick={handleFail}
                    style={{ marginTop:6, fontSize:12, fontWeight:600, color:"#fff", background:"#EF4444", border:"none", borderRadius:5, padding:"6px 16px", cursor:"pointer" }}>
                    Confirm Fail
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PhaseSection({ phase, items, itemStates, onUpdate, onOpenComments }) {
  const [collapsed, setCollapsed] = useState(false);

  const total = items.length;
  const validated = items.filter((_,i) => (itemStates[`item_${i}`]?.status) === "validated").length;
  const pct = total ? Math.round(validated / total * 100) : 0;

  return (
    <div style={{
      borderRadius:10, overflow:"hidden", marginBottom:14,
      border:`1px solid ${C.border}`,
      boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
    }}>
      {/* Phase header */}
      <div
        onClick={() => setCollapsed(v => !v)}
        style={{
          background: phase.color, padding:"14px 20px",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          cursor:"pointer", userSelect:"none",
        }}
      >
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{
            width:30, height:30, borderRadius:"50%",
            background:"rgba(255,255,255,0.2)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:13, fontWeight:700, color:"#fff", flexShrink:0,
          }}>{phase.num}</div>
          <span className="re-phase-title">{phase.title}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:12, color:"rgba(255,255,255,0.75)", fontWeight:500 }}>{validated}/{total}</span>
          <div style={{ width:60, height:4, background:"rgba(255,255,255,0.25)", borderRadius:2 }}>
            <div style={{ width:`${pct}%`, height:"100%", background:"rgba(255,255,255,0.85)", borderRadius:2, transition:"width 0.4s" }} />
          </div>
          <span style={{ color:"rgba(255,255,255,0.8)", fontSize:14, transform: collapsed ? "rotate(-90deg)" : "none", transition:"transform 0.2s" }}>▾</span>
        </div>
      </div>

      {/* Items */}
      {!collapsed && (
        <div style={{ background:"#fff" }}>
          {items.map((item, localIdx) => {
            const globalKey = `item_${item._globalIdx}`;
            return (
              <CheckItem
                key={globalKey}
                item={item}
                idx={item._globalIdx}
                itemState={itemStates[globalKey]}
                onUpdate={(idx, newState) => onUpdate(idx, newState)}
                onOpenComments={onOpenComments}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── ContactCard ───────────────────────────────────────────────────────────────

function ContactCard({ label, data, setData, onSave, readOnly = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data);

  const handleSave = () => {
    setData(draft);
    onSave(draft);
    setEditing(false);
  };

  return (
    <div style={{
      background:"#fff", borderRadius:10, border:`1px solid ${C.border}`,
      padding:"clamp(10px,1.2vw,14px) clamp(12px,1.5vw,18px)",
      flex:"1 1 260px", minWidth:0,
      boxShadow:"0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div style={{ fontSize:"clamp(10px,1vw,12px)", fontWeight:700, color:C.blue, textTransform:"uppercase", letterSpacing:"0.07em" }}>{label}</div>
        {readOnly
          ? <span style={{ fontSize:"clamp(9px,0.9vw,11px)", color:C.hint, display:"flex", alignItems:"center", gap:4 }}>🔒 Read only</span>
          : <button
              onClick={() => { setDraft(data); setEditing(v => !v); }}
              style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.hint, borderRadius:5, padding:"3px 10px", cursor:"pointer", fontSize:"clamp(10px,1vw,12px)", fontFamily:"inherit" }}>
              {editing ? "Cancel" : "✎ Edit"}
            </button>
        }
      </div>

      {editing ? (
        <div>
          {[["name","Full Name","text"],["phone","Phone","tel"],["whatsapp","WhatsApp","tel"]].map(([field, lbl, type]) => (
            <div key={field} style={{ marginBottom:8 }}>
              <label style={{ display:"block", fontSize:"clamp(9px,0.9vw,11px)", fontWeight:600, color:C.hint, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:3 }}>{lbl}</label>
              <input
                type={type}
                value={draft[field]}
                onChange={e => setDraft(prev => ({ ...prev, [field]: e.target.value }))}
                style={{
                  width:"100%", padding:"7px 9px", fontSize:"clamp(12px,1.1vw,14px)",
                  border:`1.5px solid ${C.blue}`, borderRadius:6, outline:"none",
                  fontFamily:"inherit", color:C.navy, background:C.pale, boxSizing:"border-box",
                }}
              />
            </div>
          ))}
          <button onClick={handleSave}
            style={{ marginTop:4, width:"100%", padding:"8px", fontSize:"clamp(12px,1.1vw,13px)", fontWeight:700, color:"#fff", background:C.blue, border:"none", borderRadius:7, cursor:"pointer", fontFamily:"inherit" }}>
            Save
          </button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize:"clamp(13px,1.3vw,15px)", fontWeight:600, color:C.navy, marginBottom:6 }}>{data.name || <span style={{ color:C.hint, fontStyle:"italic" }}>No name</span>}</div>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
            {data.phone ? (
              <a href={`tel:${data.phone}`}
                style={{ fontSize:"clamp(11px,1.1vw,13px)", color:C.slate, textDecoration:"none", display:"flex", alignItems:"center", gap:5 }}>
                📞 {data.phone}
              </a>
            ) : <span style={{ fontSize:"clamp(11px,1.1vw,13px)", color:C.hint, fontStyle:"italic" }}>No phone</span>}
            {data.whatsapp && (
              <a href={`https://wa.me/${data.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize:"clamp(11px,1.1vw,13px)", color:"#25D366", textDecoration:"none", display:"flex", alignItems:"center", gap:5 }}>
                💬 {data.whatsapp}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

// SHA-256 password hash via Web Crypto
async function hashPassword(password) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(password));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

export default function RealEstateLifecycle({ userId }) {
  const [step, setStep]     = useState("persona"); // persona | re_login | re_register | checklist
  const [persona, setPersona] = useState(null);
  const [txId, setTxId]     = useState("");
  const [itemStates, setItemStates] = useState({});
  const [loading, setLoading] = useState(false);
  const [commentsModal, setCommentsModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);
  const [txStatus, setTxStatus] = useState("active");

  const [myContact, setMyContact] = useState({ name:"", phone:"", whatsapp:"" });
  const [rmContact, setRmContact] = useState({ name:"Priya Krishnamurthy", phone:"+91 98400 00002", whatsapp:"+91 98400 00002" });
  const [buyerTxIds, setBuyerTxIds] = useState([]);

  // TX ID header controls
  const [addingTxId, setAddingTxId]     = useState(false);
  const [txAddInput, setTxAddInput]     = useState("");
  const [txAddLoading, setTxAddLoading] = useState(false);
  const [propertyPopup, setPropertyPopup] = useState(null); // { txId, address, status }
  const txAddRef = useRef(null);

  // ── Login state ──
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // ── Registration state ──
  const EMPTY_REG = { name:"", phone:"", whatsapp:"", address:"", propertyAddress:"", txIdInterest:"", username:"", password:"", password2:"" };
  const [reg, setReg]         = useState(EMPTY_REG);
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(null); // { txId?, persona }
  const [showPass, setShowPass] = useState(false);

  const credRef  = (p) => doc(db, "users", userId, "re_credentials", p || persona);
  const profRef  = (p) => doc(db, "users", userId, "re_profile",     p || persona);

  const generateTxId = () => {
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).substring(2,6).toUpperCase();
    return `TXN-${year}-CHN-${rand}`;
  };

  // ── Login handler ──
  const handleLogin = async () => {
    if (!loginUser.trim() || !loginPass.trim()) { setLoginError("Username and password are required."); return; }
    setLoginLoading(true); setLoginError("");
    try {
      const snap = await getDoc(credRef());
      if (!snap.exists()) { setLoginError("No account found. Please register first."); setLoginLoading(false); return; }
      const stored = snap.data();
      if (stored.username.toLowerCase() !== loginUser.trim().toLowerCase()) {
        setLoginError("Username or password incorrect."); setLoginLoading(false); return;
      }
      const hash = await hashPassword(loginPass);
      if (hash !== stored.passwordHash) { setLoginError("Username or password incorrect."); setLoginLoading(false); return; }
      // Load profile
      const profSnap = await getDoc(profRef());
      const profData = profSnap.exists() ? profSnap.data() : {};
      if (profData.myContact) setMyContact(profData.myContact);
      if (profData.rmContact) setRmContact(profData.rmContact);
      const ids = profData.txIds || (profData.txId ? [profData.txId] : []);
      setBuyerTxIds(ids);
      // Load first TX ID's checklist
      const firstId = ids[0] || "";
      if (firstId) {
        setTxId(firstId);
        const txSnap = await getDoc(txDocRef(userId, firstId, persona));
        const txData = txSnap.exists() ? txSnap.data() : {};
        setItemStates(txData.items || {});
        setTxStatus(txData.status || "active");
      } else {
        setTxId(""); setItemStates({}); setTxStatus("active");
      }
      setLoginLoading(false);
      setStep("checklist");
    } catch(e) {
      console.error("Login error:", e);
      setLoginError("Login failed: " + (e?.message || "unknown error"));
      setLoginLoading(false);
    }
  };

  // ── Register handler ──
  const handleRegister = async () => {
    const isBuyer = persona === "buyer";
    if (!reg.name.trim() || !reg.phone.trim()) { setRegError("Name and phone are required."); return; }
    if (!reg.username.trim()) { setRegError("Please choose a username."); return; }
    if (reg.password.length < 6) { setRegError("Password must be at least 6 characters."); return; }
    if (reg.password !== reg.password2) { setRegError("Passwords do not match."); return; }
    if (!isBuyer && !reg.propertyAddress.trim()) { setRegError("Property address is required for sellers."); return; }
    setRegLoading(true); setRegError("");
    try {
      // Check username not already taken
      const existingCred = await getDoc(credRef());
      if (existingCred.exists() && existingCred.data().username.toLowerCase() === reg.username.trim().toLowerCase()) {
        setRegError("That username is already taken. Please choose another."); setRegLoading(false); return;
      }
      const hash = await hashPassword(reg.password);
      const contact = { name: reg.name, phone: reg.phone, whatsapp: reg.whatsapp };
      const newTxId = !isBuyer ? generateTxId() : (reg.txIdInterest.trim().toUpperCase() || "");
      const txIds = newTxId ? [newTxId] : [];

      // Save credentials
      await setDoc(credRef(), { username: reg.username.trim(), passwordHash: hash, createdAt: new Date().toISOString() });

      // Save profile
      const profileData = {
        persona, myContact: contact,
        rmContact: { name:"Priya Krishnamurthy", phone:"+91 98400 00002", whatsapp:"+91 98400 00002" },
        txIds, createdAt: new Date().toISOString(),
        ...(isBuyer ? { buyerProfile: { address: reg.address } } : { sellerProfile: { address: reg.address, propertyAddress: reg.propertyAddress } }),
      };
      await setDoc(profRef(), profileData);

      // If TX ID exists, also save a transaction doc
      if (newTxId) {
        await setDoc(txDocRef(userId, newTxId, persona), {
          txId: newTxId, persona, status: "active", items: {},
          myContact: contact,
          rmContact: profileData.rmContact,
          createdAt: new Date().toISOString(),
          ...(isBuyer ? {} : { sellerProfile: { propertyAddress: reg.propertyAddress } }),
        });
      }

      setMyContact(contact);
      setBuyerTxIds(txIds);
      if (newTxId) setTxId(newTxId);
      setRegSuccess({ txId: newTxId, persona });
    } catch(e) {
      console.error("Register error:", e);
      setRegError("Registration failed: " + (e?.message || "unknown error"));
    }
    setRegLoading(false);
  };

  const handleUpdate = (idx, newState) => {
    const key = `item_${idx}`;
    const updated = { ...itemStates, [key]: newState };
    setItemStates(updated);
    clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      await setDoc(txDocRef(userId, txId, persona), { items: updated, myContact, rmContact }, { merge:true });
      setSaving(false);
    }, 800);
  };

  const saveContacts = (mc, rc) => {
    clearTimeout(saveTimer.current); setSaving(true);
    saveTimer.current = setTimeout(async () => {
      await setDoc(txDocRef(userId, txId, persona), { myContact: mc, rmContact: rc }, { merge:true });
      setSaving(false);
    }, 800);
  };

  // Add a new TX ID from the header bar — fetches address and shows popup
  const handleAddTxId = async () => {
    const id = txAddInput.trim().toUpperCase();
    if (!id) return;
    setTxAddLoading(true);
    try {
      // Try to load existing tx doc for this persona
      const snap = await getDoc(txDocRef(userId, id, persona));
      const data = snap.exists() ? snap.data() : {};
      const address = data.sellerProfile?.propertyAddress
        || data.buyerProfile?.propertyAddress
        || "Address not on record yet — your broker will update this.";
      const status = data.status || "active";
      // Save to buyer profile list
      if (persona === "buyer") {
        const profSnap = await getDoc(profRef());
        const existing = profSnap.exists() ? (profSnap.data().txIds || []) : [];
        const merged = existing.includes(id) ? existing : [...existing, id];
        await setDoc(profRef(), { txIds: merged }, { merge:true });
        setBuyerTxIds(merged);
        // Save a stub tx doc if none exists
        if (!snap.exists()) {
          await setDoc(txDocRef(userId, id, persona), { txId: id, persona, status:"active", items:{}, myContact, rmContact, createdAt: new Date().toISOString() });
        }
      }
      setPropertyPopup({ txId: id, address, status });
      setAddingTxId(false);
      setTxAddInput("");
    } catch(e) {
      console.error("Add TX ID error:", e);
    }
    setTxAddLoading(false);
  };

  const p = persona ? PERSONAS[persona] : null;
  const annotatedItems = p ? p.items.map((item, idx) => ({ ...item, _globalIdx: idx })) : [];
  const byPhase = {};
  annotatedItems.forEach(item => {
    if (!byPhase[item.ph]) byPhase[item.ph] = [];
    byPhase[item.ph].push(item);
  });
  const total     = annotatedItems.length;
  const validated = Object.values(itemStates).filter(v => v?.status === "validated").length;
  const inReview  = Object.values(itemStates).filter(v => v?.status === "review").length;
  const failed    = Object.values(itemStates).filter(v => v?.status === "failed").length;
  const pct       = total ? Math.round(validated / total * 100) : 0;

  // ── Welcome / persona selection ─────────────────────────────
  if (step === "persona") {
    return (
      <div style={{ minHeight:"100%", background:C.mist, overflowY:"auto" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&display=swap');
          .re-welcome-wrap { padding: clamp(32px,6vw,80px) clamp(24px,8vw,120px); max-width: 960px; margin: 0 auto; }
          .re-welcome-title { font-size: clamp(26px,4vw,42px); font-weight:700; color:#0D1B2A; line-height:1.2; margin-bottom:12px; }
          .re-welcome-sub   { font-size: clamp(14px,1.5vw,17px); color:#475569; line-height:1.7; max-width:600px; }
          .re-persona-grid  { display:grid; grid-template-columns: repeat(3,1fr); gap: clamp(12px,2vw,28px); margin: clamp(28px,4vw,48px) 0; }
          @media (max-width:640px) { .re-persona-grid { grid-template-columns: 1fr; } }
          .re-persona-card  {
            padding: clamp(28px,4vw,52px) clamp(20px,3vw,36px);
            border-radius:16px; border:2px solid #E2E8F0;
            background:#fff; cursor:pointer; text-align:center;
            transition:all 0.2s; font-family:'DM Sans',sans-serif;
            box-shadow:0 2px 8px rgba(0,0,0,0.05);
          }
          .re-persona-card:hover { border-color:#1558C0; box-shadow:0 6px 24px rgba(21,88,192,0.14); transform:translateY(-2px); }
          .re-persona-icon  { font-size: clamp(40px,6vw,64px); margin-bottom: clamp(12px,2vw,20px); }
          .re-persona-label { font-size: clamp(18px,2.2vw,26px); font-weight:700; color:#0D1B2A; margin-bottom:6px; }
          .re-persona-desc  { font-size: clamp(12px,1.3vw,15px); color:#64748B; line-height:1.5; }
          .re-tip { padding: clamp(14px,2vw,20px) clamp(16px,2vw,24px); background:#EEF4FF; border-radius:10px; border:1px solid #D9E8FF; font-size:clamp(12px,1.3vw,15px); color:#475569; line-height:1.6; }

          .re-txid-wrap { padding: clamp(32px,6vw,72px) clamp(24px,8vw,120px); max-width:600px; margin:0 auto; }
          .re-txid-title { font-size:clamp(20px,3vw,30px); font-weight:700; color:#0D1B2A; }
          .re-txid-sub   { font-size:clamp(13px,1.4vw,16px); color:#475569; line-height:1.7; margin-bottom:28px; }
          .re-txid-input { width:100%; padding:clamp(12px,1.5vw,16px) 16px; font-size:clamp(15px,1.8vw,20px); border-radius:10px; outline:none; box-sizing:border-box; font-family:'DM Mono',monospace; letter-spacing:0.05em; transition:border-color 0.2s, background 0.2s; }
          .re-txid-btn   { width:100%; padding:clamp(13px,1.5vw,17px); font-size:clamp(14px,1.5vw,17px); font-weight:700; border:none; border-radius:10px; cursor:pointer; font-family:'DM Sans',sans-serif; transition:background 0.2s; }

          .re-checklist-content { flex:1; overflow-y:auto; padding: clamp(16px,2.5vw,32px) clamp(16px,4vw,56px) 60px; background:#F8FAFC; }
          .re-phase-title { font-family:'DM Serif Display',serif; font-size:clamp(14px,1.6vw,18px); font-weight:400; color:#fff; }
          .re-item-task   { font-size:clamp(13px,1.3vw,15px); color:#1E293B; line-height:1.6; }
          .re-item-doc    { font-size:clamp(10px,1vw,12px); }
          .re-header-title { font-size:clamp(13px,1.5vw,16px); font-weight:600; color:#fff; }
          .re-header-sub   { font-size:clamp(10px,1vw,12px); color:rgba(255,255,255,0.5); letter-spacing:0.06em; text-transform:uppercase; }
          .re-status-strip { background:#1558C0; padding:clamp(6px,1vw,10px) clamp(16px,4vw,56px); display:flex; gap:clamp(12px,2vw,28px); align-items:center; flex-wrap:wrap; flex-shrink:0; }
          .re-back-welcome { background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25); color:rgba(255,255,255,0.85); border-radius:6px; padding:6px 14px; cursor:pointer; font-size:clamp(11px,1.1vw,13px); font-family:'DM Sans',sans-serif; transition:background 0.2s; white-space:nowrap; }
          .re-back-welcome:hover { background:rgba(255,255,255,0.22); }
        `}</style>

        <div className="re-welcome-wrap">
          <div style={{ marginBottom:"clamp(8px,2vw,16px)" }}>
            <div style={{ fontSize:"clamp(10px,1vw,12px)", fontWeight:600, color:C.hint, letterSpacing:"0.09em", textTransform:"uppercase", marginBottom:10 }}>
              Real Estate Lifecycle
            </div>
            <h1 className="re-welcome-title">Welcome to your Transaction Hub</h1>
            <p className="re-welcome-sub">
              Track every step of your property transaction — documents, approvals and compliance — in one place.
              Select your role to get started.
            </p>
          </div>

          <div className="re-persona-grid">
            {Object.entries(PERSONAS).map(([key, info]) => (
              <button
                key={key}
                className="re-persona-card"
                onClick={() => { setPersona(key); setLoginUser(""); setLoginPass(""); setLoginError(""); setStep("re_login"); }}
              >
                <div className="re-persona-icon">{info.icon}</div>
                <div className="re-persona-label">{info.label}</div>
                <div className="re-persona-desc">{info.desc}</div>
              </button>
            ))}
          </div>

          <div className="re-tip">
            💡 Each role has a tailored checklist covering all phases from pre-transaction preparation through to post-registration compliance.
            The Transaction ID is shared — all three parties see live progress on the same transaction.
          </div>
        </div>
      </div>
    );
  }

  // ── RE Login ─────────────────────────────────────────────────
  if (step === "re_login") {
    const isSeller = persona === "seller";
    return (
      <div style={{ minHeight:"100%", background:C.mist, overflowY:"auto", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <style>{`
          .re-auth-card { background:#fff; border-radius:14px; border:1px solid ${C.border}; padding:clamp(28px,4vw,48px) clamp(24px,4vw,44px); width:100%; max-width:440px; box-shadow:0 4px 24px rgba(0,0,0,0.07); }
          .re-auth-input { width:100%; padding:clamp(11px,1.3vw,14px) 14px; font-size:clamp(14px,1.4vw,16px); border-radius:8px; outline:none; font-family:inherit; box-sizing:border-box; transition:border-color 0.2s, background 0.2s; }
          .re-auth-btn { width:100%; padding:clamp(13px,1.5vw,16px); font-size:clamp(14px,1.5vw,16px); font-weight:700; border:none; border-radius:10px; cursor:pointer; font-family:inherit; transition:background 0.2s; }
        `}</style>
        <div className="re-auth-card">
          <button onClick={() => setStep("persona")}
            style={{ fontSize:"clamp(11px,1vw,13px)", color:C.blue, background:"none", border:"none", cursor:"pointer", marginBottom:20, display:"flex", alignItems:"center", gap:5, fontFamily:"inherit", padding:0, fontWeight:500 }}>
            ← Back
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
            <span style={{ fontSize:"clamp(28px,4vw,40px)" }}>{p.icon}</span>
            <div>
              <div style={{ fontSize:"clamp(10px,1vw,11px)", fontWeight:700, color:C.hint, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>{p.label} Portal</div>
              <h2 style={{ fontSize:"clamp(18px,2.5vw,26px)", fontWeight:700, color:C.navy }}>Sign in</h2>
            </div>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:"clamp(10px,1vw,12px)", fontWeight:700, color:C.slate, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>Username</label>
            <input className="re-auth-input" type="text" value={loginUser} autoFocus autoComplete="username"
              onChange={e => setLoginUser(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="your username"
              style={{ border:`1.5px solid ${loginUser ? C.blue : C.border}`, background: loginUser ? C.pale : "#fff", color:C.navy }} />
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ display:"block", fontSize:"clamp(10px,1vw,12px)", fontWeight:700, color:C.slate, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>Password</label>
            <div style={{ position:"relative" }}>
              <input className="re-auth-input" type={showPass ? "text" : "password"} value={loginPass} autoComplete="current-password"
                onChange={e => setLoginPass(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                style={{ border:`1.5px solid ${loginPass ? C.blue : C.border}`, background: loginPass ? C.pale : "#fff", color:C.navy, paddingRight:44 }} />
              <button onClick={() => setShowPass(v => !v)}
                style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:C.hint, fontSize:14, padding:0 }}>
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {loginError && <div style={{ padding:"9px 12px", background:"#FEF2F2", border:"1px solid #FCA5A5", borderRadius:7, fontSize:"clamp(12px,1.1vw,13px)", color:"#991B1B", marginBottom:14 }}>{loginError}</div>}

          <button disabled={loginLoading} onClick={handleLogin} className="re-auth-btn"
            style={{ color:"#fff", background: loginLoading ? C.hint : C.blue, cursor: loginLoading ? "not-allowed" : "pointer" }}>
            {loginLoading ? "Signing in…" : "Sign In →"}
          </button>

          <div style={{ marginTop:20, paddingTop:18, borderTop:`1px solid ${C.border}`, textAlign:"center" }}>
            <div style={{ fontSize:"clamp(12px,1.2vw,14px)", color:C.slate, marginBottom:10 }}>
              New here? Create an account.
            </div>
            <button onClick={() => { setReg(EMPTY_REG); setRegError(""); setRegSuccess(null); setStep("re_register"); }}
              style={{ fontSize:"clamp(13px,1.3vw,15px)", fontWeight:700, color:C.blue, background:"none", border:`1.5px solid ${C.blue}`, borderRadius:8, padding:"9px 22px", cursor:"pointer", fontFamily:"inherit" }}>
              Register →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── RE Register ───────────────────────────────────────────────
  if (step === "re_register") {
    const isBuyer = persona === "buyer";
    return (
      <div style={{ minHeight:"100%", background:C.mist, overflowY:"auto" }}>
        <style>{`
          .re-reg-wrap { padding: clamp(28px,5vw,56px) clamp(24px,8vw,100px); max-width:680px; margin:0 auto; }
          .re-reg-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
          @media(max-width:560px){ .re-reg-grid { grid-template-columns:1fr; } }
          .re-reg-field { margin-bottom:16px; }
          .re-reg-label { display:block; font-size:clamp(10px,1vw,12px); font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:5px; }
          .re-reg-input { width:100%; padding:clamp(10px,1.2vw,13px) 13px; font-size:clamp(13px,1.3vw,15px); border-radius:8px; outline:none; font-family:inherit; box-sizing:border-box; transition:border-color 0.2s, background 0.2s; }
          .re-section-rule { border:none; border-top:1px solid ${C.border}; margin:20px 0 16px; }
        `}</style>

        <div className="re-reg-wrap">
          <button onClick={() => setStep("re_login")}
            style={{ fontSize:"clamp(12px,1.2vw,14px)", color:C.blue, background:"none", border:"none", cursor:"pointer", marginBottom:24, display:"flex", alignItems:"center", gap:6, fontFamily:"inherit", padding:0, fontWeight:500 }}>
            ← Back to Sign In
          </button>

          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:"clamp(10px,1vw,12px)", fontWeight:700, color:C.hint, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>
              {isBuyer ? "🔑 New Buyer" : "🏠 New Seller"}
            </div>
            <h2 style={{ fontSize:"clamp(22px,3vw,30px)", fontWeight:700, color:C.navy, marginBottom:6 }}>Create your account</h2>
            <p style={{ fontSize:"clamp(13px,1.3vw,15px)", color:C.slate, lineHeight:1.6 }}>
              {isBuyer ? "Register to track properties you're interested in. You can link a Transaction ID now or later." : "Register to get a Transaction ID and start tracking your sale end-to-end."}
            </p>
          </div>

          {/* Success */}
          {regSuccess ? (
            <div style={{ background:"#F0FDF4", border:"2px solid #22C55E", borderRadius:12, padding:"28px 32px", textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:10 }}>🎉</div>
              <div style={{ fontSize:"clamp(15px,1.6vw,18px)", fontWeight:700, color:"#15803D", marginBottom:10 }}>Account created!</div>
              {regSuccess.txId ? (
                <>
                  <div style={{ fontSize:"clamp(12px,1.2vw,14px)", color:"#166534", marginBottom:12 }}>
                    {isBuyer ? "Your first tracked property:" : "Your Transaction ID:"}
                  </div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"clamp(18px,2.5vw,28px)", fontWeight:700, color:C.navy, background:"#fff", border:"2px solid #22C55E", borderRadius:10, padding:"12px 20px", letterSpacing:"0.08em", display:"inline-block", marginBottom:16, userSelect:"all" }}>
                    {regSuccess.txId}
                  </div>
                  {!isBuyer && <div style={{ fontSize:"clamp(11px,1.1vw,13px)", color:"#166534", marginBottom:20, lineHeight:1.6 }}>
                    Save this — share it with your buyer and lender so all parties can track progress.
                  </div>}
                </>
              ) : (
                <div style={{ fontSize:"clamp(13px,1.3vw,15px)", color:"#166534", marginBottom:20 }}>
                  You can add Transaction IDs after signing in.
                </div>
              )}
              <button onClick={() => { setItemStates({}); setStep("checklist"); }}
                style={{ fontSize:"clamp(14px,1.4vw,16px)", fontWeight:700, color:"#fff", background:"#15803D", border:"none", borderRadius:8, padding:"12px 28px", cursor:"pointer", fontFamily:"inherit" }}>
                Open My Checklist →
              </button>
            </div>
          ) : (
            <>
              {/* Personal details */}
              <div style={{ fontSize:"clamp(11px,1vw,12px)", fontWeight:700, color:C.blue, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>Personal Details</div>
              <div className="re-reg-grid">
                <div className="re-reg-field" style={{ gridColumn:"1 / -1" }}>
                  <label className="re-reg-label">Full Name *</label>
                  <input className="re-reg-input" type="text" value={reg.name} placeholder="e.g. Rajesh Venkataraman"
                    onChange={e => setReg(p => ({...p, name:e.target.value}))}
                    style={{ border:`1.5px solid ${reg.name ? C.blue : C.border}`, background: reg.name ? C.pale : "#fff", color:C.navy }} />
                </div>
                <div className="re-reg-field">
                  <label className="re-reg-label">Phone *</label>
                  <input className="re-reg-input" type="tel" value={reg.phone} placeholder="+91 98400 XXXXX"
                    onChange={e => setReg(p => ({...p, phone:e.target.value}))}
                    style={{ border:`1.5px solid ${reg.phone ? C.blue : C.border}`, background: reg.phone ? C.pale : "#fff", color:C.navy }} />
                </div>
                <div className="re-reg-field">
                  <label className="re-reg-label">WhatsApp</label>
                  <input className="re-reg-input" type="tel" value={reg.whatsapp} placeholder="+91 98400 XXXXX"
                    onChange={e => setReg(p => ({...p, whatsapp:e.target.value}))}
                    style={{ border:`1.5px solid ${reg.whatsapp ? C.blue : C.border}`, background: reg.whatsapp ? C.pale : "#fff", color:C.navy }} />
                </div>
                <div className="re-reg-field" style={{ gridColumn:"1 / -1" }}>
                  <label className="re-reg-label">Your Address</label>
                  <input className="re-reg-input" type="text" value={reg.address} placeholder="Flat 4B, Anna Nagar, Chennai 600040"
                    onChange={e => setReg(p => ({...p, address:e.target.value}))}
                    style={{ border:`1.5px solid ${reg.address ? C.blue : C.border}`, background: reg.address ? C.pale : "#fff", color:C.navy }} />
                </div>
                {!isBuyer && (
                  <div className="re-reg-field" style={{ gridColumn:"1 / -1" }}>
                    <label className="re-reg-label">Property Address for Sale *</label>
                    <input className="re-reg-input" type="text" value={reg.propertyAddress} placeholder="12/3, Boat Club Road, R.A. Puram, Chennai 600028"
                      onChange={e => setReg(p => ({...p, propertyAddress:e.target.value}))}
                      style={{ border:`1.5px solid ${reg.propertyAddress ? C.blue : C.border}`, background: reg.propertyAddress ? C.pale : "#fff", color:C.navy }} />
                  </div>
                )}
                {isBuyer && (
                  <div className="re-reg-field" style={{ gridColumn:"1 / -1" }}>
                    <label className="re-reg-label">Transaction ID <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0, color:C.hint }}>(optional — from your broker)</span></label>
                    <input className="re-reg-input" type="text" value={reg.txIdInterest}
                      placeholder="TXN-2026-CHN-XXXX"
                      onChange={e => setReg(p => ({...p, txIdInterest:e.target.value.toUpperCase()}))}
                      style={{ fontFamily:"'DM Mono',monospace", letterSpacing:"0.04em", border:`1.5px solid ${reg.txIdInterest ? C.blue : C.border}`, background: reg.txIdInterest ? C.pale : "#fff", color:C.navy }} />
                  </div>
                )}
              </div>

              <hr className="re-section-rule" />

              {/* Login credentials */}
              <div style={{ fontSize:"clamp(11px,1vw,12px)", fontWeight:700, color:C.blue, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>Login Credentials</div>
              <div className="re-reg-grid">
                <div className="re-reg-field" style={{ gridColumn:"1 / -1" }}>
                  <label className="re-reg-label">Choose a Username *</label>
                  <input className="re-reg-input" type="text" value={reg.username} placeholder="e.g. rajesh_seller" autoComplete="new-username"
                    onChange={e => setReg(p => ({...p, username:e.target.value}))}
                    style={{ border:`1.5px solid ${reg.username ? C.blue : C.border}`, background: reg.username ? C.pale : "#fff", color:C.navy }} />
                </div>
                <div className="re-reg-field">
                  <label className="re-reg-label">Password * <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0 }}>(min 6 chars)</span></label>
                  <div style={{ position:"relative" }}>
                    <input className="re-reg-input" type={showPass ? "text" : "password"} value={reg.password} placeholder="••••••••" autoComplete="new-password"
                      onChange={e => setReg(p => ({...p, password:e.target.value}))}
                      style={{ border:`1.5px solid ${reg.password ? C.blue : C.border}`, background: reg.password ? C.pale : "#fff", color:C.navy, paddingRight:40 }} />
                    <button onClick={() => setShowPass(v => !v)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:C.hint, fontSize:13 }}>{showPass ? "🙈" : "👁"}</button>
                  </div>
                </div>
                <div className="re-reg-field">
                  <label className="re-reg-label">Confirm Password *</label>
                  <input className="re-reg-input" type={showPass ? "text" : "password"} value={reg.password2} placeholder="••••••••" autoComplete="new-password"
                    onChange={e => setReg(p => ({...p, password2:e.target.value}))}
                    style={{ border:`1.5px solid ${reg.password2 ? (reg.password2 === reg.password ? "#22C55E" : "#EF4444") : C.border}`, background: reg.password2 ? (reg.password2 === reg.password ? "#F0FDF4" : "#FEF2F2") : "#fff", color:C.navy }} />
                </div>
              </div>

              {regError && <div style={{ padding:"9px 12px", background:"#FEF2F2", border:"1px solid #FCA5A5", borderRadius:7, fontSize:"clamp(12px,1.1vw,13px)", color:"#991B1B", marginBottom:14 }}>{regError}</div>}

              <button disabled={regLoading} onClick={handleRegister}
                style={{ width:"100%", padding:"clamp(13px,1.5vw,16px)", fontSize:"clamp(14px,1.5vw,16px)", fontWeight:700, color:"#fff", background: regLoading ? C.hint : C.blue, border:"none", borderRadius:10, cursor: regLoading ? "not-allowed" : "pointer", fontFamily:"inherit" }}>
                {regLoading ? "Creating account…" : isBuyer ? "Create Buyer Account →" : "Register & Get Transaction ID →"}
              </button>
              <div style={{ marginTop:10, fontSize:"clamp(10px,1vw,12px)", color:C.hint, textAlign:"center" }}>* Required fields</div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Checklist view ───────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:0, flex:1, fontFamily:"'DM Sans',sans-serif", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap');
        .re-checklist-content { flex:1; overflow-y:auto; padding: clamp(16px,2.5vw,32px) clamp(16px,4vw,56px) 60px; background:#F8FAFC; }
        .re-phase-title { font-family:'DM Serif Display',serif; font-size:clamp(14px,1.6vw,18px); font-weight:400; color:#fff; }
        .re-item-task   { font-size:clamp(13px,1.3vw,15px); color:#1E293B; line-height:1.6; }
        .re-item-doc    { font-size:clamp(10px,1vw,12px); }
        .re-header-bar  { background:#0D1B2A; padding:clamp(10px,1.5vw,16px) clamp(16px,4vw,56px); display:flex; align-items:center; justify-content:space-between; gap:16px; flex-shrink:0; flex-wrap:wrap; }
        .re-back-welcome { background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25); color:rgba(255,255,255,0.85); border-radius:6px; padding:5px 12px; cursor:pointer; font-size:clamp(11px,1.1vw,13px); font-family:'DM Sans',sans-serif; transition:background 0.2s; white-space:nowrap; }
        .re-back-welcome:hover { background:rgba(255,255,255,0.22); }
        .re-progress-pill { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:100px; padding:clamp(4px,0.6vw,7px) clamp(10px,1.5vw,16px); display:flex; align-items:center; gap:10px; }
        .re-progress-text { font-size:clamp(11px,1.1vw,13px); color:rgba(255,255,255,0.85); font-weight:500; white-space:nowrap; }
        .re-status-strip { background:#1558C0; padding:clamp(6px,1vw,10px) clamp(16px,4vw,56px); display:flex; gap:clamp(12px,2vw,28px); align-items:center; flex-wrap:wrap; flex-shrink:0; }

        /* Milestone bar */
        .re-milestone-bar { background:#0a1628; padding:clamp(10px,1.5vw,16px) clamp(16px,4vw,56px); flex-shrink:0; overflow-x:auto; }
        .re-milestones { display:flex; align-items:center; min-width:max-content; position:relative; }
        .re-milestone-node { display:flex; flex-direction:column; align-items:center; position:relative; z-index:1; }
        .re-milestone-dot {
          width:clamp(28px,3.5vw,40px); height:clamp(28px,3.5vw,40px);
          border-radius:50%; border:2.5px solid rgba(255,255,255,0.15);
          display:flex; align-items:center; justify-content:center;
          font-size:clamp(10px,1.1vw,13px); font-weight:700; color:rgba(255,255,255,0.5);
          transition:all 0.3s; flex-shrink:0; cursor:default;
        }
        .re-milestone-dot.done      { background:#10B981; border-color:#10B981; color:#fff; box-shadow:0 0 0 4px rgba(16,185,129,0.2); }
        .re-milestone-dot.partial   { background:#F59E0B; border-color:#F59E0B; color:#fff; box-shadow:0 0 0 4px rgba(245,158,11,0.2); }
        .re-milestone-dot.empty     { background:rgba(255,255,255,0.06); }
        .re-milestone-label { font-size:clamp(9px,0.9vw,11px); color:rgba(255,255,255,0.5); margin-top:5px; text-align:center; max-width:clamp(60px,8vw,90px); line-height:1.3; white-space:normal; }
        .re-milestone-label.done    { color:rgba(16,185,129,0.9); }
        .re-milestone-label.partial { color:rgba(245,158,11,0.9); }
        .re-milestone-connector { flex:1; min-width:clamp(16px,3vw,40px); height:2px; background:rgba(255,255,255,0.1); position:relative; top:-clamp(14px,1.8vw,20px); margin:0 2px; }
        .re-milestone-connector-fill { height:100%; background:linear-gradient(90deg,#10B981,#34D399); border-radius:1px; transition:width 0.4s; }

        @media (max-width:480px) { .re-progress-pill { display:none; } .re-milestone-label { display:none; } }
      `}</style>

      {/* ── Header bar with TX ID pills ── */}
      <div className="re-header-bar" style={{ flexDirection:"column", alignItems:"stretch", gap:0, padding:0 }}>

        {/* Top row: nav + progress */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"clamp(10px,1.5vw,16px) clamp(16px,4vw,56px)", flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button className="re-back-welcome" onClick={() => setStep("persona")}>⌂ Welcome</button>
            <div>
              <div style={{ fontSize:"clamp(10px,1vw,12px)", color:"rgba(255,255,255,0.5)", letterSpacing:"0.06em", textTransform:"uppercase" }}>
                {p.icon} {p.label}
              </div>
              <div style={{ fontSize:"clamp(13px,1.5vw,16px)", fontWeight:600, color:"#fff" }}>Transaction Checklist</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {saving && <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>Saving…</span>}
            <div className="re-progress-pill">
              <span className="re-progress-text">{validated} / {total} validated</span>
              <div style={{ width:"clamp(60px,8vw,100px)", height:5, background:"rgba(255,255,255,0.15)", borderRadius:3 }}>
                <div style={{ width:`${pct}%`, height:"100%", background:"linear-gradient(90deg,#34D399,#10B981)", borderRadius:3, transition:"width 0.4s" }} />
              </div>
            </div>
          </div>
        </div>

        {/* TX ID pill row */}
        <div style={{
          borderTop:"1px solid rgba(255,255,255,0.08)",
          padding:"8px clamp(16px,4vw,56px)",
          display:"flex", alignItems:"center", gap:8, overflowX:"auto",
        }}>
          <span style={{ fontSize:"clamp(9px,0.9vw,11px)", fontWeight:700, color:"rgba(255,255,255,0.4)", textTransform:"uppercase", letterSpacing:"0.06em", flexShrink:0 }}>
            {persona === "buyer" ? "Properties:" : "Transaction:"}
          </span>

          {/* Active TX IDs as pills */}
          {(buyerTxIds.length > 0 ? buyerTxIds : txId ? [txId] : []).map(id => (
            <button key={id}
              onClick={async () => {
                const snap = await getDoc(txDocRef(userId, id, persona));
                const data = snap.exists() ? snap.data() : {};
                const address = data.sellerProfile?.propertyAddress
                  || data.buyerProfile?.propertyAddress
                  || "Address not on record yet.";
                setPropertyPopup({ txId: id, address, status: data.status || "active" });
              }}
              style={{
                flexShrink:0, padding:"4px 12px", borderRadius:20,
                border:`1.5px solid ${id === txId ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)"}`,
                background: id === txId ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)",
                color: id === txId ? "#fff" : "rgba(255,255,255,0.55)",
                fontFamily:"'DM Mono',monospace", fontSize:"clamp(10px,1vw,12px)",
                fontWeight: id === txId ? 700 : 400, cursor:"pointer",
                transition:"all 0.15s", display:"flex", alignItems:"center", gap:5,
              }}>
              {id === txId && <span style={{ fontSize:8 }}>●</span>} {id}
            </button>
          ))}

          {/* Add TX ID inline input */}
          {addingTxId ? (
            <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
              <input
                ref={txAddRef}
                type="text" value={txAddInput}
                onChange={e => setTxAddInput(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === "Enter") handleAddTxId(); if (e.key === "Escape") { setAddingTxId(false); setTxAddInput(""); } }}
                placeholder="TXN-2026-CHN-XXXX"
                autoFocus
                style={{
                  padding:"4px 10px", borderRadius:20, border:"1.5px solid rgba(255,255,255,0.4)",
                  background:"rgba(255,255,255,0.1)", color:"#fff", outline:"none",
                  fontFamily:"'DM Mono',monospace", fontSize:"clamp(10px,1vw,12px)",
                  width:"clamp(140px,16vw,200px)", letterSpacing:"0.04em",
                }}
              />
              <button onClick={handleAddTxId} disabled={!txAddInput.trim() || txAddLoading}
                style={{ padding:"4px 12px", borderRadius:20, border:"none", background:"#22C55E", color:"#fff", fontSize:"clamp(10px,1vw,12px)", fontWeight:700, cursor:"pointer", flexShrink:0 }}>
                {txAddLoading ? "…" : "Go"}
              </button>
              <button onClick={() => { setAddingTxId(false); setTxAddInput(""); }}
                style={{ padding:"4px 8px", borderRadius:20, border:"1px solid rgba(255,255,255,0.2)", background:"transparent", color:"rgba(255,255,255,0.5)", fontSize:12, cursor:"pointer" }}>
                ✕
              </button>
            </div>
          ) : (
            <button onClick={() => { setAddingTxId(true); setTimeout(() => txAddRef.current?.focus(), 50); }}
              style={{ flexShrink:0, padding:"4px 12px", borderRadius:20, border:"1.5px dashed rgba(255,255,255,0.25)", background:"transparent", color:"rgba(255,255,255,0.45)", fontSize:"clamp(10px,1vw,12px)", cursor:"pointer", fontFamily:"inherit" }}>
              + Add TX ID
            </button>
          )}
        </div>
      </div>

      {/* ── Sold banner ── */}
      {txStatus === "sold" && (
        <div style={{ background:"#FEF3C7", borderBottom:`2px solid #F59E0B`, padding:"clamp(10px,1.2vw,14px) clamp(16px,4vw,56px)", display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
          <span style={{ fontSize:22 }}>⚠️</span>
          <div>
            <div style={{ fontSize:"clamp(13px,1.3vw,15px)", fontWeight:700, color:"#92400E" }}>This property has been sold</div>
            <div style={{ fontSize:"clamp(11px,1.1vw,13px)", color:"#92400E", marginTop:2 }}>This transaction is now closed. The checklist is read-only for historical reference.</div>
          </div>
        </div>
      )}

      {/* ── Contact cards ── */}
      {(() => {
        const cards = [
          { label:`${p.icon} ${p.label}`, roleKey:"my", data:myContact, setData:setMyContact, readOnly:false },
          { label:"👤 Relationship Manager", roleKey:"rm", data:rmContact, setData:setRmContact, readOnly: persona === "seller" || persona === "buyer" },
        ];
        return (
          <div style={{
            background:"#f0f4ff", borderBottom:`1px solid ${C.border}`,
            padding:"clamp(10px,1.2vw,14px) clamp(16px,4vw,56px)",
            display:"flex", gap:16, flexWrap:"wrap", flexShrink:0,
          }}>
            {cards.map(({ label, roleKey, data, setData, readOnly }) => (
              <ContactCard key={roleKey} label={label} data={data} setData={setData} readOnly={readOnly}
                onSave={(updated) => {
                  const newMy = roleKey === "my" ? updated : myContact;
                  const newRm = roleKey === "rm" ? updated : rmContact;
                  clearTimeout(saveTimer.current);
                  setSaving(true);
                  saveTimer.current = setTimeout(async () => {
                    await setDoc(txDocRef(userId, txId, persona), { myContact:newMy, rmContact:newRm }, { merge:true });
                    setSaving(false);
                  }, 800);
                }}
              />
            ))}
          </div>
        );
      })()}

      {/* ── Milestone progress bar ── */}
      <div className="re-milestone-bar">
        <div className="re-milestones">
          {p.phases.map((phase, i) => {
            const phItems = (byPhase[phase.num] || []);
            const phTotal = phItems.length;
            const phValidated = phItems.filter(item => itemStates[`item_${item._globalIdx}`]?.status === "validated").length;
            const phFailed    = phItems.filter(item => itemStates[`item_${item._globalIdx}`]?.status === "failed").length;
            const isDone    = phTotal > 0 && phValidated === phTotal;
            const isPartial = !isDone && (phValidated > 0 || phFailed > 0);
            const dotClass  = isDone ? "done" : isPartial ? "partial" : "empty";
            const prevPhase   = i > 0 ? p.phases[i-1] : null;
            const prevItems   = prevPhase ? (byPhase[prevPhase.num] || []) : [];
            const prevTotal   = prevItems.length;
            const prevValid   = prevItems.filter(item => itemStates[`item_${item._globalIdx}`]?.status === "validated").length;
            const connFill    = prevTotal > 0 ? Math.round(prevValid / prevTotal * 100) : 0;

            return (
              <div key={phase.num} style={{ display:"flex", alignItems:"flex-start", flex: i < p.phases.length - 1 ? 1 : "none" }}>
                <div className="re-milestone-node">
                  <div className={`re-milestone-dot ${dotClass}`}>
                    {isDone ? "✓" : phase.num}
                  </div>
                  <div className={`re-milestone-label ${dotClass}`}>{phase.title}</div>
                </div>
                {i < p.phases.length - 1 && (
                  <div className="re-milestone-connector">
                    <div className="re-milestone-connector-fill" style={{ width:`${connFill}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status summary strip */}
      <div className="re-status-strip">
        {[
          { label:"No link",     count: total - validated - inReview - failed, color:"#FCA5A5" },
          { label:"Under review",count: inReview,   color:"#FCD34D" },
          { label:"Validated",   count: validated,  color:"#6EE7B7" },
          { label:"Failed",      count: failed,     color:"#FCA5A5" },
        ].map(({ label, count, color }) => (
          <div key={label} style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:color, display:"inline-block", flexShrink:0 }} />
            <span style={{ fontSize:"clamp(11px,1.1vw,13px)", color:"rgba(255,255,255,0.8)" }}>{count} {label}</span>
          </div>
        ))}
      </div>

      {/* Scrollable checklist */}
      <div className="re-checklist-content">
        {p.phases.map(phase => {
          const phaseItems = (byPhase[phase.num] || []);
          return (
            <PhaseSection
              key={phase.num}
              phase={phase}
              items={phaseItems}
              itemStates={itemStates}
              onUpdate={handleUpdate}
              onOpenComments={(comments) => setCommentsModal(comments)}
            />
          );
        })}
      </div>

      {/* ── Property Address Popup ── */}
      {propertyPopup && (
        <div onClick={() => setPropertyPopup(null)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:"#fff", borderRadius:14, padding:"28px 32px", maxWidth:460, width:"100%", boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
              <div>
                <div style={{ fontSize:"clamp(10px,1vw,11px)", fontWeight:700, color:C.blue, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Property Details</div>
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"clamp(14px,1.6vw,18px)", fontWeight:700, color:C.navy }}>{propertyPopup.txId}</div>
              </div>
              <button onClick={() => setPropertyPopup(null)}
                style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.hint, lineHeight:1, marginLeft:12 }}>×</button>
            </div>

            <div style={{ padding:"16px 18px", background:C.pale, borderRadius:10, border:`1px solid ${C.pale2}`, marginBottom:16 }}>
              <div style={{ fontSize:"clamp(10px,1vw,11px)", fontWeight:700, color:C.slate, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>📍 Property Address</div>
              <div style={{ fontSize:"clamp(14px,1.4vw,16px)", color:C.navy, lineHeight:1.6 }}>{propertyPopup.address}</div>
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
              <span style={{
                fontSize:"clamp(11px,1.1vw,13px)", fontWeight:600, padding:"4px 12px", borderRadius:20,
                background: propertyPopup.status === "sold" ? "#FEF3C7" : "#F0FDF4",
                color: propertyPopup.status === "sold" ? "#92400E" : "#15803D",
                border: `1px solid ${propertyPopup.status === "sold" ? "#F59E0B" : "#22C55E"}`,
              }}>
                {propertyPopup.status === "sold" ? "⚠️ Sold" : "✓ Active"}
              </span>
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button
                onClick={async () => {
                  setLoading(true);
                  setTxId(propertyPopup.txId);
                  const snap = await getDoc(txDocRef(userId, propertyPopup.txId, persona));
                  const data = snap.exists() ? snap.data() : {};
                  setItemStates(data.items || {});
                  setTxStatus(data.status || "active");
                  if (data.myContact) setMyContact(data.myContact);
                  if (data.rmContact) setRmContact(data.rmContact);
                  setLoading(false);
                  setPropertyPopup(null);
                }}
                style={{ flex:1, padding:"10px", fontSize:"clamp(13px,1.3vw,15px)", fontWeight:700, color:"#fff", background:C.blue, border:"none", borderRadius:8, cursor:"pointer", fontFamily:"inherit" }}>
                Open Checklist →
              </button>
              <button onClick={() => setPropertyPopup(null)}
                style={{ padding:"10px 16px", fontSize:"clamp(12px,1.2vw,14px)", color:C.slate, background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, cursor:"pointer", fontFamily:"inherit" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reviewer Comments Modal */}
      {commentsModal && (
        <div
          onClick={() => setCommentsModal(null)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background:"#fff", borderRadius:12, padding:"clamp(20px,3vw,32px)", maxWidth:480, width:"100%", boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}
          >
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontSize:"clamp(14px,1.5vw,17px)", fontWeight:700, color:"#DC2626" }}>💬 Reviewer Comments</div>
              <button onClick={() => setCommentsModal(null)}
                style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.hint, lineHeight:1 }}>×</button>
            </div>
            <div style={{ padding:"14px 16px", background:"#FEF2F2", border:"1px solid #FCA5A5", borderRadius:8, fontSize:"clamp(13px,1.3vw,15px)", color:"#7F1D1D", lineHeight:1.7 }}>
              {commentsModal}
            </div>
            <button onClick={() => setCommentsModal(null)}
              style={{ marginTop:18, width:"100%", padding:"clamp(10px,1.2vw,13px)", fontSize:"clamp(13px,1.3vw,15px)", fontWeight:600, color:C.white, background:C.navy, border:"none", borderRadius:7, cursor:"pointer", fontFamily:"inherit" }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
