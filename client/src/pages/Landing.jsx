import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { cardReveal, fadeUp, viewportOnce } from '../animations/variants.js';

const iconPaths = {
  report: 'M4 4h16v16H4z M8 8h8M8 12h8M8 16h5', track: 'M4 12h4l3 6 5-12 2 6h2', connect: 'M7 17 3 13l4-4 M17 7l4 4-4 4 M14 4l-4 16', respond: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2', shield: 'M12 3 4 6v5c0 5 3.3 8.5 8 10 4.7-1.5 8-5 8-10V6l-8-3Zm-3 9 2 2 4-4', map: 'M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Zm0-15v15m6-12v15', bolt: 'm13 2-9 12h7l-1 8 10-13h-7z', building: 'M4 21V5l8-3 8 3v16M8 9h.01M8 13h.01M12 9h.01M12 13h.01M16 9h.01M16 13h.01M2 21h20', user: 'M20 21a8 8 0 0 0-16 0 M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8', lock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4', check: 'm5 12 4 4L19 6', arrow: 'M5 12h14m-6-6 6 6-6 6', menu: 'M4 7h16M4 12h16M4 17h16', close: 'M6 6l12 12M18 6 6 18', alert: 'M12 3 2 21h20L12 3Zm0 6v4m0 4h.01', dots: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 6v4l3 2'
};
function Icon({ name, className = '' }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 ${className}`} aria-hidden="true">
<path d={iconPaths[name]} />
</svg>; }
const SectionTitle = ({ eyebrow, title, copy, center = false }) => <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewportOnce} className={`max-w-3xl ${center ? 'mx-auto text-center' : ''}`}>
<p className="text-xs font-bold tracking-[0.18em] text-civic-600">{eyebrow}</p>
<h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h2>{copy && <p className="mt-4 text-base leading-7 text-slate-600">{copy}</p>}</motion.div>;
const Primary = ({ to, children, className = '' }) => <Link to={to} className={`interactive inline-flex items-center justify-center gap-2 rounded-lg bg-civic-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-civic-500 focus:outline-none focus:ring-2 focus:ring-civic-500 focus:ring-offset-2 ${className}`}>{children}<Icon name="arrow" className="h-4 w-4" />
</Link>;
const Outline = ({ href, children }) => <a href={href} className={`interactive inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-civic-600 hover:text-civic-600 focus:outline-none focus:ring-2 focus:ring-civic-500`}>{children}</a>;

function AnimatedCard({ children, className, index = 0, hover = true }) { return <motion.article variants={cardReveal} custom={index} initial="hidden" whileInView="visible" viewport={viewportOnce} whileHover={hover ? { y: -4, scale: 1.01 } : undefined} transition={{ duration: 0.22, ease: 'easeOut' }} className={className}>{children}</motion.article>; }

const trust = [['report', 'Centralized Civic Reporting'], ['track', 'Real-Time Tracking'], ['shield', 'Transparent Governance'], ['respond', 'Emergency Response']];
const solution = [['report', 'Report', 'Submit damaged roads, broken lights, water leaks, waste, drainage issues, and more.'], ['track', 'Track', 'See each milestone from submission through action and resolution.'], ['connect', 'Connect', 'Reach the responsible government department through one trusted channel.'], ['respond', 'Respond', 'Request urgent assistance and share critical details when every second counts.']];
const civicFeatures = [['lock', 'Secure Authentication', 'Safeguarded access to citizen services.'], ['map', 'GPS-Based Reporting', 'Pin an issue precisely where it happens.'], ['report', 'Image & Video Upload', 'Add visual evidence to strengthen reports.'], ['dots', 'AI-Assisted Classification', 'Get intelligent category suggestions.'], ['connect', 'Duplicate Detection', 'Bring related reports into view.'], ['map', 'Interactive City Map', 'Understand issues across your city.'], ['track', 'Complaint Tracking', 'Follow progress in one clear timeline.'], ['check', 'Before & After Verification', 'See documented completion evidence.'], ['user', 'Community Verification', 'Build trust through collective feedback.'], ['shield', 'Service Rating', 'Help improve public service quality.']];
const departments = ['Road & Highway', 'Waste Management', 'Drainage', 'Water Supply', 'Street Lighting', 'Parks & Environment', 'Public Health', 'Police', 'Fire Service & Civil Defence', 'Ambulance', 'Disaster Management'];

function HeroVisual() { return <div className="hero-visual relative mx-auto w-full max-w-xl py-6 lg:py-0" aria-label="Illustration of a connected civic service network">
<div className="absolute inset-7 rounded-full border border-civic-500/20 bg-civic-50/50" />
<div className="hero-marker absolute left-[16%] top-[20%] h-1.5 w-1.5 rounded-full bg-civic-500 shadow-[0_0_0_7px_rgba(8,140,124,.12)]" />
<div className="absolute bottom-[18%] right-[14%] h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_0_8px_rgba(245,158,11,.15)]" />
<div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-300/50">
<div className="flex items-center justify-between border-b border-slate-100 pb-3">
<div className="flex items-center gap-2">
<span className="grid h-8 w-8 place-items-center rounded-lg bg-civic-50 text-civic-600">
<Icon name="building" className="h-4 w-4" />
</span>
<div>
<p className="text-xs font-bold text-ink">CivicSync Overview</p>
<p className="text-[10px] text-slate-400">Live civic service network</p>
</div>
</div>
<span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">SYSTEM ONLINE</span>
</div>
<div className="relative mt-4 h-64 overflow-hidden rounded-xl bg-slate-900 p-4">
<div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.15)_1px,transparent_1px)] [background-size:34px_34px]" />
<svg viewBox="0 0 400 250" className="absolute inset-0 h-full w-full" aria-hidden="true">
<path d="M45 190C105 130 100 74 185 80s76 80 165 26" stroke="#42b6aa" strokeWidth="2" strokeDasharray="5 7" fill="none"/>
<path d="M48 74C110 110 150 190 232 157s61-92 117-105" stroke="#f5b942" strokeWidth="1.5" strokeDasharray="4 7" fill="none"/>
<circle cx="49" cy="190" r="8" fill="#0b9383"/>
<circle cx="185" cy="80" r="8" fill="#0b9383"/>
<circle cx="350" cy="106" r="8" fill="#f5b942"/>
</svg>
<div className="absolute left-5 top-5 rounded-lg border border-white/10 bg-slate-800/95 p-2.5 text-white shadow-lg">
<p className="text-[10px] text-slate-400">NEW REPORT</p>
<p className="mt-1 text-xs font-bold">Broken street light</p>
<p className="mt-1 text-[10px] text-emerald-300">Assigned · Ward 17</p>
</div>
<div className="absolute bottom-4 right-4 rounded-lg bg-white p-2.5 shadow-lg">
<p className="text-[10px] font-bold text-slate-400">RESPONSE STATUS</p>
<p className="mt-1 text-xs font-bold text-ink">Team en route</p>
</div>
</div>
<div className="mt-4 grid grid-cols-3 gap-2">
<div className="rounded-lg bg-slate-50 p-2.5">
<p className="text-sm font-bold text-ink">Reports</p>
<p className="text-[10px] text-slate-500">Centralized tracking</p>
</div>
<div className="rounded-lg bg-slate-50 p-2.5">
<p className="text-sm font-bold text-ink">Progress</p>
<p className="text-[10px] text-slate-500">Clear milestones</p>
</div>
<div className="rounded-lg bg-slate-50 p-2.5">
<p className="text-sm font-bold text-ink">Response</p>
<p className="text-[10px] text-slate-500">Coordinated teams</p>
</div>
</div>
</div>
</div> }

function Navbar() { const [open, setOpen] = useState(false); const [compact, setCompact] = useState(false); const sentinel = useRef(null); const links = [['Home', '#home'], ['How It Works', '#how-it-works'], ['Features', '#features'], ['Emergency', '#emergency'], ['For Government', '#government'], ['About', '#about']]; useEffect(() => { const observer = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting)); observer.observe(sentinel.current); return () => observer.disconnect(); }, []); return <><div ref={sentinel} className="h-px" aria-hidden="true" /><motion.header initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }} className={`sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur transition-shadow ${compact ? 'shadow-md shadow-slate-900/8' : ''}`}>
<nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5" aria-label="Main navigation">
<a href="#home" className="flex items-center gap-2">
<span className="grid h-9 w-9 place-items-center rounded-lg bg-civic-600 text-white">
<Icon name="building" />
</span>
<span className="text-lg font-extrabold tracking-tight text-ink">Civic<span className="text-civic-600">Sync</span>
</span>
</a>
<div className="hidden items-center gap-6 lg:flex">{links.map(([label, href]) => <a key={href} href={href} className="text-sm font-semibold text-slate-600 transition hover:text-civic-600">{label}</a>)}</div>
<div className="hidden items-center gap-3 sm:flex">
<Link to="/login" className="px-2 py-2 text-sm font-bold text-slate-700 hover:text-civic-600">Login</Link>
<Primary to="/register" className="px-4 py-2.5">Get Started</Primary>
</div>
<button className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-700 sm:hidden" onClick={() => setOpen(!open)} aria-label="Toggle navigation" aria-expanded={open}>
<Icon name={open ? 'close' : 'menu'} />
</button>
</nav>{open && <div className="border-t border-slate-100 bg-white px-5 pb-5 sm:hidden">{links.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)} className="block border-b border-slate-100 py-3 text-sm font-bold text-slate-700">{label}</a>)}<div className="mt-4 grid grid-cols-2 gap-3">
<Link to="/login" className="rounded-lg border border-slate-300 py-2.5 text-center text-sm font-bold">Login</Link>
<Primary to="/register" className="px-2 py-2.5">Get Started</Primary>
</div>
</div>}</motion.header></> }

export default function Landing() { return <MotionConfig reducedMotion="user"><div id="home" className="overflow-x-clip bg-white">
<Navbar />
<main>
<section className="relative overflow-hidden bg-linear-to-b from-civic-50 via-white to-white">
<div className="pointer-events-none absolute left-1/2 top-0 h-100 w-180 -translate-x-1/2 rounded-full bg-civic-100/60 blur-3xl" />
<div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 py-18 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
<div className="hero-content">
<div className="hero-kicker inline-flex items-center gap-2 rounded-full border border-civic-100 bg-white px-3 py-1.5 text-xs font-bold text-civic-600 shadow-sm">
<span className="h-1.5 w-1.5 rounded-full bg-civic-500" />SMART CITIZEN SERVICE PLATFORM</div>
<h1 className="hero-title mt-6 max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">Empowering Citizens.<br />
<span className="text-civic-600">Strengthening Governance.</span>
<br />Building Smarter Communities.</h1>
<p className="hero-description mt-6 max-w-2xl text-lg leading-8 text-slate-600">CivicSync connects citizens with government departments, making civic reporting, emergency assistance, and service tracking faster, simpler, and more transparent.</p>
<div className="hero-actions mt-8 flex flex-wrap gap-3">
<Primary to="/dashboard">Report an Issue</Primary>
<Outline href="#features">Explore CivicSync</Outline>
<a href="#emergency" className="inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-50">
<Icon name="alert" className="h-5 w-5" />Emergency SOS</a>
</div>
<div className="mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">{trust.map(([icon, text]) => <div key={text} className="flex items-center gap-2 text-xs font-semibold text-slate-600">
<span className="text-civic-600">
<Icon name={icon} className="h-4 w-4" />
</span>{text}</div>)}</div>
</div>
<HeroVisual />
</div>
</section>

<section id="about" className="border-y border-slate-100 bg-slate-50">
<div className="mx-auto max-w-7xl px-5 py-20">
<div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
<SectionTitle eyebrow="THE CHALLENGE" title="Civic Problems Shouldn't Get Lost in the Noise." copy="When reports are scattered across calls, Facebook pages, Messenger, emails, and office visits, people lose visibility and departments lose valuable time." />
<div className="grid gap-5 sm:grid-cols-2">
<div className="rounded-2xl border border-slate-200 bg-white p-6">
<p className="text-xs font-bold tracking-[.15em] text-slate-400">TRADITIONAL WAY</p>
<div className="mt-5 space-y-3 text-sm font-semibold text-slate-600">
<p>Citizen</p>
<span className="block text-slate-300">↓</span>
<p>Phone / Facebook / Email</p>
<span className="block text-slate-300">↓</span>
<p>Different Offices</p>
<span className="block text-slate-300">↓</span>
<p className="text-red-600">Unclear Status</p>
</div>
</div>
<div className="rounded-2xl bg-ink p-6 text-white">
<p className="text-xs font-bold tracking-[.15em] text-civic-50">WITH CIVICSYNC</p>
<div className="mt-5 space-y-3 text-sm font-semibold">
<p>Citizen</p>
<span className="block text-civic-300">↓</span>
<p>CivicSync</p>
<span className="block text-civic-300">↓</span>
<p>Responsible Department</p>
<span className="block text-civic-300">↓</span>
<p className="text-emerald-300">Trackable Progress → Resolution</p>
</div>
</div>
</div>
</div>
</div>
</section>

<section className="mx-auto max-w-7xl px-5 py-20">
<SectionTitle eyebrow="THE SOLUTION" title="One Platform. Every Civic Service." copy="A centralized smart government platform for reporting issues, monitoring action, receiving updates, verifying completed work, and requesting emergency assistance." center />
<div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{solution.map(([icon, title, copy], index) => <AnimatedCard key={title} index={index} className="group rounded-2xl border border-slate-200 p-6 transition hover:border-civic-200 hover:shadow-lg hover:shadow-civic-100">
<span className="grid h-11 w-11 place-items-center rounded-xl bg-civic-50 text-civic-600 transition group-hover:bg-civic-600 group-hover:text-white">
<Icon name={icon} />
</span>
<h3 className="mt-5 text-lg font-bold text-ink">{title}</h3>
<p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
</AnimatedCard>)}</div>
</section>

<section id="how-it-works" className="bg-ink py-20 text-white">
<div className="mx-auto max-w-7xl px-5">
<SectionTitle eyebrow="HOW IT WORKS" title="From Report to Resolution" copy="A clearer path for citizens and the people serving them." center />
<div className="mt-14 grid gap-8 md:grid-cols-4">{[['01', 'Report', 'Citizen submits a civic issue.'], ['02', 'Analyze', 'The system categorizes the complaint and assists with prioritization.'], ['03', 'Resolve', 'The responsible department assigns officers and field workers.'], ['04', 'Verify', 'Work is completed, verified, and the citizen can provide feedback.']].map(([number, title, copy], index) => <motion.div key={number} variants={cardReveal} custom={index} initial="hidden" whileInView="visible" viewport={viewportOnce} className="relative border-l border-civic-400/40 pl-5 md:border-l-0 md:border-t md:pl-0 md:pt-6">
<span className="absolute -left-2 top-0 h-4 w-4 rounded-full bg-civic-500 md:-top-2 md:left-0" />
<p className="text-3xl font-extrabold text-civic-300">{number}</p>
<h3 className="mt-3 text-lg font-bold">{title}</h3>
<p className="mt-2 text-sm leading-6 text-slate-300">{copy}</p>{index < 3 && <span className="absolute right-0 top-[-9px] hidden text-civic-300 md:block">→</span>}</motion.div>)}</div>
</div>
</section>

<section id="features" className="mx-auto max-w-7xl px-5 py-20">
<SectionTitle eyebrow="CIVIC SERVICE FEATURES" title="Everything Citizens Need to Make Their City Better" copy="Useful technology, designed around practical public service." center />
<div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{civicFeatures.map(([icon, title, copy], index) => <AnimatedCard key={title} index={index} className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-civic-300 hover:shadow-md">
<Icon name={icon} className="h-5 w-5 text-civic-600" />
<h3 className="mt-4 text-sm font-bold text-ink">{title}</h3>
<p className="mt-2 text-xs leading-5 text-slate-500">{copy}</p>
</AnimatedCard>)}</div>
</section>

<section id="emergency" className="bg-red-50">
<div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
<div>
<SectionTitle eyebrow="EMERGENCY RESPONSE" title="When Every Second Matters." copy="CivicSync provides a centralized emergency response experience that helps citizens quickly request assistance and share their location with responsible services." />
<div className="mt-7 grid gap-3 sm:grid-cols-2">{[['bolt','One-Tap SOS'],['map','Live Location'],['building','Nearby Services'],['track','Emergency Tracking']].map(([icon,label]) => <div key={label} className="flex items-center gap-3 rounded-lg bg-white p-3 text-sm font-bold text-slate-700">
<span className="text-red-600">
<Icon name={icon}/>
</span>{label}</div>)}</div>
<a href="#government" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-red-700 hover:underline">Explore Emergency Response <Icon name="arrow" className="h-4 w-4" />
</a>
</div>
<div className="rounded-2xl bg-slate-950 p-5 shadow-xl">
<div className="rounded-xl border border-white/10 bg-slate-900 p-5">
<div className="flex items-center justify-between">
<div>
<p className="text-xs font-bold tracking-[.14em] text-red-300">EMERGENCY ASSISTANCE</p>
<p className="mt-1 font-bold text-white">Immediate response request</p>
</div>
<span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
</div>
<div className="mt-6 grid place-items-center">
<button className="sos-pulse grid h-31 w-31 place-items-center rounded-full border-8 border-red-400/20 bg-red-600 text-center text-lg font-extrabold text-white shadow-[0_0_0_14px_rgba(239,68,68,.12)]">SOS<br />
<span className="text-[10px] font-medium">TAP TO REQUEST</span>
</button>
</div>
<div className="mt-8 grid grid-cols-4 gap-1 text-center text-[10px] font-bold text-slate-400">
<span className="text-red-300">SOS sent</span>
<span>Location shared</span>
<span>Department</span>
<span>Rescue complete</span>
</div>
<div className="mt-2 h-1 rounded-full bg-slate-700">
<div className="h-1 w-1/4 rounded-full bg-red-500" />
</div>
</div>
</div>
</div>
</section>

<section id="government" className="mx-auto max-w-7xl px-5 py-20">
<SectionTitle eyebrow="FOR GOVERNMENT" title="Better Tools for Better Public Service" copy="Dedicated dashboards help departments manage, monitor, assign, and resolve civic issues efficiently." center />
<div className="mt-12 grid gap-5 lg:grid-cols-3">{[['Department Head',['Review complaints','Verify authenticity','Set priority','Assign officers','Monitor progress']],['Department Officer',['Receive assigned complaints','Inspect issues','Coordinate operations','Update status','Submit completion reports']],['Administrator',['Manage users','Manage departments','Manage roles','Monitor system','View analytics']]].map(([title, items], index) => <AnimatedCard key={title} index={index} className={`rounded-2xl border p-6 ${index === 1 ? 'border-civic-300 bg-civic-50' : 'border-slate-200 bg-white'}`}>
<span className="text-xs font-bold tracking-[.15em] text-civic-600">PORTAL {index + 1}</span>
<h3 className="mt-3 text-xl font-bold text-ink">{title}</h3>
<ul className="mt-5 space-y-3">{items.map(item => <li key={item} className="flex gap-2 text-sm text-slate-600">
<Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-civic-600" />{item}</li>)}</ul>
</AnimatedCard>)}</div>
<div className="mt-8 text-center">
<Link to="/dashboard" className="text-sm font-bold text-civic-600 hover:underline">Explore Government Portal →</Link>
</div>
</section>

<section className="border-y border-slate-100 bg-slate-50">
<div className="mx-auto max-w-7xl px-5 py-20">
<SectionTitle eyebrow="CONNECTED DEPARTMENTS" title="One Platform Across Multiple Departments" center />
<div className="mt-10 flex flex-wrap justify-center gap-3">{departments.map((item, index) => <span key={item} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">
<Icon name={index > 6 ? 'respond' : 'building'} className="h-4 w-4 text-civic-600" />{item}</span>)}</div>
</div>
</section>

<section className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
<SectionTitle eyebrow="REAL-TIME TRANSPARENCY" title="Know What's Happening With Your Report" copy="Every major update is visible in a clear, accountable progress timeline." />
<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-100">
<div className="flex items-start justify-between">
<div>
<p className="text-xs font-bold tracking-[.14em] text-slate-400">COMPLAINT #CS-1042</p>
<h3 className="mt-2 text-xl font-bold text-ink">Broken Street Light</h3>
<p className="mt-1 text-sm text-slate-500">Street Lighting · Ward 17</p>
</div>
<span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">In Progress</span>
</div>
<div className="mt-8 space-y-0">{[['Pending','Submitted','done'],['Verified','Verified by department','done'],['Assigned','Team assigned','done'],['In Progress','Work in progress','active'],['Under Review','Quality review',''],['Completed','Citizen notified',''],['Closed','Citizen verification','']].map(([name, detail, state], index) => <motion.div key={name} variants={cardReveal} custom={index} initial="hidden" whileInView="visible" viewport={viewportOnce} className="flex gap-4">
<div className="flex flex-col items-center">
<span className={`grid h-6 w-6 place-items-center rounded-full border text-xs ${state === 'done' ? 'border-civic-600 bg-civic-600 text-white' : state === 'active' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-300'}`}>{state === 'done' ? '✓' : state === 'active' ? '●' : '○'}</span>{index < 6 && <span className={`h-7 w-px ${state === 'done' ? 'bg-civic-300' : 'bg-slate-200'}`} />}</div>
<div className="pb-4">
<p className={`text-sm font-bold ${state ? 'text-ink' : 'text-slate-400'}`}>{name}</p>
<p className="text-xs text-slate-500">{detail}</p>
</div>
</motion.div>)}</div>
</div>
</section>

<section className="bg-civic-50">
<div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-2">
<div>
<SectionTitle eyebrow="SMART TECHNOLOGY" title="Intelligence That Supports Better Decisions" copy="CivicSync can assist teams with complaint classification, duplicate detection, priority suggestions, emergency detection, and complaint summarization." />
<p className="mt-6 rounded-lg border-l-4 border-civic-600 bg-white p-4 text-sm leading-6 text-slate-600">
<strong className="text-ink">AI provides intelligent suggestions only.</strong> Final decisions are always made by authorized government officials.</p>
</div>
<div className="grid gap-3 sm:grid-cols-2">{['Complaint Classification','Duplicate Detection','Priority Suggestion','Emergency Detection','Complaint Summarization'].map((item, index) => <div key={item} className={`rounded-xl border border-civic-100 bg-white p-4 text-sm font-bold text-ink ${index === 4 ? 'sm:col-span-2' : ''}`}>
<span className="mr-2 inline-block text-civic-600">0{index + 1}</span>{item}</div>)}</div>
</div>
</section>

<section className="bg-slate-50">
<div className="mx-auto max-w-7xl px-5 py-20">
<SectionTitle eyebrow="OUR IMPACT" title="A More Responsive City Starts With a Better Connection." center />
<div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{['Faster Response','Greater Transparency','Better Communication','Accountable Services','Smarter Communities','Connected Government'].map((item, index) => <motion.div key={item} variants={cardReveal} custom={index} initial="hidden" whileInView="visible" viewport={viewportOnce} className="rounded-xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
<p className="text-3xl font-extrabold text-civic-600">0{index + 1}</p>
<p className="mt-2 font-bold text-ink">{item}</p>
</motion.div>)}</div>
<div className="mt-12 flex flex-wrap items-center justify-center gap-3 text-center text-sm font-bold text-slate-600">
<span>Citizen</span>
<Icon name="arrow" className="text-civic-600" />
<span className="rounded-full bg-civic-600 px-4 py-2 text-white">CivicSync</span>
<Icon name="arrow" className="text-civic-600" />
<span>Government</span>
<Icon name="arrow" className="text-civic-600" />
<span>Resolution</span>
</div>
</div>
</section>

<section className="mx-auto max-w-5xl px-5 py-20 text-center">
<p className="text-xs font-bold tracking-[.18em] text-civic-600">READY TO PARTICIPATE?</p>
<h2 className="mt-3 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">Your City. Your Voice. Your CivicSync.</h2>
<p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">Report problems, request assistance, track progress, and help build a smarter and more responsive community.</p>
<div className="mt-8 flex flex-wrap justify-center gap-3">
<Primary to="/register">Get Started</Primary>
<Primary to="/dashboard" className="bg-ink hover:bg-slate-700">Report an Issue</Primary>
<Outline href="#home">Explore the Platform</Outline>
</div>
</section>
</main>
<motion.footer variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewportOnce} className="bg-ink text-slate-300">
<div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
<div>
<div className="flex items-center gap-2 text-white">
<span className="grid h-8 w-8 place-items-center rounded-lg bg-civic-600">
<Icon name="building" className="h-4 w-4" />
</span>
<span className="text-lg font-extrabold">CivicSync</span>
</div>
<p className="mt-4 text-sm leading-6">Empowering Citizens Through Smart Digital Governance.</p>
</div>{[['Platform',['Civic Reporting','Emergency Response','Complaint Tracking','Government Portal']],['Resources',['How It Works','Features','About','Contact']],['Account',['Login','Register']]].map(([title, items]) => <div key={title}>
<h3 className="text-sm font-bold text-white">{title}</h3>
<ul className="mt-4 space-y-3 text-sm">{items.map(item => <li key={item}>
<a href={item === 'Login' ? '/login' : item === 'Register' ? '/register' : '#home'} className="hover:text-white">{item}</a>
</li>)}</ul>
</div>)}</div>
<div className="border-t border-white/10">
<div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
<span>© 2026 CivicSync. All rights reserved.</span>
<span>Developed by Dark Coders · Software Engineering Laboratory — United International University (UIU)</span>
</div>
</div>
</motion.footer>
</div></MotionConfig> }
