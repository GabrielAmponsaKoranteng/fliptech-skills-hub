import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, BookOpen, ExternalLink, ImagePlus, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp, useUser, type ListingKind } from '../../context/AppContext';
import { PROVIDERS, SKILL_CATEGORIES } from '../../data/catalog';
import { courseStats } from '../../lib/listings';
import { LOW_STOCK, unitsSold } from '../../lib/listings';
import { sellerIdFor } from '../../lib/orders';
import { imageToDataUrl } from '../../lib/image';
import { PageTitle } from '../../components/DashboardLayout';
import { Drawer, Empty, Img, Modal, Stat, Switch, inertRef, SIZES } from '../../components/ui';
import { CourseCard, ProductCard, ghs } from '../../components/ShopCards';
import type { Course, CourseLevel, Product } from '../../types';

const LEVELS: CourseLevel[] = ['Beginner', 'Intermediate', 'Advanced'];

/** Form state: numbers stay as strings while typing; lessons are editable rows. */
interface ListingForm {
  kind: ListingKind;
  id?: string;
  title: string;
  by: string;
  cat: string;
  price: string;
  description: string;
  img: string;
  published: boolean;
  // course
  level: CourseLevel;
  outcomes: string;
  lessons: { id: string; title: string; minutes: string }[];
  // product
  stock: string;
}

const newLessonId = () => `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;

function blankForm(kind: ListingKind, by: string): ListingForm {
  return {
    kind, title: '', by, cat: kind === 'course' ? 'welding' : 'crafts', price: '', description: '', img: '', published: true,
    level: 'Beginner', outcomes: '', lessons: [{ id: newLessonId(), title: '', minutes: '15' }], stock: '10',
  };
}

const toForm = (x: Course | Product): ListingForm => ('curriculum' in x
  ? { ...blankForm('course', x.by), id: x.id, title: x.title, cat: x.cat, price: String(x.price), description: x.description, img: x.img, published: x.status === 'Published',
      level: x.level, outcomes: x.outcomes.join('\n'), lessons: x.curriculum.map((l) => ({ id: l.id, title: l.title, minutes: String(l.minutes) })) }
  : { ...blankForm('product', x.by), id: x.id, title: x.title, cat: x.cat, price: String(x.price), description: x.description, img: x.img, published: x.status === 'Published', stock: String(x.stock) });

function validate(f: ListingForm): Partial<Record<'title' | 'price' | 'description' | 'img' | 'outcomes' | 'lessons' | 'stock' | 'by', string>> {
  const e: ReturnType<typeof validate> = {};
  if (f.title.trim().length < 4) e.title = 'Give it a clear title (at least 4 characters)';
  if (!f.by.trim()) e.by = 'Who teaches or makes this?';
  const price = Number(f.price);
  if (f.price.trim() === '' || !Number.isFinite(price) || price < 0) e.price = f.kind === 'course' ? 'Enter a price, or 0 for a free course' : 'Enter a price';
  else if (f.kind === 'product' && price <= 0) e.price = 'Products need a price above 0';
  if (f.description.trim().length < 30) e.description = 'Describe it in at least 30 characters so buyers know what they get';
  if (!f.img) e.img = 'Add a photo — listings with photos sell far better';
  if (f.kind === 'course') {
    if (f.outcomes.split('\n').filter((l) => l.trim()).length < 2) e.outcomes = 'List at least 2 things learners will be able to do';
    if (f.lessons.length === 0 || f.lessons.some((l) => !l.title.trim() || !(Number(l.minutes) > 0))) e.lessons = 'Every lesson needs a title and a length in minutes';
  } else if (!(Number.isInteger(Number(f.stock)) && Number(f.stock) >= 0)) e.stock = 'Enter how many you have (0 or more)';
  return e;
}

/** Turns the form into a listing, keeping fields the form doesn't edit (rating, badge) from the original. */
function fromForm(f: ListingForm, sellerId: string, original?: Course | Product): Course | Product {
  const base = {
    id: f.id ?? `${f.kind === 'course' ? 'c' : 'm'}-${Date.now().toString(36)}`,
    title: f.title.trim(), by: f.by.trim(), sellerId, cat: f.cat, price: Number(f.price), img: f.img,
    description: f.description.trim(), status: f.published ? 'Published' as const : 'Hidden' as const,
    rating: original?.rating ?? 0, reviews: original?.reviews ?? 0,
  };
  if (f.kind === 'course') {
    const prev = original && 'curriculum' in original ? original : undefined;
    return {
      ...base, badge: prev?.badge ?? 'New', level: f.level,
      outcomes: f.outcomes.split('\n').map((l) => l.trim()).filter(Boolean),
      curriculum: f.lessons.map((l) => ({ id: l.id, title: l.title.trim(), minutes: Number(l.minutes) })),
    };
  }
  return { ...base, stock: Number(f.stock) };
}

function ListingDrawer({ form, setForm, onClose, onSave, original, saving = false }: {
  form: ListingForm; setForm: (f: ListingForm) => void; onClose: () => void; onSave: () => void; original?: Course | Product; saving?: boolean;
}) {
  const { toast } = useApp();
  const user = useUser();
  const [touched, setTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const errors = validate(form);
  const set = <K extends keyof ListingForm>(k: K, v: ListingForm[K]) => setForm({ ...form, [k]: v });
  const err = (k: keyof typeof errors) => touched && errors[k] && <span className="error-text">{errors[k]}</span>;
  const preview = useMemo(() => fromForm(form, sellerIdFor(user), original), [form, user, original]);

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try { set('img', await imageToDataUrl(file)); } catch (x) { toast((x as Error).message, 'error'); } finally { setUploading(false); }
  };

  const moveLesson = (i: number, d: -1 | 1) => {
    const ls = [...form.lessons];
    [ls[i], ls[i + d]] = [ls[i + d], ls[i]];
    set('lessons', ls);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length) { toast('Please fix the highlighted fields', 'error'); return; }
    onSave();
  };

  const isCourse = form.kind === 'course';
  const totalMin = form.lessons.reduce((s, l) => s + (Number(l.minutes) || 0), 0);

  return (
    <Drawer open onClose={onClose} title={`${form.id ? 'Edit' : 'New'} ${isCourse ? 'course' : 'product'}`}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="listing-form" disabled={uploading || saving}>{saving ? <><span className="spinner" /> Saving…</> : form.id ? 'Save changes' : form.published ? 'Publish' : 'Save as hidden'}</button></>}>
      <form id="listing-form" className="stack" onSubmit={submit} noValidate>
        <div className="field">
          <span className="label">Photo <span className="req">*</span></span>
          <div className="row" style={{ alignItems: 'stretch' }}>
            <div className="listing-photo">{form.img ? <Img src={form.img} alt="" sizes="240px" /> : <ImagePlus size={26} />}</div>
            <div className="stack-sm" style={{ justifyContent: 'center' }}>
              <label className="btn btn-secondary btn-sm"><ImagePlus size={15} /> {uploading ? 'Processing…' : form.img ? 'Change photo' : 'Upload photo'}<input type="file" accept="image/*" hidden onChange={onPhoto} /></label>
              <span className="xs muted">JPG or PNG. We resize it for you.</span>
            </div>
          </div>
          {err('img')}
        </div>
        <div className="field">
          <label className="label" htmlFor="lf-title">Title <span className="req">*</span></label>
          <input id="lf-title" className={`input ${touched && errors.title ? 'invalid' : ''}`} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder={isCourse ? 'e.g. Welding Fundamentals' : 'e.g. Welding Starter Toolkit'} />
          {err('title')}
        </div>
        <div className="form-grid">
          <div className="field">
            <label className="label" htmlFor="lf-by">{isCourse ? 'Taught by' : 'Made by'} <span className="req">*</span></label>
            <input id="lf-by" className={`input ${touched && errors.by ? 'invalid' : ''}`} value={form.by} onChange={(e) => set('by', e.target.value)} />
            {err('by')}
          </div>
          <div className="field">
            <label className="label" htmlFor="lf-cat">Category</label>
            <select id="lf-cat" className="select" value={form.cat} onChange={(e) => set('cat', e.target.value)}>
              {SKILL_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="lf-price">Price (GHS) <span className="req">*</span></label>
            <input id="lf-price" type="number" min="0" step="1" className={`input ${touched && errors.price ? 'invalid' : ''}`} value={form.price} onChange={(e) => set('price', e.target.value)} placeholder={isCourse ? '0 for free' : 'e.g. 120'} />
            {err('price')}
          </div>
          {isCourse ? (
            <div className="field">
              <label className="label" htmlFor="lf-level">Level</label>
              <select id="lf-level" className="select" value={form.level} onChange={(e) => set('level', e.target.value as CourseLevel)}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
            </div>
          ) : (
            <div className="field">
              <label className="label" htmlFor="lf-stock">Stock <span className="req">*</span></label>
              <input id="lf-stock" type="number" min="0" step="1" className={`input ${touched && errors.stock ? 'invalid' : ''}`} value={form.stock} onChange={(e) => set('stock', e.target.value)} />
              {err('stock')}
            </div>
          )}
        </div>
        <div className="field">
          <label className="label" htmlFor="lf-desc">Description <span className="req">*</span></label>
          <textarea id="lf-desc" className={`textarea ${touched && errors.description ? 'invalid' : ''}`} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={800}
            placeholder={isCourse ? 'Who is this course for and what will they be able to do after it?' : 'What is it made of, how big is it, and who is it for?'} />
          <div className="row-between">{err('description') || <span />}<span className="hint">{form.description.length}/800</span></div>
        </div>

        {isCourse && (
          <>
            <div className="field">
              <label className="label" htmlFor="lf-out">What learners will be able to do <span className="req">*</span></label>
              <textarea id="lf-out" className={`textarea ${touched && errors.outcomes ? 'invalid' : ''}`} style={{ minHeight: 90 }} value={form.outcomes} onChange={(e) => set('outcomes', e.target.value)} placeholder={'One per line, e.g.\nWork safely in a workshop\nChoose the right electrode'} />
              {err('outcomes')}
            </div>
            <div className="field">
              <div className="row-between"><span className="label">Lessons <span className="req">*</span></span><span className="xs muted">{form.lessons.length} lessons · {Math.round(totalMin / 6) / 10} h</span></div>
              <div className="stack-sm">
                {form.lessons.map((l, i) => (
                  <div key={l.id} className="lesson-row">
                    <span className="cur-num">{i + 1}</span>
                    <input className="input grow" aria-label={`Lesson ${i + 1} title`} placeholder="Lesson title" value={l.title} onChange={(e) => set('lessons', form.lessons.map((x) => (x.id === l.id ? { ...x, title: e.target.value } : x)))} />
                    <input className="input" style={{ width: 76 }} type="number" min="1" aria-label={`Lesson ${i + 1} minutes`} value={l.minutes} onChange={(e) => set('lessons', form.lessons.map((x) => (x.id === l.id ? { ...x, minutes: e.target.value } : x)))} />
                    <span className="xs muted">min</span>
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={i === 0} onClick={() => moveLesson(i, -1)} aria-label="Move up"><ArrowUp size={15} /></button>
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={i === form.lessons.length - 1} onClick={() => moveLesson(i, 1)} aria-label="Move down"><ArrowDown size={15} /></button>
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={form.lessons.length === 1} onClick={() => set('lessons', form.lessons.filter((x) => x.id !== l.id))} aria-label="Remove lesson"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-soft btn-sm mt-2" style={{ alignSelf: 'flex-start' }} onClick={() => set('lessons', [...form.lessons, { id: newLessonId(), title: '', minutes: '15' }])}><Plus size={15} /> Add lesson</button>
              {err('lessons')}
              <span className="hint">Video upload comes with the backend; for now lessons show a placeholder player.</span>
            </div>
          </>
        )}

        <label className="row" style={{ gap: 12 }}>
          <Switch checked={form.published} onChange={(v) => set('published', v)} label="Published" />
          <span><span className="bold small">{form.published ? 'Published' : 'Hidden'}</span><br /><span className="xs muted">{form.published ? 'Visible in the marketplace' : 'Only you can see it'}</span></span>
        </label>

        <div>
          <div className="xs bold muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>Preview</div>
          {/* A picture of the card, not a working one: inert, so its links can't be focused or announced. */}
          <div style={{ maxWidth: 260 }} ref={inertRef}>{'curriculum' in preview ? <CourseCard c={preview} showMeta /> : <ProductCard p={preview} />}</div>
        </div>
      </form>
    </Drawer>
  );
}

export function SellerListings() {
  const { courses, products, orders, saveListing, setListingStatus, deleteListing, toast } = useApp();
  const user = useUser();
  const sellerId = sellerIdFor(user);
  const centreName = PROVIDERS.find((p) => p.id === sellerId)?.name ?? user.name;
  const [tab, setTab] = useState<ListingKind>('course');
  const [form, setForm] = useState<ListingForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Course | Product | null>(null);

  const myCourses = courses.filter((c) => c.sellerId === sellerId);
  const myProducts = products.filter((p) => p.sellerId === sellerId);
  const all = [...myCourses, ...myProducts];
  const original = form?.id ? all.find((x) => x.id === form.id) : undefined;
  const sold = (x: Course | Product) => unitsSold(orders, x);
  const salesValue = all.reduce((s, x) => s + sold(x) * x.price, 0);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const save = async () => {
    if (!form || saving) return;
    setSaving(true);
    const listing = await saveListing(fromForm(form, sellerId, original));
    setSaving(false);
    if (!listing) return; // keep the drawer open so nothing typed is lost
    toast(form.id ? `${listing.title} updated` : listing.status === 'Published' ? `${listing.title} is live in the marketplace` : `${listing.title} saved as hidden`);
    setTab(form.kind);
    setForm(null);
  };
  const remove = async (x: Course | Product) => {
    setDeleting(true);
    const ok = await deleteListing('curriculum' in x ? 'course' : 'product', x.id);
    setDeleting(false);
    if (ok) toast(`${x.title} deleted`);
    setConfirmDelete(null);
  };

  const rows = tab === 'course' ? myCourses : myProducts;

  return (
    <>
      <PageTitle title="Listings" sub="Courses and products you sell in the Fliptech marketplace.">
        <button className="btn btn-secondary" onClick={() => setForm(blankForm('product', centreName))}><Package size={16} /> New product</button>
        <button className="btn btn-primary" onClick={() => setForm(blankForm('course', user.name))}><BookOpen size={16} /> New course</button>
      </PageTitle>

      <div className="stats mb-6">
        <Stat icon="Store" tone="brand" label="Published" value={all.filter((x) => x.status === 'Published').length} />
        <Stat icon="Eye" tone="violet" label="Hidden" value={all.filter((x) => x.status === 'Hidden').length} />
        <Stat icon="ShoppingBag" tone="success" label="Units sold" value={all.reduce((s, x) => s + sold(x), 0)} />
        <Stat icon="Send" tone="accent" label="Sales value" value={ghs(salesValue)} />
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="tabs" style={{ border: 0 }}>
            <button className={tab === 'course' ? 'on' : ''} onClick={() => setTab('course')}>Courses <span className="count">{myCourses.length}</span></button>
            <button className={tab === 'product' ? 'on' : ''} onClick={() => setTab('product')}>Products <span className="count">{myProducts.length}</span></button>
          </div>
        </div>
        {rows.length === 0 ? (
          <Empty icon={tab === 'course' ? 'BookOpen' : 'Store'} title={`No ${tab === 'course' ? 'courses' : 'products'} yet`}
            text={tab === 'course' ? 'Record your lessons once and sell them to learners anywhere in Ghana.' : 'Sell tools, kits or items made in your workshop.'}
            action={<button className="btn btn-primary" onClick={() => setForm(tab === 'course' ? blankForm('course', user.name) : blankForm('product', centreName))}><Plus size={16} /> Add your first {tab}</button>} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{tab === 'course' ? 'Course' : 'Product'}</th><th>Price</th><th>{tab === 'course' ? 'Content' : 'Stock'}</th><th>Sold</th><th>Published</th><th /></tr></thead>
              <tbody>
                {rows.map((x) => {
                  const href = `/${'curriculum' in x ? 'courses' : 'marketplace'}/${x.id}`;
                  return (
                    <tr key={x.id} style={x.status === 'Hidden' ? { opacity: 0.7 } : undefined}>
                      <td><div className="cell-user"><Img src={x.img} alt="" className="thumb" sizes={SIZES.thumb} /><div style={{ minWidth: 0 }}><strong className="ellipsis" style={{ display: 'block', maxWidth: 260 }}>{x.title}</strong><span className="xs muted">By {x.by}</span></div></div></td>
                      <td className="price">{x.price === 0 ? 'Free' : ghs(x.price)}</td>
                      <td className="small">
                        {'curriculum' in x
                          ? <>{courseStats(x).lessons} lessons · {courseStats(x).hours} h</>
                          : <span className={`badge ${x.stock <= 0 ? 'badge-danger' : x.stock <= LOW_STOCK ? 'badge-warn' : 'badge-success'}`}>{x.stock <= 0 ? 'Sold out' : `${x.stock} in stock`}</span>}
                      </td>
                      <td>{sold(x)}</td>
                      <td><Switch checked={x.status === 'Published'} onChange={(v) => { setListingStatus(tab, x.id, v ? 'Published' : 'Hidden'); toast(v ? `${x.title} is live` : `${x.title} hidden from the marketplace`); }} label={`Published: ${x.title}`} /></td>
                      <td>
                        <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                          <Link to={href} className="btn btn-ghost btn-icon btn-sm" aria-label={`Preview ${x.title}`}><ExternalLink size={16} /></Link>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setForm(toForm(x))} aria-label={`Edit ${x.title}`}><Pencil size={16} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setConfirmDelete(x)} aria-label={`Delete ${x.title}`}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form && <ListingDrawer form={form} setForm={setForm} onClose={() => setForm(null)} onSave={() => void save()} original={original} saving={saving} />}

      {(() => {
        const x = confirmDelete;
        const isCourse = !!x && 'curriculum' in x;
        // Learners' access lives on the course listing, so a sold course can only be hidden.
        const locked = !!x && isCourse && sold(x) > 0;
        return (
          <Modal open={!!x} onClose={() => setConfirmDelete(null)} title={locked ? 'This course has learners' : `Delete ${x?.title}?`}
            footer={locked
              ? <><button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button><button className="btn btn-primary" onClick={() => { if (x) { setListingStatus('course', x.id, 'Hidden'); toast(`${x.title} hidden from the marketplace`); } setConfirmDelete(null); }}>Hide it instead</button></>
              : <><button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Keep it</button><button className="btn btn-danger" disabled={deleting} onClick={() => { if (x) void remove(x); else setConfirmDelete(null); }}>{deleting ? <><span className="spinner" /> Deleting…</> : 'Delete'}</button></>}>
            {locked
              ? <p className="muted">{sold(x!)} learner{sold(x!) === 1 ? ' has' : 's have'} bought “{x?.title}”, so it can’t be deleted — they would lose access. Hide it to stop new sales; existing learners keep their lessons.</p>
              : <p className="muted">It will be removed from the marketplace and from any shopping carts.{x && sold(x) > 0 && ' Past orders keep their details.'} If you might sell it again, hide it instead.</p>}
          </Modal>
        );
      })()}
    </>
  );
}
