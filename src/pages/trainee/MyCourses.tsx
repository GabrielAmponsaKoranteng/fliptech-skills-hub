import { useEffect, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Circle, PartyPopper, PlayCircle } from 'lucide-react';
import { useApp, useUser } from '../../context/AppContext';
import { courseStats } from '../../lib/listings';
import { ownedCourseIds } from '../../lib/listings';
import { PageTitle } from '../../components/DashboardLayout';
import { Empty, Img, SIZES } from '../../components/ui';
import type { Course } from '../../types';
import { resized } from '../../assets/images';
import { usePageMeta } from '../../lib/pageMeta';

/** Courses the signed-in trainee owns, with progress. Courses deleted by their seller are skipped. */
export function useMyCourses() {
  const { orders, courses, progressFor } = useApp();
  const user = useUser();
  return useMemo(() => {
    const ids = ownedCourseIds(orders, user.id);
    return courses.filter((c) => ids.has(c.id)).map((c) => {
      const p = progressFor(c.id);
      const total = courseStats(c).lessons;
      const done = c.curriculum.filter((l) => p.done.includes(l.id)).length;
      return { course: c, done, total, pct: total ? Math.round((done / total) * 100) : 0, last: p.last };
    });
  }, [orders, courses, user.id, progressFor]);
}

function ProgressBar({ pct }: { pct: number }) {
  return <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${pct}%`, background: pct === 100 ? 'var(--success-500)' : undefined }} /></div>;
}

const ctaLabel = (done: number, total: number) => (done === 0 ? 'Start course' : done === total ? 'Review' : 'Continue');

export function MyCourses() {
  const mine = useMyCourses();
  return (
    <>
      <PageTitle title="My courses" sub={mine.length ? `${mine.length} course${mine.length === 1 ? '' : 's'} · learn at your own pace` : 'Online courses you’ve bought or enrolled in.'}>
        <Link to="/courses" className="btn btn-secondary"><BookOpen size={16} /> Browse courses</Link>
      </PageTitle>
      {mine.length === 0 ? (
        <div className="card"><Empty icon="BookOpen" title="No courses yet" text="Free and paid courses you enrol in will appear here, with your progress." action={<Link to="/courses" className="btn btn-primary">Find a course</Link>} /></div>
      ) : (
        <div className="shop-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {mine.map(({ course: c, done, total, pct }) => (
            <article key={c.id} className="shop-card">
              <Link to={`/app/courses/${c.id}`} className="shop-media" aria-label={`Continue ${c.title}`}><Img src={c.img} alt="" sizes={SIZES.card} />{pct === 100 && <span className="shop-badge green">Completed</span>}</Link>
              <div className="shop-body" style={{ gap: 8 }}>
                <Link to={`/app/courses/${c.id}`} className="shop-title">{c.title}</Link>
                <div className="shop-by">By {c.by}</div>
                <ProgressBar pct={pct} />
                <div className="row-between xs muted"><span>{done} of {total} lessons</span><span>{pct}%</span></div>
                <Link to={`/app/courses/${c.id}`} className="btn btn-primary btn-sm btn-block mt-1">{ctaLabel(done, total)}</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

/** Dashboard card: courses started but not finished. */
export function ContinueLearning() {
  const mine = useMyCourses().filter((m) => m.done < m.total).slice(0, 2);
  if (mine.length === 0) return null;
  return (
    <div className="card">
      <div className="card-head"><h3>Continue learning</h3><Link to="/app/courses" className="small bold">My courses</Link></div>
      {mine.map(({ course: c, done, total, pct }) => (
        <Link key={c.id} to={`/app/courses/${c.id}`} className="li" style={{ color: 'inherit' }}>
          <Img src={c.img} alt="" className="li-img" sizes={SIZES.thumb} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="bold small ellipsis">{c.title}</div>
            <div className="mt-1"><ProgressBar pct={pct} /></div>
            <div className="xs muted mt-1">{done} of {total} lessons</div>
          </div>
          <span className="btn btn-soft btn-sm">{ctaLabel(done, total)}</span>
        </Link>
      ))}
    </div>
  );
}

function NotOwned({ c }: { c?: Course }) {
  return (
    <div className="card">
      <Empty icon="Lock" title={c ? 'You haven’t enrolled in this course' : 'Course not found'} text={c ? 'Enrol to unlock every lesson and track your progress.' : 'It may have been removed by the seller.'}
        action={<Link to={c ? `/courses/${c.id}` : '/app/courses'} className="btn btn-primary">{c ? 'View course' : 'My courses'}</Link>} />
    </div>
  );
}

export function CoursePlayer() {
  const { id } = useParams();
  const { courses, orders, setLessonDone, setLastLesson, progressFor, toast } = useApp();
  const user = useUser();
  const [params, setParams] = useSearchParams();
  const c = courses.find((x) => x.id === id);
  const owned = !!c && ownedCourseIds(orders, user.id).has(c.id);
  const progress = c ? progressFor(c.id) : { done: [] as string[] };

  // Open the lesson in the URL, else where they left off, else the first unfinished one.
  const fallback = c && (c.curriculum.find((l) => l.id === progress.last) ?? c.curriculum.find((l) => !progress.done.includes(l.id)) ?? c.curriculum[0]);
  const lesson = c?.curriculum.find((l) => l.id === params.get('lesson')) ?? fallback;
  const index = c && lesson ? c.curriculum.indexOf(lesson) : -1;

  useEffect(() => { if (c && lesson && owned) setLastLesson(c.id, lesson.id); }, [c?.id, lesson?.id, owned]); // eslint-disable-line react-hooks/exhaustive-deps

  usePageMeta(c && lesson ? { title: `${lesson.title} – ${c.title}` } : null);

  if (!c || !owned || !lesson) return <NotOwned c={c} />;

  const total = c.curriculum.length;
  const doneCount = c.curriculum.filter((l) => progress.done.includes(l.id)).length;
  const pct = Math.round((doneCount / total) * 100);
  const isDone = progress.done.includes(lesson.id);
  const go = (i: number) => { const next = new URLSearchParams(params); next.set('lesson', c.curriculum[i].id); setParams(next); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const complete = () => {
    setLessonDone(c.id, lesson.id, !isDone);
    if (isDone) return;
    if (doneCount + 1 === total) toast(`You finished ${c.title}!`);
    else if (index < total - 1) go(index + 1);
  };

  return (
    <>
      <Link to="/app/courses" className="back-link mb-4"><ArrowLeft size={16} /> My courses</Link>
      <div className="player-grid">
        <div style={{ minWidth: 0 }}>
          <div className="player">
            <Img src={resized(c.img, 1200)} alt="" sizes={SIZES.half} priority />
            <div className="player-overlay">
              <PlayCircle size={64} strokeWidth={1.4} />
              <div className="bold mt-2">{lesson.title}</div>
              <div className="xs" style={{ opacity: 0.8 }}>{lesson.minutes} min · video will stream here once lessons are uploaded</div>
            </div>
          </div>
          <div className="row-between wrap mt-4" style={{ gap: 12 }}>
            <div>
              <div className="xs muted">Lesson {index + 1} of {total}</div>
              <h1 style={{ fontSize: 22 }}>{lesson.title}</h1>
            </div>
            <button className={`btn ${isDone ? 'btn-secondary' : 'btn-success'}`} onClick={complete}>
              {isDone ? <><Circle size={16} /> Mark as not done</> : <><CheckCircle2 size={16} /> Mark as complete</>}
            </button>
          </div>
          {pct === 100 && (
            <div className="notice success mt-4"><PartyPopper size={18} /><div><b>Course complete.</b> Well done — you’ve finished every lesson in {c.title}.</div></div>
          )}
          <div className="row-between mt-6">
            <button className="btn btn-ghost" disabled={index === 0} onClick={() => go(index - 1)}><ArrowLeft size={16} /> Previous</button>
            <button className="btn btn-ghost" disabled={index === total - 1} onClick={() => go(index + 1)}>Next <ArrowRight size={16} /></button>
          </div>
        </div>

        <aside className="card player-side">
          <div className="card-body" style={{ paddingBottom: 12 }}>
            <div className="bold">{c.title}</div>
            <div className="mt-3"><ProgressBar pct={pct} /></div>
            <div className="row-between xs muted mt-1"><span>{doneCount} of {total} complete</span><span>{pct}%</span></div>
          </div>
          <ol className="curriculum player-list">
            {c.curriculum.map((l, i) => {
              const d = progress.done.includes(l.id);
              return (
                <li key={l.id} className={l.id === lesson.id ? 'on' : ''}>
                  <button onClick={() => go(i)}>
                    {d ? <CheckCircle2 size={18} color="var(--success-500)" aria-label="Completed" /> : <span className="cur-num">{i + 1}</span>}
                    <span className="grow" style={{ textAlign: 'left' }}>{l.title}</span>
                    <span className="xs muted">{l.minutes}m</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </>
  );
}

