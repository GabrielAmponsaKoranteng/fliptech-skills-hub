import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, ArrowRight, GraduationCap, Play, ShoppingBag, Megaphone } from 'lucide-react';
import { AREAS, SITE, SKILL_CATEGORIES, TRADES } from '../../data/catalog';
import { HOME_IMG } from '../../assets/images';
import { useApp } from '../../context/AppContext';
import { isPublished } from '../../lib/listings';
import { CardGridSkeleton, Img } from '../../components/ui';
import { CourseCard, ProductCard } from '../../components/ShopCards';

const POPULAR = ['Tailoring', 'Welding', 'Hairdressing', 'Catering', 'ICT', 'Carpentry', 'Electrical Installation'];

const PILLARS = [
  { tone: 'violet', icon: GraduationCap, title: 'Find Training', text: 'Discover training centres, trainers and programmes near you.', cta: 'Explore Training', to: '/search', img: HOME_IMG.training },
  { tone: 'pink', icon: Play, title: 'Online Learning', text: 'Access recorded courses, learn at your own pace and gain new skills.', cta: 'Browse Courses', to: '/courses', img: HOME_IMG.learning },
  { tone: 'blue', icon: ShoppingBag, title: 'Marketplace', text: 'Shop quality products made by trainers and skilled professionals.', cta: 'Shop Products', to: '/marketplace', img: HOME_IMG.market },
];

/** Turn a free-text skill into the best search URL (trade filter when it matches a trade). */
function searchUrl(q: string, area: string) {
  const params = new URLSearchParams();
  const trade = TRADES.find((t) => t.name.toLowerCase().startsWith(q.trim().toLowerCase().split(' ')[0]) && q.trim());
  if (trade) params.set('trade', trade.id);
  else if (q.trim()) params.set('q', q.trim());
  if (area) params.set('area', area);
  return `/search?${params}`;
}

export default function Home() {
  const nav = useNavigate();
  const { courses, products, dataStatus } = useApp();
  const loading = dataStatus === 'loading';
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');

  return (
    <div className="home">
      {SITE.announcement.trim() && (
        <div className="site-banner brand"><Megaphone size={16} /> {SITE.announcement} <Link to="/search">Find training</Link></div>
      )}
      {/* ---------- Hero ---------- */}
      <section className="h-hero">
        <div className="h-hero-img"><Img src={HOME_IMG.hero} alt="A tailor sewing colourful fabric at her machine" sizes="(max-width: 820px) 100vw, 58vw" priority /></div>
        <div className="container h-hero-inner">
          <div className="h-hero-copy fade-in">
            <div className="h-eyebrow">Find • Learn • Create • Sell</div>
            <h1>Turn your skills into opportunities.</h1>
            <p className="h-lead">Discover training, learn from skilled professionals and shop products made by talented people.</p>
            <form className="h-search" role="search" onSubmit={(e) => { e.preventDefault(); nav(searchUrl(q, area)); }}>
              <label className="h-field grow">
                <Search size={19} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What skill are you looking for?" aria-label="Skill" />
              </label>
              <label className="h-field h-field-loc">
                <MapPin size={19} />
                <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Location or region">
                  <option value="">Location or region</option>
                  {AREAS.map((a) => <option key={a}>{a}</option>)}
                </select>
              </label>
              <button className="btn btn-primary btn-lg" type="submit">Find Opportunities</button>
            </form>
            <div className="h-popular">
              <span>Popular searches:</span>
              {POPULAR.map((p) => <button key={p} type="button" className="h-chip" onClick={() => nav(searchUrl(p, area))}>{p}</button>)}
            </div>
          </div>
        </div>
        <div className="h-script" aria-hidden="true">
          <svg viewBox="0 0 220 200" className="h-script-blob">
            <path d="M28 52c22-34 92-46 140-30 40 13 54 52 44 92-9 38-46 66-96 70-46 4-90-18-104-56C2 96 10 78 28 52Z" />
          </svg>
          <span>Skills<br />for a<br />Brighter<br />Future</span>
          <svg viewBox="0 0 120 20" className="h-script-swash"><path d="M4 14C40 2 80 2 116 10" /></svg>
        </div>
      </section>

      {/* ---------- Three pillars ---------- */}
      <section className="container h-pillars">
        {PILLARS.map(({ tone, icon: I, title, text, cta, to, img }) => (
          <article key={title} className={`h-pillar ${tone}`}>
            <div className="h-pillar-copy">
              <div className="h-pillar-head"><span className="h-pillar-ico"><I size={26} /></span><h2>{title}</h2></div>
              <p>{text}</p>
              <Link to={to} className="btn btn-sm h-pillar-btn">{cta} <ArrowRight size={15} /></Link>
            </div>
            <div className="h-pillar-img"><Img src={img} alt="" sizes="(max-width: 820px) 100vw, 400px" /></div>
          </article>
        ))}
      </section>

      {/* ---------- Popular skills ---------- */}
      <section className="container h-section">
        <div className="h-head">
          <div>
            <h2>Explore popular skills</h2>
            <p>Discover something you can learn, practise or turn into a business.</p>
          </div>
          <Link to="/search" className="h-more">View all categories <ArrowRight size={15} /></Link>
        </div>
        <div className="h-skills">
          {SKILL_CATEGORIES.map((c) => (
            <Link key={c.id} to={c.to} className="h-skill">
              <div className="h-skill-img"><Img src={c.img} alt="" sizes="(max-width: 640px) 50vw, 240px" /></div>
              <span>{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- Courses + products ---------- */}
      <section className="container h-section h-featured">
        <div>
          <div className="h-head">
            <h2>Featured Online Courses</h2>
            <Link to="/courses" className="h-more">View all courses <ArrowRight size={15} /></Link>
          </div>
          {loading ? <CardGridSkeleton count={3} className="h-cards" /> : <div className="h-cards">{courses.filter(isPublished).slice(0, 3).map((c) => <CourseCard key={c.id} c={c} />)}</div>}
        </div>
        <div>
          <div className="h-head">
            <h2>Featured Products</h2>
            <Link to="/marketplace" className="h-more">View all products <ArrowRight size={15} /></Link>
          </div>
          {loading ? <CardGridSkeleton count={3} className="h-cards" /> : <div className="h-cards">{products.filter(isPublished).slice(0, 3).map((p) => <ProductCard key={p.id} p={p} />)}</div>}
        </div>
      </section>

      {/* ---------- Provider CTA ---------- */}
      <section className="container h-section">
        <div className="h-cta">
          <div className="h-cta-copy">
            <h2><span>Have a skill</span> to share?</h2>
            <p>Register as a trainer or seller, showcase your expertise and connect with new learners and customers.</p>
          </div>
          <Link to="/for-trainers" className="btn btn-primary btn-lg h-cta-btn">Become a Provider <ArrowRight size={17} /></Link>
          <div className="h-cta-people">
            <div className="h-avatars">{HOME_IMG.people.map((src, i) => <Img key={i} src={src} alt="" sizes="40px" />)}</div>
            <span className="h-cta-script">Join our<br />community!</span>
          </div>
        </div>
      </section>
    </div>
  );
}
