// Seed data for the mock API (src/api/mock). App code must not import this file —
// it reads data through `src/api` and reference data through `src/data/catalog`.
import type {
  Activity, AdminUser, CartItem, Course, Enquiry, Lesson, Order, OrderContact, Product, Programme, Provider, QueueItem, Review, Role,
  SkillCategory, Trade, TradeId, User,
} from '../types';

import { IMG, unsplash as u } from '../assets/images';



export const TRADES: Trade[] = [
  { id: 'welding', name: 'Welding', icon: 'Flame', color: '#ea580c', bg: '#fff1e6', img: IMG.welding1 },
  { id: 'tailoring', name: 'Tailoring', icon: 'Scissors', color: '#be185d', bg: '#fdf0f6', img: IMG.tailoring1 },
  { id: 'plumbing', name: 'Plumbing', icon: 'Wrench', color: '#0369a1', bg: '#eaf6fd', img: IMG.plumbing1 },
  { id: 'auto', name: 'Auto Mechanics', icon: 'Car', color: '#4338ca', bg: '#eef0ff', img: IMG.auto1 },
  { id: 'hair', name: 'Hairdressing', icon: 'Sparkles', color: '#a21caf', bg: '#fbefff', img: IMG.hair1 },
  { id: 'electrical', name: 'Electrical', icon: 'Zap', color: '#a16207', bg: '#fef9e7', img: IMG.electrical1 },
  { id: 'carpentry', name: 'Carpentry', icon: 'Hammer', color: '#7c2d12', bg: '#fbf1ea', img: IMG.carpentry1 },
];

export const AREAS = ['Accra Central', 'Kaneshie', 'Madina', 'Tema', 'Spintex', 'East Legon', 'Dansoman', 'Adenta', 'Kasoa', 'Teshie', 'Osu', 'Achimota'];

const AREA_COORDS: Record<string, [number, number]> = {
  'Accra Central': [5.5502, -0.2174], Kaneshie: [5.5667, -0.2378], Madina: [5.6731, -0.1664],
  Tema: [5.6698, -0.0166], Spintex: [5.6316, -0.1170], 'East Legon': [5.6350, -0.1610],
  Dansoman: [5.5402, -0.2671], Adenta: [5.7060, -0.1640], Kasoa: [5.5340, -0.4170],
  Teshie: [5.5830, -0.1050], Osu: [5.5560, -0.1820], Achimota: [5.6170, -0.2340],
};

const jitter = (n: number, s: number) => n + (((s * 9301 + 49297) % 233280) / 233280 - 0.5) * 0.02;

/** The fields every seed listing must supply; everything else has a sensible default. */
type ProviderSeed = Pick<Provider, 'id' | 'name' | 'area' | 'trade' | 'fee' | 'months' | 'intake' | 'ctvet' | 'visited' | 'places' | 'images' | 'blurb'>
  & Partial<Provider>;

const defaultProgrammes = (o: ProviderSeed, t: Trade): Programme[] => [
  { id: 'p1', name: `${t.name} – Certificate Programme`, fee: o.fee, months: o.months, days: 'Mon – Fri', time: '8:00am – 4:00pm', type: 'Certificate', intake: o.intake, places: o.places },
  { id: 'p2', name: `Weekend ${t.name} Course`, fee: Math.round(o.fee * 0.8), months: o.months, days: 'Sat – Sun', time: '9:00am – 3:00pm', type: 'Short course', intake: o.intake, places: Math.max(6, o.places - 4) },
];

const P = (o: ProviderSeed, i: number): Provider => {
  const t = tradeById(o.trade);
  const [lat, lng] = AREA_COORDS[o.area];
  return {
    rating: 4.6, reviews: 24, students: 120, founded: 2014, phone: '024 123 4567',
    email: null, hours: 'Mon – Fri, 8:00am – 4:00pm',
    programmeType: 'Certificate',
    payment: 'Full payment or instalments',
    about: `${o.name} is a ${o.ctvet ? 'CTVET-registered ' : ''}training centre in ${o.area} offering hands-on ${t.name.toLowerCase()} training. Classes are small, practical and led by working professionals so trainees graduate ready to earn.`,
    programmes: defaultProgrammes(o, t),
    ...o,
    coords: [jitter(lat, i + 1), jitter(lng, i + 7)],
  };
};

export const PROVIDERS: Provider[] = [
  P({
    id: 'accra-central-welding', name: 'Accra Central Welding Works', area: 'Accra Central', trade: 'welding',
    fee: 750, months: 3, intake: '2026-10-06', ctvet: true, visited: 'Apr 2026', rating: 4.8, reviews: 42, students: 310, founded: 2015,
    places: 12, programmeType: 'Certificate', payment: 'Full payment or instalments',
    images: [IMG.welding1, IMG.welding2, IMG.welding3, IMG.welding4, IMG.workshop],
    blurb: 'Learn practical welding skills including arc welding, MIG welding and metal fabrication. Hands-on training with experienced instructors.',
    about: 'Accra Central Welding Works has been training young people in practical metal fabrication skills for over 10 years. Our instructors are certified artisans who run active fabrication contracts, so trainees learn on real jobs — gates, burglar-proofing, roofing trusses and container conversions.',
    programmes: [
      { id: 'p1', name: 'Welding – Certificate Programme', fee: 750, months: 3, days: 'Mon – Fri', time: '8:00am – 4:00pm', type: 'Certificate', intake: '2026-10-06', places: 12 },
      { id: 'p2', name: 'Advanced MIG & TIG Welding', fee: 1400, months: 4, days: 'Mon – Fri', time: '8:00am – 2:00pm', type: 'Advanced Certificate', intake: '2026-11-03', places: 8 },
      { id: 'p3', name: 'Weekend Metal Fabrication', fee: 600, months: 3, days: 'Sat – Sun', time: '9:00am – 3:00pm', type: 'Short course', intake: '2026-10-18', places: 15 },
    ],
  }, 0),
  P({
    id: 'kaneshie-welding', name: 'Kaneshie Welding Training School', area: 'Kaneshie', trade: 'welding',
    fee: 900, months: 6, intake: '2026-10-14', ctvet: true, visited: null, rating: 4.5, reviews: 18, places: 20,
    images: [IMG.welding3, IMG.welding1, IMG.welding4, IMG.workshop],
    blurb: 'Six-month structural welding programme with a final CTVET-recognised assessment.',
  }, 1),
  P({
    id: 'madina-tailoring', name: 'Madina Tailoring Institute', area: 'Madina', trade: 'tailoring',
    fee: 650, months: 4, intake: '2026-10-20', ctvet: true, visited: 'Mar 2026', rating: 4.9, reviews: 57, places: 10,
    images: [IMG.tailoring1, IMG.tailoring2, IMG.team],
    blurb: 'Pattern drafting, kaba & slit, men’s wear and fashion business basics.',
  }, 2),
  P({
    id: 'madina-welding', name: 'Madina Welding Institute', area: 'Madina', trade: 'welding',
    fee: 800, months: 4, intake: '2026-10-20', ctvet: false, visited: 'Jan 2026', rating: 4.3, reviews: 11, places: 14,
    images: [IMG.welding4, IMG.welding2, IMG.welding1],
    blurb: 'Gate fabrication, burglar-proofing and general arc welding for beginners.',
  }, 3),
  P({
    id: 'tema-welding', name: 'Tema Community Welding Centre', area: 'Tema', trade: 'welding',
    fee: 950, months: 6, intake: '2026-11-03', ctvet: true, visited: null, rating: 4.6, reviews: 23, places: 18,
    images: [IMG.welding2, IMG.welding3, IMG.welding1],
    blurb: 'Port-industry focused pipe and structural welding with industrial attachment.',
  }, 4),
  P({
    id: 'kaneshie-auto', name: 'Kaneshie Auto Mechanics', area: 'Kaneshie', trade: 'auto',
    fee: 1200, months: 6, intake: '2026-10-14', ctvet: true, visited: 'Feb 2026', rating: 4.7, reviews: 36, places: 16,
    images: [IMG.auto1, IMG.auto2, IMG.workshop],
    blurb: 'Engine diagnostics, servicing, brakes and suspension on real customer vehicles.',
  }, 5),
  P({
    id: 'tema-plumbing', name: 'Tema Plumbing Centre', area: 'Tema', trade: 'plumbing',
    fee: 800, months: 4, intake: '2026-10-14', ctvet: true, visited: 'May 2026', rating: 4.5, reviews: 21, places: 12,
    images: [IMG.plumbing1, IMG.plumbing2, IMG.construction],
    blurb: 'Domestic plumbing, PPR & PVC pipe fitting, water tanks and bathroom installs.',
  }, 6),
  P({
    id: 'spintex-hair', name: 'Spintex Hairdressing Academy', area: 'Spintex', trade: 'hair',
    fee: 700, months: 6, intake: '2026-10-15', ctvet: false, visited: null, rating: 4.4, reviews: 29, places: 20,
    images: [IMG.hair1, IMG.hair2, IMG.team],
    blurb: 'Braiding, weaving, relaxing, natural hair care and salon management.',
  }, 7),
  P({
    id: 'achimota-electrical', name: 'Achimota Electrical Installation School', area: 'Achimota', trade: 'electrical',
    fee: 1100, months: 6, intake: '2026-11-10', ctvet: true, visited: 'Apr 2026', rating: 4.7, reviews: 33, places: 15,
    images: [IMG.electrical1, IMG.electrical2, IMG.construction],
    blurb: 'Domestic wiring, solar PV basics and Energy Commission exam preparation.',
  }, 8),
  P({
    id: 'dansoman-carpentry', name: 'Dansoman Carpentry & Joinery', area: 'Dansoman', trade: 'carpentry',
    fee: 850, months: 5, intake: '2026-10-27', ctvet: true, visited: null, rating: 4.6, reviews: 15, places: 10,
    images: [IMG.carpentry1, IMG.carpentry2, IMG.workshop],
    blurb: 'Furniture making, roofing carpentry, wood finishing and shop safety.',
  }, 9),
  P({
    id: 'osu-tailoring', name: 'Osu Fashion & Tailoring House', area: 'Osu', trade: 'tailoring',
    fee: 950, months: 6, intake: '2026-11-02', ctvet: false, visited: 'Jun 2026', rating: 4.8, reviews: 40, places: 12,
    images: [IMG.tailoring2, IMG.tailoring1, IMG.team],
    blurb: 'Contemporary African fashion design, cutting and finishing for ready-to-wear.',
  }, 10),
  P({
    id: 'adenta-auto', name: 'Adenta Auto Electrical Centre', area: 'Adenta', trade: 'auto',
    fee: 1300, months: 6, intake: '2026-10-21', ctvet: true, visited: 'Mar 2026', rating: 4.5, reviews: 19, places: 10,
    images: [IMG.auto2, IMG.auto1, IMG.electrical2],
    blurb: 'Auto electrical systems, scan-tool diagnostics and hybrid vehicle basics.',
  }, 11),
  P({
    id: 'east-legon-hair', name: 'East Legon Beauty & Hair School', area: 'East Legon', trade: 'hair',
    fee: 1500, months: 6, intake: '2026-10-12', ctvet: true, visited: 'May 2026', rating: 4.9, reviews: 64, places: 8,
    images: [IMG.hair2, IMG.hair1, IMG.team],
    blurb: 'Professional cosmetology, wig making, makeup artistry and client care.',
  }, 12),
  P({
    id: 'teshie-plumbing', name: 'Teshie Plumbing & Gas Fitting', area: 'Teshie', trade: 'plumbing',
    fee: 720, months: 3, intake: '2026-10-19', ctvet: false, visited: null, rating: 4.2, reviews: 9, places: 14,
    images: [IMG.plumbing2, IMG.plumbing1, IMG.construction],
    blurb: 'Fast-track plumbing with LPG gas line installation safety module.',
  }, 13),
  P({
    id: 'kasoa-electrical', name: 'Kasoa Solar & Electrical Academy', area: 'Kasoa', trade: 'electrical',
    fee: 980, months: 4, intake: '2026-11-16', ctvet: true, visited: null, rating: 4.6, reviews: 22, places: 18,
    images: [IMG.electrical2, IMG.electrical1, IMG.construction],
    blurb: 'Solar PV installation, inverters and battery systems for homes and shops.',
  }, 14),
  P({
    id: 'adenta-carpentry', name: 'Adenta Woodcraft Training Centre', area: 'Adenta', trade: 'carpentry',
    fee: 780, months: 4, intake: '2026-11-09', ctvet: false, visited: 'Feb 2026', rating: 4.4, reviews: 12, places: 12,
    images: [IMG.carpentry2, IMG.carpentry1, IMG.workshop],
    blurb: 'Cabinetry, kitchen units and modern furniture with power tools.',
  }, 15),
];

export const REVIEWS: Review[] = [
  { name: 'Kofi Asante', rating: 5, date: 'Aug 2026', text: 'The instructors are patient and you spend most of the day actually welding. I got my first paid job two weeks after finishing.' },
  { name: 'Abena Owusu', rating: 5, date: 'Jul 2026', text: 'Very organised. They explained the fees clearly and let me pay in instalments. The workshop is safe and well equipped.' },
  { name: 'Yaw Boateng', rating: 4, date: 'Jun 2026', text: 'Good practical training. Classes start on time. I wish there were more evening sessions for people who work.' },
];

export const USERS: Record<Role, User> = {
  trainee: { id: 'u1', role: 'trainee', name: 'Kwame Mensah', email: 'kwame@example.com', phone: '024 123 4567', area: 'Madina' },
  trainer: { id: 'u2', role: 'trainer', name: 'Emmanuel Tetteh', email: 'info@accracentralwelding.com', phone: '020 555 0182', centreId: 'accra-central-welding' },
  admin: { id: 'u3', role: 'admin', name: 'Akosua Darko', email: 'akosua@fliptech.com', phone: '030 222 1100' },
};

/** All enquiries, shared by trainees and centres. u1 is the demo trainee (Kwame). */
export const ENQUIRIES: Enquiry[] = [
  { id: 'e1', providerId: 'accra-central-welding', userId: 'u1', programme: 'Welding – Certificate Programme', trainee: 'Kwame Mensah', phone: '024 123 4567', date: '2026-10-02', status: 'Sent', inboxStatus: 'New', centreUnread: true,
    thread: [{ from: 'trainee', text: 'Hello, I’m interested in the next intake. Can you share more details about fees and requirements?', at: '2 Oct, 10:14' }] },
  { id: 'e2', providerId: 'kaneshie-auto', userId: 'u1', programme: 'Auto Mechanics – Certificate Programme', trainee: 'Kwame Mensah', phone: '024 123 4567', date: '2026-10-01', status: 'Replied', inboxStatus: 'Replied', centreUnread: false,
    thread: [
      { from: 'trainee', text: 'Do you accept people without any previous experience?', at: '1 Oct, 09:02' },
      { from: 'trainer', text: 'Yes! Most of our trainees start as complete beginners. Come for a visit any weekday between 9am and 3pm.', at: '1 Oct, 13:40' },
    ] },
  { id: 'e3', providerId: 'madina-tailoring', userId: 'u1', programme: 'Tailoring – Certificate Programme', trainee: 'Kwame Mensah', phone: '024 123 4567', date: '2026-09-28', status: 'Sent', inboxStatus: 'New', centreUnread: true,
    thread: [{ from: 'trainee', text: 'Is there a weekend class available?', at: '28 Sep, 16:22' }] },
  { id: 't1', providerId: 'accra-central-welding', userId: 'buyer-ama', trainee: 'Ama Serwaa', phone: '055 812 3344', programme: 'Welding – Certificate Programme', date: '2026-10-04', status: 'Sent', inboxStatus: 'New', centreUnread: true,
    thread: [{ from: 'trainee', text: 'Good morning. Please, is the October intake still open? And can I pay half now and half later?', at: '4 Oct, 08:41' }] },
  { id: 't3', providerId: 'accra-central-welding', userId: 'buyer-daniel', trainee: 'Daniel Ofori', phone: '026 441 9087', programme: 'Advanced MIG & TIG Welding', date: '2026-09-30', status: 'Replied', inboxStatus: 'Replied', centreUnread: false,
    thread: [
      { from: 'trainee', text: 'I already have basic arc welding experience. Can I join the advanced class directly?', at: '30 Sep, 11:05' },
      { from: 'trainer', text: 'Yes, you can. We do a short practical test on the first day to confirm your level.', at: '30 Sep, 14:12' },
    ] },
  { id: 't4', providerId: 'accra-central-welding', userId: 'buyer-esi', trainee: 'Esi Mensah', phone: '050 120 7781', programme: 'Weekend Metal Fabrication', date: '2026-09-27', status: 'Replied', inboxStatus: 'Enrolled', centreUnread: false,
    thread: [
      { from: 'trainee', text: 'I work during the week. Is the weekend class good for beginners?', at: '27 Sep, 18:30' },
      { from: 'trainer', text: 'It is designed for working people. Bring a valid ID and GH₵100 registration on the first Saturday.', at: '28 Sep, 08:15' },
      { from: 'trainee', text: 'Great, see you on the 18th!', at: '28 Sep, 09:02' },
    ] },
  { id: 't5', providerId: 'accra-central-welding', trainee: 'Michael Addo', phone: '024 990 1123', programme: 'Welding – Certificate Programme', date: '2026-09-22', status: 'Replied', inboxStatus: 'Closed', centreUnread: false,
    thread: [{ from: 'trainee', text: 'What is the age requirement?', at: '22 Sep, 12:00' }, { from: 'trainer', text: 'Trainees must be 16 or older.', at: '22 Sep, 15:31' }] },
];

export const ADMIN_QUEUE: QueueItem[] = [
  { id: 'q1', name: 'Kpone Steel Fabrication Hub', owner: 'Isaac Nartey', area: 'Tema', trade: 'welding', submitted: '2026-10-03', docs: ['Business registration', 'CTVET certificate', 'Photos of workshop'], status: 'Pending', img: IMG.welding4 },
  { id: 'q2', name: 'Legon Glam Hair Studio', owner: 'Naa Adjeley', area: 'East Legon', trade: 'hair', submitted: '2026-10-02', docs: ['Business registration', 'Photos of salon'], status: 'Pending', img: IMG.hair2 },
  { id: 'q3', name: 'Ashaiman Auto Clinic', owner: 'Samuel Kumi', area: 'Tema', trade: 'auto', submitted: '2026-10-01', docs: ['Business registration', 'CTVET certificate', 'Instructor CVs'], status: 'Visit scheduled', img: IMG.auto2 },
  { id: 'q4', name: 'Nima Stitch Academy', owner: 'Fatima Iddrisu', area: 'Accra Central', trade: 'tailoring', submitted: '2026-09-29', docs: ['Photos of workshop'], status: 'Needs info', img: IMG.tailoring2 },
  { id: 'q5', name: 'Weija Pipes & Fittings School', owner: 'Kojo Annan', area: 'Kasoa', trade: 'plumbing', submitted: '2026-09-27', docs: ['Business registration', 'CTVET certificate'], status: 'Pending', img: IMG.plumbing2 },
];

export const ADMIN_USERS: AdminUser[] = [
  { id: 'a1', name: 'Kwame Mensah', email: 'kwame@example.com', role: 'trainee', area: 'Madina', joined: '2026-08-14', status: 'Active', enquiries: 3 },
  { id: 'a2', name: 'Emmanuel Tetteh', email: 'info@accracentralwelding.com', role: 'trainer', area: 'Accra Central', joined: '2025-11-02', status: 'Active', enquiries: 48 },
  { id: 'a3', name: 'Ama Serwaa', email: 'ama.serwaa@example.com', role: 'trainee', area: 'Kaneshie', joined: '2026-10-01', status: 'Active', enquiries: 1 },
  { id: 'a4', name: 'Grace Amponsah', email: 'grace@madinatailoring.com', role: 'trainer', area: 'Madina', joined: '2025-12-19', status: 'Active', enquiries: 61 },
  { id: 'a5', name: 'Daniel Ofori', email: 'd.ofori@example.com', role: 'trainee', area: 'Tema', joined: '2026-09-11', status: 'Active', enquiries: 2 },
  { id: 'a6', name: 'Isaac Nartey', email: 'isaac@kponesteel.com', role: 'trainer', area: 'Tema', joined: '2026-10-03', status: 'Pending', enquiries: 0 },
  { id: 'a7', name: 'Yaw Darko', email: 'yaw.darko@example.com', role: 'trainee', area: 'Adenta', joined: '2026-07-02', status: 'Suspended', enquiries: 14 },
  { id: 'a8', name: 'Akosua Darko', email: 'akosua@fliptech.com', role: 'admin', area: 'Osu', joined: '2025-06-01', status: 'Active', enquiries: 0 },
  { id: 'a9', name: 'Esi Mensah', email: 'esi.m@example.com', role: 'trainee', area: 'Spintex', joined: '2026-09-25', status: 'Active', enquiries: 1 },
  { id: 'a10', name: 'Kofi Boateng', email: 'kofi@kaneshieauto.com', role: 'trainer', area: 'Kaneshie', joined: '2026-01-08', status: 'Active', enquiries: 37 },
];

export const ACTIVITY: Activity[] = [
  { icon: 'BadgeCheck', tone: 'success', text: 'Madina Tailoring Institute was verified', by: 'Akosua Darko', at: '2 hours ago' },
  { icon: 'Building2', tone: 'brand', text: 'Kpone Steel Fabrication Hub submitted for verification', by: 'Isaac Nartey', at: 'Yesterday' },
  { icon: 'Flag', tone: 'danger', text: 'Enquiry reported as spam on Spintex Hairdressing Academy', by: 'System', at: 'Yesterday' },
  { icon: 'UserX', tone: 'warn', text: 'User Yaw Darko suspended for repeated spam', by: 'Akosua Darko', at: '2 days ago' },
  { icon: 'MapPin', tone: 'violet', text: 'Site visit completed at Achimota Electrical', by: 'Field team', at: '3 days ago' },
];

/** Every TradeId has an entry in TRADES, so this lookup always succeeds. */
export function tradeById(id: TradeId): Trade;
export function tradeById(id: string): Trade | undefined;
export function tradeById(id: string) {
  return TRADES.find((t) => t.id === id);
}


// ---- Online learning & marketplace ----

export const SKILL_CATEGORIES: SkillCategory[] = [
  { id: 'fashion', name: 'Fashion & Tailoring', img: u('1687422808289-e721259c9eb4', 500), to: '/search?trade=tailoring' },
  { id: 'welding', name: 'Engineering & Welding', img: u('1504328345606-18bbc8c9d7d1', 500), to: '/search?trade=welding' },
  { id: 'beauty', name: 'Beauty & Personal Care', img: u('1757866332661-d82bb649dbb8', 500), to: '/search?trade=hair' },
  { id: 'carpentry', name: 'Carpentry & Furniture', img: u('1759523121247-76be6b3490b2', 500), to: '/search?trade=carpentry' },
  { id: 'catering', name: 'Catering & Food Production', img: u('1665332195309-9d75071138f0', 500), to: '/courses?cat=catering' },
  { id: 'electrical', name: 'Electrical Installation', img: u('1621905251189-08b45d6a269e', 500), to: '/search?trade=electrical' },
  { id: 'ict', name: 'ICT & Digital Skills', img: u('1758874573138-f3dd1ed25c7e', 500), to: '/courses?cat=ict' },
  { id: 'crafts', name: 'Arts, Crafts & Accessories', img: u('1781080922537-7d5338f96e95', 500), to: '/marketplace' },
];

/** Listings default their seller to a slug of `by`; centre-run listings set `sellerId` explicitly. */
const slug = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Builds a lesson list from [title, minutes] pairs, with ids scoped to the course. */
const lessons = (courseId: string, list: [string, number][]): Lesson[] =>
  list.map(([title, minutes], i) => ({ id: `${courseId}-l${i + 1}`, title, minutes }));

type CourseSeed = Omit<Course, 'sellerId' | 'status'> & { sellerId?: string; status?: Course['status'] };
type ProductSeed = Omit<Product, 'sellerId' | 'status'> & { sellerId?: string; status?: Product['status'] };

const course = (c: CourseSeed): Course => ({ ...c, sellerId: c.sellerId ?? slug(c.by), status: c.status ?? 'Published' });
const product = (p: ProductSeed): Product => ({ ...p, sellerId: p.sellerId ?? slug(p.by), status: p.status ?? 'Published' });


export const COURSES: Course[] = [
  course({ id: 'c1', title: 'Introduction to Graphic Design', by: 'Kofi Mensah', cat: 'ict', rating: 4.8, reviews: 120, price: 120, badge: 'Bestseller', level: 'Beginner', img: u('1626785774625-ddcddc3445e9', 700),
    description: 'Learn the design basics that small businesses pay for every day: logos, flyers, social media posts and price lists. You will work in free tools that run on any laptop, and finish with five pieces for your portfolio.',
    outcomes: ['Use colour, type and layout with confidence', 'Design a logo and simple brand kit', 'Create flyers and social posts in Canva and Photopea', 'Prepare files for printing in Accra print shops', 'Price your work and find your first clients'],
    curriculum: lessons('c1', [['What good design looks like', 12], ['Colour and contrast', 18], ['Choosing and pairing fonts', 16], ['Layout and white space', 20], ['Designing a logo', 28], ['Flyers that sell', 25], ['Social media templates', 22], ['Print-ready files', 15], ['Building your portfolio', 18], ['Pricing and finding clients', 20]]) }),
  course({ id: 'c2', title: 'Basic Tailoring Skills', by: 'Abena Serwaa', cat: 'fashion', rating: 4.6, reviews: 95, price: 0, badge: 'Free', level: 'Beginner', img: u('1687422809069-0fa3546b8471', 700),
    description: 'A free starter course for anyone thinking about tailoring. Learn to take measurements, thread and use a sewing machine, and sew your first simple garment — then decide if a full certificate programme is right for you.',
    outcomes: ['Take accurate body measurements', 'Set up and thread a sewing machine', 'Sew straight seams, hems and darts', 'Cut fabric from a simple pattern', 'Sew a basic skirt from start to finish'],
    curriculum: lessons('c2', [['Tools you need to start', 10], ['Taking measurements', 18], ['Threading the machine', 14], ['Straight seams and hems', 20], ['Darts and shaping', 16], ['Cutting from a pattern', 22], ['Sewing a simple skirt', 35], ['Next steps in tailoring', 8]]) }),
  course({ id: 'c3', title: 'Welding Fundamentals', by: 'Kwame Owusu', sellerId: 'accra-central-welding', cat: 'welding', rating: 4.7, reviews: 82, price: 150, badge: 'Bestseller', level: 'Beginner', img: u('1504917595217-d4dc5ebe6122', 700),
    description: 'Recorded at Accra Central Welding Works, this course covers the theory every welder needs before their first practical session: safety, machines, electrodes, joints and reading simple drawings. Ideal before joining a certificate programme.',
    outcomes: ['Work safely with PPE and in a workshop', 'Choose the right electrode and current', 'Understand butt, lap, tee and corner joints', 'Read basic fabrication drawings', 'Spot and fix common weld defects'],
    curriculum: lessons('c3', [['Workshop safety and PPE', 15], ['How arc welding works', 18], ['Welding machines and settings', 20], ['Choosing electrodes', 16], ['Striking and holding an arc', 22], ['Joint types explained', 25], ['Reading fabrication drawings', 24], ['Common defects and fixes', 20], ['Cutting and grinding safely', 18], ['Your first project: a steel stool', 32]]) }),
  course({ id: 'c4', title: 'Professional Hair Braiding', by: 'Efua Addo', cat: 'beauty', rating: 4.9, reviews: 140, price: 90, badge: 'New', level: 'Intermediate', img: u('1757866332992-723bf8d6169c', 700),
    description: 'Step-by-step video lessons on the braiding styles clients ask for most, from knotless braids to cornrows. Includes sectioning, scalp care and how to price and time each style for your salon.',
    outcomes: ['Section hair cleanly for any style', 'Braid knotless and box braids', 'Do neat cornrows and feed-ins', 'Care for the scalp and edges', 'Price styles by time and materials'],
    curriculum: lessons('c4', [['Tools and hair types', 12], ['Clean sectioning', 18], ['Box braids', 30], ['Knotless braids', 32], ['Cornrows', 28], ['Feed-in braids', 26], ['Scalp and edge care', 14], ['Timing and pricing styles', 15]]) }),
  course({ id: 'c5', title: 'Ghanaian Catering for Events', by: 'Auntie Ama Kitchen', cat: 'catering', rating: 4.7, reviews: 64, price: 110, level: 'Intermediate', img: u('1665332195309-9d75071138f0', 700),
    description: 'Cook for weddings, funerals and parties with confidence. Learn to scale recipes for 50–200 guests, plan your shopping, keep food safe and present jollof, waakye and grills the way clients expect.',
    outcomes: ['Scale recipes for large events', 'Plan shopping and costing per head', 'Cook party jollof and fried rice in bulk', 'Keep food safe for hours', 'Quote confidently for event jobs'],
    curriculum: lessons('c5', [['Planning an event menu', 18], ['Costing per head', 20], ['Party jollof for 100', 30], ['Fried rice and sides', 24], ['Grills and kebabs', 22], ['Food safety on the day', 16], ['Presentation and serving', 15], ['Writing a quote', 14]]) }),
  course({ id: 'c6', title: 'Domestic Wiring Basics', by: 'Yaw Boateng', cat: 'electrical', rating: 4.5, reviews: 51, price: 130, level: 'Beginner', img: u('1758101755915-462eddc23f57', 700),
    description: 'Understand how house wiring works in Ghana: circuits, sockets, lighting and the consumer unit. A theory course to prepare you for practical training and the Energy Commission exam.',
    outcomes: ['Explain circuits, current and voltage', 'Wire sockets and switches correctly', 'Read a simple wiring diagram', 'Size cables and breakers', 'Prepare for the Energy Commission exam'],
    curriculum: lessons('c6', [['Electrical safety first', 15], ['Current, voltage and power', 20], ['Circuits in a house', 22], ['Sockets and switches', 25], ['Lighting circuits', 22], ['The consumer unit', 18], ['Cable and breaker sizing', 20], ['Testing your work', 18], ['Exam preparation', 25]]) }),
  course({ id: 'c7', title: 'Furniture Making with Hand Tools', by: 'Kojo Asamoah', cat: 'carpentry', rating: 4.6, reviews: 38, price: 140, level: 'Intermediate', img: u('1779031242515-205111711b23', 700),
    description: 'Build solid furniture without expensive machines. Learn to choose local timber, measure and mark accurately, cut strong joints and finish pieces that customers will pay for.',
    outcomes: ['Choose and prepare local timber', 'Measure, mark and cut accurately', 'Cut mortise-and-tenon and dovetail joints', 'Assemble and glue up square', 'Sand and finish professionally'],
    curriculum: lessons('c7', [['Choosing timber', 16], ['Sharpening your tools', 20], ['Measuring and marking', 18], ['Sawing straight', 22], ['Mortise and tenon joints', 30], ['Dovetail joints', 32], ['Glue-up and clamping', 20], ['Sanding and finishing', 24], ['Project: a side table', 40]]) }),
  course({ id: 'c8', title: 'Computer Basics & Microsoft Office', by: 'Akua Nyarko', cat: 'ict', rating: 4.8, reviews: 210, price: 0, badge: 'Free', level: 'Beginner', img: u('1515378791036-0648a3ef77b2', 700),
    description: 'A free, friendly introduction to computers for complete beginners. Learn typing, files and folders, email, Word and Excel — the skills every job application and small business needs.',
    outcomes: ['Use a mouse, keyboard and files with confidence', 'Type and format documents in Word', 'Keep simple records in Excel', 'Send emails with attachments', 'Stay safe online'],
    curriculum: lessons('c8', [['Getting started with a computer', 12], ['Typing practice', 15], ['Files and folders', 14], ['Writing a CV in Word', 22], ['Simple records in Excel', 24], ['Email and attachments', 16], ['Staying safe online', 12]]) }),
];

export const PRODUCTS: Product[] = [
  product({ id: 'm1', title: 'Handmade Ankara Bag', by: 'Ama Crafts', cat: 'fashion', rating: 4.8, reviews: 45, price: 200, stock: 12, img: u('1660695828417-9cc2724bf656', 700),
    description: 'A roomy tote sewn from bold Ankara and kente-inspired print, fully lined with an inside zip pocket. Strong enough for market days, smart enough for the office. Each bag is cut by hand, so patterns vary slightly.' }),
  product({ id: 'm2', title: 'Natural Herbal Soap', by: 'FreshCare', cat: 'beauty', rating: 4.6, reviews: 38, price: 35, stock: 60, img: u('1781080922537-7d5338f96e95', 700),
    description: 'Cold-process soap made with shea butter, coconut oil and local herbs. Gentle on sensitive skin and free from harsh detergents. About 120 g per bar.' }),
  product({ id: 'm3', title: 'Beaded Necklace Set', by: 'Adjoa’s Creations', cat: 'crafts', rating: 4.7, reviews: 61, price: 80, stock: 9, img: u('1629481995102-ff98d306dd8a', 700),
    description: 'Three layered necklaces of recycled-glass and Krobo beads in red, yellow and green. Hand-strung on durable cord with an adjustable clasp.' }),
  product({ id: 'm4', title: 'Artisan Soap Gift Box', by: 'FreshCare', cat: 'beauty', rating: 4.9, reviews: 27, price: 120, stock: 15, img: u('1775210603565-37cc9269326f', 700),
    description: 'Four of our best-selling bars — shea, cocoa butter, moringa and lemongrass — in a reusable woven box. A thoughtful gift for birthdays and weddings.' }),
  product({ id: 'm5', title: 'Hand-carved Mancala Board', by: 'Kumasi Woodworks', cat: 'carpentry', rating: 4.8, reviews: 19, price: 260, stock: 4, img: u('1781728924412-165e03a6ab96', 700),
    description: 'An oware board carved from a single piece of hardwood and finished with natural oil. Comes with 48 seeds and a cloth bag.' }),
  product({ id: 'm6', title: 'Handcrafted Clay Pots (set of 3)', by: 'Vume Pottery', cat: 'crafts', rating: 4.5, reviews: 22, price: 150, stock: 7, img: u('1682668701024-b6508708a764', 700),
    description: 'Three nesting pots shaped by hand and fired in Vume, Volta Region. Ideal for plants, storage or display. Not food-safe.' }),
  product({ id: 'm7', title: 'Waist Beads Collection', by: 'Adjoa’s Creations', cat: 'crafts', rating: 4.7, reviews: 74, price: 60, stock: 25, img: u('1560847133-e6f64dc352ea', 700),
    description: 'A set of three strands of waist beads in mixed colours, strung on stretch cord so they fit comfortably. Made to order in your size.' }),
  product({ id: 'm8', title: 'Woven Market Basket', by: 'Bolga Weavers', cat: 'crafts', rating: 4.9, reviews: 53, price: 180, stock: 10, img: u('1776409933815-3497439f829a', 700),
    description: 'A classic Bolgatanga basket woven from elephant grass with a leather-wrapped handle. Sturdy, washable and made to last for years.' }),
  product({ id: 'm9', title: 'Metal Fabrication Starter Toolkit', by: 'Accra Central Welding Works', sellerId: 'accra-central-welding', cat: 'welding', rating: 4.8, reviews: 31, price: 340, stock: 6, img: u('1530124566582-a618bc2615dc', 700),
    description: 'Everything a new welding trainee needs for their first months: auto-darkening helmet, leather gloves, chipping hammer, wire brush, square and soapstone. Picked and checked by our instructors.' }),
];




// ---- Seed orders (from other buyers) so seller dashboards have data ----

const line = (id: string, qty = 1): CartItem => {
  const c = COURSES.find((x) => x.id === id);
  const p = PRODUCTS.find((x) => x.id === id);
  const item = c ?? p;
  if (!item) throw new Error(`Unknown listing ${id}`);
  return { id, kind: c ? 'course' : 'product', title: item.title, by: item.by, sellerId: item.sellerId, price: item.price, img: item.img, qty };
};
const contact = (name: string, phone: string, area = '', address = '', notes = ''): OrderContact => ({ name, phone, email: '', area, address, notes });
const sum = (items: CartItem[]) => items.reduce((s, i) => s + i.price * i.qty, 0);

const seed = (o: Omit<Order, 'subtotal' | 'total'> & { delivery: number }): Order => {
  const subtotal = sum(o.items);
  return { ...o, subtotal, total: subtotal + o.delivery };
};

export const SEED_ORDERS: Order[] = [
  seed({ id: 'FSH-A1K9QZ', placedAt: '2026-10-27T08:42:00', userId: 'buyer-ama', items: [line('m9')], delivery: 0, fulfilment: 'delivery',
    contact: contact('Ama Serwaa', '055 812 3344', 'Kaneshie', 'Near Kaneshie Market, Lane 4', 'Call when you reach the market gate'),
    payment: 'momo', momoNetwork: 'MTN', status: 'Paid', sellerStatus: { 'accra-central-welding': 'New' } }),
  seed({ id: 'FSH-B7M2XD', placedAt: '2026-10-26T15:10:00', userId: 'buyer-daniel', items: [line('m9', 2)], delivery: 0, fulfilment: 'pickup',
    contact: contact('Daniel Ofori', '026 441 9087'), payment: 'card', status: 'Paid', sellerStatus: { 'accra-central-welding': 'Confirmed' } }),
  seed({ id: 'FSH-C3P8LW', placedAt: '2026-10-25T19:05:00', userId: 'buyer-esi', items: [line('c3'), line('c2')], delivery: 0, fulfilment: null,
    contact: contact('Esi Mensah', '050 120 7781'), payment: 'momo', momoNetwork: 'Telecel', status: 'Paid',
    sellerStatus: { 'accra-central-welding': 'Completed', 'abena-serwaa': 'Completed' } }),
  seed({ id: 'FSH-D5R1TV', placedAt: '2026-10-24T11:30:00', userId: 'buyer-michael', items: [line('m9'), line('m2', 2)], delivery: 0, fulfilment: 'delivery',
    contact: contact('Michael Addo', '024 990 1123', 'Accra Central', 'Opposite Kantamanto Market, blue gate'), payment: 'cod', status: 'Awaiting payment',
    sellerStatus: { 'accra-central-welding': 'Out for delivery', freshcare: 'Confirmed' } }),
  seed({ id: 'FSH-F2W8KN', placedAt: '2026-10-23T17:20:00', userId: 'buyer-yaw', items: [line('m1'), line('m7', 2)], delivery: 0, fulfilment: 'delivery',
    contact: contact('Yaw Darko', '024 771 2290', 'Adenta', 'SSNIT Flats, Block C'), payment: 'cod', status: 'Awaiting payment',
    sellerStatus: { 'ama-crafts': 'New', 'adjoas-creations': 'Confirmed' } }),
  seed({ id: 'FSH-G1H3JK', placedAt: '2026-10-15T19:40:00', userId: 'u1', items: [line('c8')], delivery: 0, fulfilment: null,
    contact: contact('Kwame Mensah', '024 123 4567'), payment: 'free', status: 'Paid', sellerStatus: { 'akua-nyarko': 'Completed' } }),
  seed({ id: 'FSH-E9T4HU', placedAt: '2026-10-20T09:15:00', userId: 'buyer-kofi', items: [line('c3')], delivery: 0, fulfilment: null,
    contact: contact('Kofi Asante', '024 300 5512'), payment: 'card', status: 'Paid', sellerStatus: { 'accra-central-welding': 'Completed' } }),
];
