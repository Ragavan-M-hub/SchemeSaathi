import { Link, useNavigate } from "react-router-dom";
import { useT, useLanguage } from "../i18n/LanguageContext.jsx";
import { useAppContext } from "../context/AppContext.jsx";
import GlossaryTooltip from "../components/GlossaryTooltip.jsx";
import { getGlossaryEntry } from "../data/glossary.js";
import { personas } from "../data/personas.js";

const categories = [
  ["🌿", "For entrepreneurs", "Loans & business support", "/schemes"],
  ["🎓", "For students", "Scholarships & education", "/schemes"],
  ["👩", "For women", "Support & family benefits", "/schemes"],
  ["🏦", "For businesses", "Credit & financial support", "/emi"],
];

function GlossaryCard({ term }) {
  const { lang } = useLanguage();
  const entry = getGlossaryEntry(term, lang);
  if (!entry) return null;
  return <GlossaryTooltip term={term}><div className="modern-category" style={{height:"100%",alignItems:"flex-start"}}><span className="modern-category-icon">?</span><span><b>{entry.term}</b><small>{entry.plain}</small></span></div></GlossaryTooltip>;
}

function JourneyStep({ number, done, active, title, desc, icon, to, state, btnLabel, locked }) {
  const t = useT();
  return <div className="modern-step" style={{opacity: locked ? .5 : 1}}><span>0{number}</span><div><div style={{fontSize:25,marginBottom:10}}>{done ? "✓" : icon}</div><h3>{title}</h3><p>{desc}</p>{locked ? <div style={{fontSize:11,color:"#8c9891",marginTop:12}}>🔒 {t("home.journey.completeFirst")}</div> : <Link to={to} state={state} className={done ? "btn btn-ghost !mt-3 hero-submain-btn" : "btn btn-primary !mt-3 hero-submain-btn"}>{btnLabel}</Link>}</div></div>;
}

export default function Home() {
  const t = useT();
  const { lang } = useLanguage();
  const { state, update, markStep, resetJourney } = useAppContext();
  const navigate = useNavigate();
  const { stepsCompleted } = state;
  const hasProgress = stepsCompleted.recommender || stepsCompleted.emi || stepsCompleted.partners;

  const launchPersona = (persona) => { update({ ...persona.form, _personaActive: persona.id }); navigate("/schemes"); };

  return <div className="home-modern">
    <section className="home-hero">
      <div>
        <span className="eyebrow">✦ Your guide to government schemes</span>
        <h1>Benefits you deserve,<br/><em>made simple.</em></h1>
        <p className="home-hero-copy">Find the right government schemes for you and your family. Clear answers, fewer forms, and a little help along the way.</p>
        <div className="hero-search-modern"><span>⌕</span><input placeholder="Search for a scheme, benefit or need..." aria-label="Search schemes" onKeyDown={e => {if(e.key === "Enter") navigate(`/schemes?search=${encodeURIComponent(e.currentTarget.value)}`)}}/><kbd>↵</kbd></div>
        <div style={{display:"flex",gap:9,marginTop:12,fontSize:11,color:"#8b9690"}}><span>Try searching</span><button style={{border:0,background:"none",color:"var(--green)"}} onClick={()=>navigate("/schemes")}>loans</button><button style={{border:0,background:"none",color:"var(--green)"}} onClick={()=>navigate("/schemes")}>education</button><button style={{border:0,background:"none",color:"var(--green)"}} onClick={()=>navigate("/schemes")}>business</button></div>
        <div className="hero-actions"><Link to="/schemes" className="btn btn-primary hero-main-btn">Find my benefits →</Link><Link to="/emi" className="btn btn-ghost hero-main-btn">Calculate EMI</Link></div>
      </div>
      <div className="hero-visual-modern">
        <div className="paper-card-modern"><div className="paper-top"><span>SCHEMESAATHI / 2026</span><span>01</span></div><div className="paper-symbol">✓</div><h2>Good things<br/>come to those<br/><span>who apply.</span></h2><div className="paper-line"/><p>We help you find them.</p><div className="stamp">✓ VERIFIED</div></div>
        <div className="floating-note-modern note-one"><span className="note-icon-modern">✓</span><div><b>Smart matching</b><small>Built around your profile</small></div></div>
        <div className="floating-note-modern note-two"><span>♥</span><div><b style={{color:"var(--ink)"}}>Made for you</b><small>Less jargon, more clarity</small></div></div>
      </div>
    </section>

    <section className="home-section">
      <div className="section-heading-modern"><div><span className="section-kicker-modern">START HERE</span><h2>What are you looking for?</h2><p>Tell us a little about yourself. We’ll do the looking.</p></div><Link to="/schemes" className="btn btn-ghost">View all schemes →</Link></div>
      <div className="modern-category-grid">{categories.map(([icon,title,copy,to]) => <Link key={title} to={to} className="modern-category"><span className="modern-category-icon">{icon}</span><span><b>{title}</b><small>{copy}</small></span><span className="modern-category-arrow">→</span></Link>)}</div>
    </section>

    <section className="home-section" style={{paddingTop:25}}>
      <div className="section-heading-modern"><div><span className="section-kicker-modern">QUICK START</span><h2>Try a profile that feels familiar.</h2><p>One click loads realistic demo details into the real recommender.</p></div></div>
      <div className="modern-feature-grid">{personas.slice(0,3).map(p => <button key={p.id} className="modern-feature" onClick={()=>launchPersona(p)} style={{textAlign:"left",cursor:"pointer"}}><div className="modern-feature-art mint"><span className="symbol">{p.emoji}</span><span className="tag">DEMO PROFILE</span></div><div className="modern-feature-body"><small>PERSONA</small><h3>{p.label[lang] || p.label.en}</h3><div className="meta"><span>Ready to explore</span><strong>Try it →</strong></div></div></button>)}</div>
    </section>

    <section className="how-modern">
      <div><span className="section-kicker-modern">NO CONFUSION. JUST ANSWERS.</span><h2>A simpler way to get<br/><em>what’s yours.</em></h2><Link to="/schemes" className="btn btn-primary hero-main-btn">Find my benefits →</Link></div>
      <div className="modern-steps">
        <JourneyStep number={1} done={stepsCompleted.recommender} active={!stepsCompleted.recommender} title={t("home.journey.s1.title")} desc={t("home.journey.s1.desc")} icon="🎯" to="/schemes" state={{fromJourney:true}} btnLabel={stepsCompleted.recommender ? t("home.journey.edit") : t("home.journey.start")}/>
        <JourneyStep number={2} done={stepsCompleted.emi} active={stepsCompleted.recommender&&!stepsCompleted.emi} title={t("home.journey.s2.title")} desc={t("home.journey.s2.desc")} icon="🧮" to="/emi" btnLabel={stepsCompleted.emi ? t("home.journey.edit") : t("home.journey.start")} locked={!stepsCompleted.recommender}/>
        <JourneyStep number={3} done={stepsCompleted.partners} active={stepsCompleted.emi&&!stepsCompleted.partners} title={t("home.journey.s3.title")} desc={t("home.journey.s3.desc")} icon="🏦" to="/partners" btnLabel={stepsCompleted.partners ? t("home.journey.edit") : t("home.journey.start")} locked={!stepsCompleted.emi}/>
      </div>
    </section>

    <section className="home-section">
      <div className="section-heading-modern"><div><span className="section-kicker-modern">PLAIN LANGUAGE</span><h2>Financial terms, explained.</h2><p>Tap a term to understand what it means before you make a decision.</p></div></div>
      <div className="modern-category-grid" style={{gridTemplateColumns:"repeat(4,1fr)"}}>{["moratorium","npa","concessional","channelPartner","emi","collateral","sca"].map(term=><GlossaryCard key={term} term={term}/>)}</div>
    </section>

    <section className="trust-modern"><div className="trust-icon">✓</div><div className="trust-copy"><h2>Built for citizens, not paperwork.</h2><p>SchemeSaathi is an independent platform making public benefits easier to understand and access.</p></div><Link to="/about" className="btn btn-ghost">Learn about us →</Link></section>
    {hasProgress && <div style={{textAlign:"center",paddingBottom:35}}><button onClick={resetJourney} style={{border:0,background:"none",color:"#7f8d84",textDecoration:"underline",fontSize:12}}>{t("home.journey.reset")}</button></div>}
  </div>;
}
