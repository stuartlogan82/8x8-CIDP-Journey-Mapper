import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  PhoneCall, Terminal, Clock, Mic, PauseCircle,
  CornerDownRight, ArrowLeftRight, CheckCircle2,
  Activity, User, GitBranch, FlaskConical, Sun, Moon,
  Play, Pause,
} from 'lucide-react';
import { searchJourneys, searchTransitions } from './api';
import { fetchRecordings, getRecordingUrl } from './cssApi';

// ─── Demo data ────────────────────────────────────────────────────────────────
const D = '2026-03-23T';
const DEMO_JOURNEYS = [
  {
    journeyId: 'jrn-001',
    time: `${D}09:12:00Z`,
    outcome: 'HANDLED',
    direction: 'INBOUND',
    contact: { name: 'Sarah Johnson', phoneNumber: '+1 415 555 0102' },
    agents: [{ name: 'Emily Carter' }],
    entryPoint: { name: 'Main Support Line', phoneNumber: '+1 800 555 0100', type: 'DID' },
    queues: [{ name: 'General Support' }],
    transfersCompleted: 0,
    holdDuration: 45000,
    wrapUpCodes: ['resolved'],
    mediaTypes: ['VOICE'],
  },
  {
    journeyId: 'jrn-002',
    time: `${D}09:47:30Z`,
    outcome: 'HANDLED',
    direction: 'INBOUND',
    contact: { name: 'Marcus Webb', phoneNumber: '+1 312 555 0178' },
    agents: [{ name: 'Daniel Park' }, { name: 'Aisha Okonkwo' }],
    entryPoint: { name: 'Sales Line', phoneNumber: '+1 800 555 0200', type: 'DID' },
    queues: [{ name: 'Sales' }, { name: 'Senior Sales' }],
    transfersCompleted: 1,
    holdDuration: 120000,
    wrapUpCodes: ['sale-completed'],
    mediaTypes: ['VOICE'],
  },
  {
    journeyId: 'jrn-003',
    time: `${D}10:05:15Z`,
    outcome: 'ABANDONED',
    direction: 'INBOUND',
    contact: { name: 'Priya Patel', phoneNumber: '+1 213 555 0343' },
    agents: [],
    entryPoint: { name: 'Main Support Line', phoneNumber: '+1 800 555 0100', type: 'DID' },
    queues: [{ name: 'General Support' }],
    transfersCompleted: 0,
    holdDuration: 0,
    wrapUpCodes: [],
    mediaTypes: ['VOICE'],
  },
  {
    journeyId: 'jrn-004',
    time: `${D}10:31:00Z`,
    outcome: 'ENDED_IN_SCRIPT',
    direction: 'INBOUND',
    contact: { phoneNumber: '+44 20 7946 0871' },
    agents: [],
    entryPoint: { name: 'IVR Self-Service', phoneNumber: '+44 800 555 0300', type: 'DID' },
    queues: [],
    transfersCompleted: 0,
    holdDuration: 0,
    wrapUpCodes: [],
    mediaTypes: ['VOICE'],
  },
  {
    journeyId: 'jrn-005',
    time: `${D}11:03:45Z`,
    outcome: 'HANDLED',
    direction: 'OUTBOUND',
    contact: { name: 'James Thornton', phoneNumber: '+1 646 555 0219' },
    agents: [{ name: 'Emily Carter' }],
    entryPoint: { name: 'Outbound Campaign', phoneNumber: '+1 800 555 0400', type: 'DID' },
    queues: [{ name: 'Callbacks' }],
    transfersCompleted: 0,
    holdDuration: 0,
    wrapUpCodes: ['callback-complete', 'follow-up-required'],
    mediaTypes: ['VOICE'],
  },
  {
    journeyId: 'jrn-006',
    time: `${D}11:28:10Z`,
    outcome: 'HANDLED',
    direction: 'INBOUND',
    contact: { name: 'Liu Wei', email: 'liu.wei@example.com' },
    agents: [{ name: 'Daniel Park' }],
    entryPoint: { name: 'Chat Widget', type: 'WEB_CHAT' },
    queues: [{ name: 'Digital Support' }],
    transfersCompleted: 0,
    holdDuration: 0,
    wrapUpCodes: ['resolved'],
    mediaTypes: ['CHAT'],
  },
];

function ts(base, offsetSec) {
  return new Date(new Date(base).getTime() + offsetSec * 1000).toISOString();
}

const DEMO_TRANSITIONS = {
  'jrn-001': [
    { name: 'STARTED',   time: `${D}09:12:00Z`, duration: 8000,   agents: [], queue: null, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'IN_SCRIPT', time: ts(`${D}09:12:08Z`, 0), duration: 22000,  agents: [], queue: null, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'WAITING',   time: ts(`${D}09:12:08Z`, 22), duration: 95000,  agents: [], queue: { name: 'General Support' }, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'TALKING',   time: ts(`${D}09:12:08Z`, 117), duration: 183000, agents: [{ name: 'Emily Carter' }], queue: { name: 'General Support' }, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'HOLD',      time: ts(`${D}09:12:08Z`, 300), duration: 45000,  agents: [{ name: 'Emily Carter' }], queue: { name: 'General Support' }, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'TALKING',   time: ts(`${D}09:12:08Z`, 345), duration: 210000, agents: [{ name: 'Emily Carter' }], queue: { name: 'General Support' }, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'FINISHED',  time: ts(`${D}09:12:08Z`, 555), duration: null,   agents: [{ name: 'Emily Carter' }], queue: null, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
  ],
  'jrn-002': [
    { name: 'STARTED',   time: `${D}09:47:30Z`, duration: 6000,   agents: [], queue: null, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'IN_SCRIPT', time: ts(`${D}09:47:30Z`, 6), duration: 18000,  agents: [], queue: null, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'WAITING',   time: ts(`${D}09:47:30Z`, 24), duration: 67000,  agents: [], queue: { name: 'Sales' }, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'TALKING',   time: ts(`${D}09:47:30Z`, 91), duration: 142000, agents: [{ name: 'Daniel Park' }], queue: { name: 'Sales' }, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'HOLD',      time: ts(`${D}09:47:30Z`, 233), duration: 120000, agents: [{ name: 'Daniel Park' }], queue: null, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'TRANSFER',  time: ts(`${D}09:47:30Z`, 353), duration: 8000,   agents: [{ name: 'Daniel Park' }], queue: null, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'WAITING',   time: ts(`${D}09:47:30Z`, 361), duration: 31000,  agents: [], queue: { name: 'Senior Sales' }, mediaType: 'VOICE', previousAgents: [{ name: 'Daniel Park' }], previousQueue: { name: 'Sales' } },
    { name: 'TALKING',   time: ts(`${D}09:47:30Z`, 392), duration: 384000, agents: [{ name: 'Aisha Okonkwo' }], queue: { name: 'Senior Sales' }, mediaType: 'VOICE', previousAgents: [{ name: 'Daniel Park' }], previousQueue: { name: 'Sales' } },
    { name: 'FINISHED',  time: ts(`${D}09:47:30Z`, 776), duration: null,   agents: [{ name: 'Aisha Okonkwo' }], queue: null, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
  ],
  'jrn-003': [
    { name: 'STARTED',   time: `${D}10:05:15Z`, duration: 5000,   agents: [], queue: null, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'IN_SCRIPT', time: ts(`${D}10:05:15Z`, 5), duration: 20000,  agents: [], queue: null, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'WAITING',   time: ts(`${D}10:05:15Z`, 25), duration: 193000, agents: [], queue: { name: 'General Support' }, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'FINISHED',  time: ts(`${D}10:05:15Z`, 218), duration: null,  agents: [], queue: null, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
  ],
  'jrn-004': [
    { name: 'STARTED',   time: `${D}10:31:00Z`, duration: 4000,  agents: [], queue: null, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'IN_SCRIPT', time: ts(`${D}10:31:00Z`, 4), duration: 76000, agents: [], queue: null, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'FINISHED',  time: ts(`${D}10:31:00Z`, 80), duration: null, agents: [], queue: null, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
  ],
  'jrn-005': [
    { name: 'STARTED',   time: `${D}11:03:45Z`, duration: 3000,   agents: [], queue: null, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'FORWARD',   time: ts(`${D}11:03:45Z`, 3), duration: 9000,  agents: [], queue: null, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'TALKING',   time: ts(`${D}11:03:45Z`, 12), duration: 520000, agents: [{ name: 'Emily Carter' }], queue: { name: 'Callbacks' }, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
    { name: 'FINISHED',  time: ts(`${D}11:03:45Z`, 532), duration: null, agents: [{ name: 'Emily Carter' }], queue: null, mediaType: 'VOICE', previousAgents: [], previousQueue: null },
  ],
  'jrn-006': [
    { name: 'STARTED',   time: `${D}11:28:10Z`, duration: 2000,   agents: [], queue: null, mediaType: 'CHAT', previousAgents: [], previousQueue: null },
    { name: 'WAITING',   time: ts(`${D}11:28:10Z`, 2), duration: 44000,  agents: [], queue: { name: 'Digital Support' }, mediaType: 'CHAT', previousAgents: [], previousQueue: null },
    { name: 'TALKING',   time: ts(`${D}11:28:10Z`, 46), duration: 830000, agents: [{ name: 'Daniel Park' }], queue: { name: 'Digital Support' }, mediaType: 'CHAT', previousAgents: [], previousQueue: null },
    { name: 'FINISHED',  time: ts(`${D}11:28:10Z`, 876), duration: null, agents: [{ name: 'Daniel Park' }], queue: null, mediaType: 'CHAT', previousAgents: [], previousQueue: null },
  ],
};

// Derived from transition durations: jrn-001 (555s), jrn-002 (CC 353s + UC 384s), jrn-005 (532s)
const DEMO_RECORDINGS = {
  'jrn-001': [
    { id: 'rec-001-cc', type: 'CC', duration: 555, url: '' },
  ],
  'jrn-002': [
    { id: 'rec-002-cc', type: 'CC', duration: 353, url: '' },
    { id: 'rec-002-uc', type: 'UC', duration: 384, url: '' },
  ],
  'jrn-005': [
    { id: 'rec-005-cc', type: 'CC', duration: 532, url: '' },
  ],
};

const TRANSITION_COLORS = {
  STARTED:    '#6366f1',
  IN_SCRIPT:  '#f59e0b',
  WAITING:    '#3b82f6',
  TALKING:    '#10b981',
  HOLD:       '#f97316',
  FORWARD:    '#8b5cf6',
  TRANSFER:   '#ec4899',
  FINISHED:   '#6b7280',
};

const TRANSITION_ICONS = {
  STARTED:    PhoneCall,
  IN_SCRIPT:  Terminal,
  WAITING:    Clock,
  TALKING:    Mic,
  HOLD:       PauseCircle,
  FORWARD:    CornerDownRight,
  TRANSFER:   ArrowLeftRight,
  FINISHED:   CheckCircle2,
};

function formatDuration(ms) {
  if (!ms) return null;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── Timeline helpers ─────────────────────────────────────────────────────────

function computePositions(transitions, minGapPx = 120) {
  const LEFT_PAD = 60;
  const RIGHT_PAD = 60;
  const DESIRED_SPAN = 900;

  if (transitions.length <= 1) {
    return { positions: [LEFT_PAD], totalWidth: LEFT_PAD + RIGHT_PAD };
  }

  const times = transitions.map(t => new Date(t.time).getTime());
  const t0 = times[0];
  const msOffsets = times.map(t => t - t0);
  const maxMs = msOffsets[msOffsets.length - 1];

  let positions;
  if (maxMs === 0) {
    positions = transitions.map((_, i) => LEFT_PAD + i * minGapPx);
  } else {
    const scale = DESIRED_SPAN / maxMs;
    positions = msOffsets.map(o => LEFT_PAD + o * scale);
    // Enforce minimum gap with cascade-shift
    for (let i = 1; i < positions.length; i++) {
      const gap = positions[i] - positions[i - 1];
      if (gap < minGapPx) {
        const shift = minGapPx - gap;
        for (let j = i; j < positions.length; j++) positions[j] += shift;
      }
    }
  }

  return { positions, totalWidth: positions[positions.length - 1] + RIGHT_PAD };
}

// ─── NodeTooltip ──────────────────────────────────────────────────────────────

function NodeTooltip({ t, anchorEl, color }) {
  if (!anchorEl) return null;
  const rect = anchorEl.getBoundingClientRect();
  const TIP_W = 220;
  let left = rect.left + rect.width / 2 - TIP_W / 2;
  if (left + TIP_W > window.innerWidth - 8) left = window.innerWidth - TIP_W - 8;
  if (left < 8) left = 8;
  const bottom = window.innerHeight - rect.top + 14;

  const agents = t.agents?.map(a => a.name).filter(Boolean).join(', ');
  const queue = t.queue?.name;
  const prevAgent = t.previousAgents?.map(a => a.name).filter(Boolean).join(', ');
  const prevQueue = t.previousQueue?.name;

  return createPortal(
    <motion.div
      className="timeline-tooltip"
      style={{ position: 'fixed', bottom, left, width: TIP_W, borderLeft: `3px solid ${color}` }}
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.97, transition: { duration: 0.1 } }}
      transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.8 }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm" style={{ color }}>{t.name}</span>
        {formatDuration(t.duration) && (
          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${color}20`, color }}>
            {formatDuration(t.duration)}
          </span>
        )}
      </div>
      <div className="text-xs font-mono text-slate-500 mb-2">{formatTime(t.time)}</div>
      <div className="flex flex-col gap-1">
        {agents && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <User size={11} className="text-slate-500 flex-shrink-0" />
            <span>{agents}</span>
          </div>
        )}
        {queue && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <GitBranch size={11} className="text-slate-500 flex-shrink-0" />
            <span>{queue}</span>
          </div>
        )}
        {(prevAgent || prevQueue) && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>←</span>
            <span>{prevAgent || prevQueue}</span>
          </div>
        )}
        {t.mediaType && (
          <span className="self-start text-xs px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 capitalize mt-0.5">
            {t.mediaType}
          </span>
        )}
      </div>
    </motion.div>,
    document.body
  );
}

// ─── TimelineNode ─────────────────────────────────────────────────────────────

function TimelineNode({ t, position, index, isActive, onHover }) {
  const color = TRANSITION_COLORS[t.name] || '#6b7280';
  const Icon = TRANSITION_ICONS[t.name] || Activity;
  const nodeRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  const variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 22, scale: shouldReduceMotion ? 1 : 0.65 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 28 } },
  };

  return (
    <motion.div
      className="timeline-node-wrap"
      style={{ left: position }}
      variants={variants}
    >
      <div className="timeline-node-time">{formatTime(t.time)}</div>
      <motion.div
        ref={nodeRef}
        style={{
          width: 36, height: 36, borderRadius: '50%',
          border: `1.5px solid ${color}`,
          background: `${color}18`,
          color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative', flexShrink: 0,
        }}
        whileHover={shouldReduceMotion ? {} : { scale: 1.2, boxShadow: `0 0 0 8px ${color}28` }}
        transition={{ type: 'spring', stiffness: 600, damping: 20 }}
        onMouseEnter={() => onHover(index, nodeRef.current)}
        onMouseLeave={() => onHover(null, null)}
      >
        {isActive && !shouldReduceMotion && (
          <motion.div
            style={{
              position: 'absolute', width: '100%', height: '100%',
              borderRadius: '50%', border: `2px solid ${color}`, pointerEvents: 'none',
            }}
            animate={{ scale: [1, 1.7, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <Icon size={16} strokeWidth={2} />
      </motion.div>
      <div className="timeline-node-label" style={{ color: `${color}cc` }}>{t.name}</div>
    </motion.div>
  );
}

// ─── RecordingTrack ───────────────────────────────────────────────────────────

function RecordingTrack({ segments, segDurs, offsets, totalDuration, elapsed, trackWidth }) {
  if (!totalDuration || !segments.length) return null;
  const playheadPct = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;

  return (
    <div style={{ position: 'relative', height: 20, width: trackWidth }}>
      <div style={{
        position: 'absolute', top: '50%', left: 0, right: 0,
        height: 4, background: 'var(--border)', borderRadius: 2, transform: 'translateY(-50%)',
      }} />
      {segments.map((seg, i) => {
        const segW = (segDurs[i] / totalDuration) * 100;
        const segL = (offsets[i] / totalDuration) * 100;
        return (
          <div
            key={seg.id}
            className={`timeline-recording-segment ${seg.type.toLowerCase()}`}
            style={{ left: `${segL}%`, width: `${Math.max(segW, 0.3)}%` }}
            title={`${seg.type}`}
          />
        );
      })}
      <div className="timeline-playhead" style={{ left: `${playheadPct}%` }} />
    </div>
  );
}

// ─── HorizontalTimeline ───────────────────────────────────────────────────────

function HorizontalTimeline({ transitions, recordings, elapsed, totalDuration, journeyStartTime }) {
  const [activeIdx, setActiveIdx] = useState(null);
  const [activeAnchor, setActiveAnchor] = useState(null);
  const shouldReduceMotion = useReducedMotion();

  const { positions, totalWidth } = useMemo(() => computePositions(transitions), [transitions]);

  const playingActiveIdx = useMemo(() => {
    if (!elapsed || !journeyStartTime || !totalDuration) return null;
    const startMs = new Date(journeyStartTime).getTime();
    const currentMs = startMs + elapsed * 1000;
    let best = 0;
    for (let i = 0; i < transitions.length; i++) {
      if (new Date(transitions[i].time).getTime() <= currentMs) best = i;
    }
    return best;
  }, [elapsed, journeyStartTime, transitions, totalDuration]);

  const segDurs = recordings ? recordings.map(s => s.duration ?? 0) : [];
  const segOffsets = segDurs.reduce((acc, _, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + segDurs[i - 1]);
    return acc;
  }, []);

  const hasRecordings = recordings && recordings.length > 0 && totalDuration > 0;
  const trackStart = positions[0] ?? 0;
  const trackEnd = positions[positions.length - 1] ?? 0;
  const trackWidth = Math.max(trackEnd - trackStart + 60, 60);
  const innerHeight = hasRecordings ? 132 : 90;

  const railVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
  };

  return (
    <div>
      <div className="timeline-scroll-outer">
        <motion.div
          className="timeline-inner"
          style={{ minWidth: totalWidth, height: innerHeight }}
          variants={railVariants}
          initial={shouldReduceMotion ? 'visible' : 'hidden'}
          animate="visible"
        >
          {positions.length > 1 && (
            <div
              className="timeline-rail-line"
              style={{ left: trackStart, width: trackEnd - trackStart }}
            />
          )}

          {transitions.map((t, i) => (
            <TimelineNode
              key={i}
              t={t}
              position={positions[i]}
              index={i}
              isActive={playingActiveIdx === i}
              onHover={(idx, el) => {
                setActiveIdx(idx);
                setActiveAnchor(el);
              }}
            />
          ))}

          {hasRecordings && (
            <div style={{ position: 'absolute', top: 96, left: trackStart }}>
              <RecordingTrack
                segments={recordings}
                segDurs={segDurs}
                offsets={segOffsets}
                totalDuration={totalDuration}
                elapsed={elapsed}
                trackWidth={trackWidth}
              />
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {activeIdx !== null && activeAnchor && (
          <NodeTooltip
            key={activeIdx}
            t={transitions[activeIdx]}
            anchorEl={activeAnchor}
            color={TRANSITION_COLORS[transitions[activeIdx].name] || '#6b7280'}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RecordingPlayer({ segments, onProgressChange }) {
  const audioRef = useRef(null);
  const [durations, setDurations] = useState(() => {
    const d = {};
    segments.forEach(s => { if (s.duration) d[s.id] = s.duration; });
    return d;
  });
  const [currentSegIdx, setCurrentSegIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const segDurs = segments.map(s => durations[s.id] ?? 0);
  const totalDuration = segDurs.reduce((a, b) => a + b, 0);
  const offsets = segDurs.reduce((acc, _, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + segDurs[i - 1]);
    return acc;
  }, []);
  const elapsed = offsets[currentSegIdx] + currentTime;
  const progressPct = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;

  useEffect(() => {
    onProgressChange?.(elapsed, totalDuration);
  }, [elapsed, totalDuration]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (s) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  const handleEnded = () => {
    if (currentSegIdx < segments.length - 1) {
      setCurrentSegIdx(i => i + 1);
    } else {
      setPlaying(false);
      setCurrentSegIdx(0);
    }
    setCurrentTime(0);
  };

  useEffect(() => {
    setCurrentTime(0);
    if (playing && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [currentSegIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBarClick = (e) => {
    if (!totalDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = ratio * totalDuration;
    let segIdx = 0;
    for (let i = offsets.length - 1; i >= 0; i--) {
      if (target >= offsets[i]) { segIdx = i; break; }
    }
    const newTime = target - offsets[segIdx];
    if (segIdx === currentSegIdx && audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    setCurrentSegIdx(segIdx);
    setCurrentTime(newTime);
  };

  const seg = segments[currentSegIdx];

  return (
    <div className="recording-player">
      <audio
        key={seg.id}
        ref={audioRef}
        src={seg.url}
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onEnded={handleEnded}
        onLoadedMetadata={() => {
          const dur = audioRef.current?.duration;
          if (isFinite(dur)) setDurations(prev => ({ ...prev, [seg.id]: dur }));
        }}
      />
      <div className="player-controls">
        <button className="player-play-btn" onClick={handlePlayPause}>
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <span className="player-time">{fmt(elapsed)} / {fmt(totalDuration)}</span>
      </div>
      <div className="player-bar" onClick={handleBarClick}>
        <div className="player-progress" style={{ width: `${progressPct}%` }} />
        {offsets.slice(1).map((pos, i) => (
          <div
            key={i}
            className="player-seam"
            style={{ left: `${(pos / totalDuration) * 100}%` }}
            title={`Transfer → ${segments[i + 1].type}`}
          />
        ))}
      </div>
      <div className="player-segments">
        {segments.map((s, i) => (
          <span
            key={s.id}
            className={`player-segment-label ${s.type.toLowerCase()}`}
            style={{ flex: segDurs[i] || 1 }}
          >
            {s.type} {fmt(offsets[i])}–{fmt(offsets[i] + (segDurs[i] || 0))}
          </span>
        ))}
      </div>
    </div>
  );
}

function JourneyDetail({ journey, region, apiKey, cssToken, demoTransitions, demoRecordings }) {
  const [transitions, setTransitions] = useState(() =>
    demoTransitions ? { data: [{ transitions: demoTransitions }] } : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [recordings, setRecordings] = useState(() => demoRecordings ?? null);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [recordingsError, setRecordingsError] = useState(null);

  const loadRecordings = useCallback(async () => {
    setRecordingsLoading(true);
    setRecordingsError(null);
    try {
      const startMs = new Date(journey.time).getTime();
      const endMs = journey.endTime
        ? new Date(journey.endTime).getTime()
        : startMs + 86400000;
      const objects = await fetchRecordings(region, cssToken, startMs, endMs);
      const phone = journey.contact?.phoneNumber;
      const matched = phone
        ? objects.filter(o => JSON.stringify(o.tags || {}).includes(phone))
        : objects;
      const segments = await Promise.all(
        matched.map(async (o) => ({
          id: o.id,
          type: o.type === 'callcenterrecording' ? 'CC' : 'UC',
          duration: null,
          url: await getRecordingUrl(region, cssToken, o.id),
        }))
      );
      segments.sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));
      setRecordings(segments);
    } catch (e) {
      setRecordingsError(e.message);
    } finally {
      setRecordingsLoading(false);
    }
  }, [journey, region, cssToken]);

  const loadTransitions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const journeyStart = new Date(journey.time);
      const dayAfter = new Date(journeyStart.getTime() + 86400000).toISOString();
      const data = await searchTransitions(region, apiKey, {
        dateRange: { start: journeyStart.toISOString(), end: dayAfter },
        filters: [{ name: 'journeyId', values: [journey.journeyId] }],
        displayTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        limit: 200,
      });
      setTransitions(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [journey, region, apiKey]);

  const outcome = journey.outcome || 'Unknown';
  const agents = journey.agents?.map(a => a.name).filter(Boolean).join(', ') || '—';
  const contact = journey.contact;

  const [playerProgress, setPlayerProgress] = useState({ elapsed: 0, total: 0 });
  const handleProgress = useCallback((elapsed, total) => {
    setPlayerProgress({ elapsed, total });
  }, []);

  const allTransitions = transitions
    ? (transitions.data || [transitions]).flatMap(item => item.transitions || [])
    : [];

  const outcomeColors = {
    handled:        { bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
    abandoned:      { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
    endedinscript:  { bg: 'rgba(139,92,246,0.15)',  color: '#8b5cf6' },
  };
  const oc = outcomeColors[outcome.toLowerCase()] || { bg: 'rgba(107,114,128,0.2)', color: '#9ca3af' };

  return (
    <div className="max-w-3xl">
      {/* Detail header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={oc}>{outcome}</span>
          <span className="text-sm text-slate-400">{new Date(journey.time).toLocaleString()}</span>
          {journey.mediaTypes?.map(m => (
            <span key={m} className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 capitalize">{m}</span>
          ))}
        </div>
        <div className="text-xs font-mono text-slate-600">{journey.journeyId}</div>
      </div>

      {/* Info cards grid */}
      <div className="grid gap-2.5 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))' }}>
        {contact && (
          <div className="bg-[#141922] border border-[#1e2533] rounded-lg px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-widest text-slate-600 mb-1">Contact</div>
            <div className="text-sm text-slate-200">{contact.name || contact.phoneNumber || contact.email || '—'}</div>
            {contact.phoneNumber && contact.name && <div className="text-xs text-slate-500">{contact.phoneNumber}</div>}
          </div>
        )}
        <div className="bg-[#141922] border border-[#1e2533] rounded-lg px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-widest text-slate-600 mb-1">Direction</div>
          <div className="text-sm text-slate-200">{journey.direction || '—'}</div>
        </div>
        <div className="bg-[#141922] border border-[#1e2533] rounded-lg px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-widest text-slate-600 mb-1">Agents</div>
          <div className="text-sm text-slate-200">{agents}</div>
        </div>
        {journey.entryPoint && (
          <div className="bg-[#141922] border border-[#1e2533] rounded-lg px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-widest text-slate-600 mb-1">Entry Point</div>
            <div className="text-sm text-slate-200">{journey.entryPoint.name || journey.entryPoint.phoneNumber || '—'}</div>
            <div className="text-xs text-slate-500">{journey.entryPoint.type}</div>
          </div>
        )}
        {journey.queues?.length > 0 && (
          <div className="bg-[#141922] border border-[#1e2533] rounded-lg px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-widest text-slate-600 mb-1">Queues</div>
            <div className="text-sm text-slate-200">{journey.queues.map(q => q.name).join(', ')}</div>
          </div>
        )}
        <div className="bg-[#141922] border border-[#1e2533] rounded-lg px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-widest text-slate-600 mb-1">Transfers</div>
          <div className="text-sm text-slate-200">{journey.transfersCompleted ?? 0}</div>
        </div>
        {journey.holdDuration > 0 && (
          <div className="bg-[#141922] border border-[#1e2533] rounded-lg px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-widest text-slate-600 mb-1">Hold</div>
            <div className="text-sm text-slate-200">{formatDuration(journey.holdDuration)}</div>
          </div>
        )}
        {journey.wrapUpCodes?.length > 0 && (
          <div className="bg-[#141922] border border-[#1e2533] rounded-lg px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-widest text-slate-600 mb-1">Wrap-up</div>
            <div className="text-sm text-slate-200">{journey.wrapUpCodes.join(', ')}</div>
          </div>
        )}
      </div>

      {/* Transitions section */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <Activity size={14} className="text-slate-500" />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Transitions</span>
          {allTransitions.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/5 text-slate-500">
              {allTransitions.length}
            </span>
          )}
          {!transitions && !loading && (
            <button
              className="ml-auto text-xs px-3 py-1 rounded border border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10 transition-colors"
              onClick={loadTransitions}
            >
              Load
            </button>
          )}
        </div>

        {loading && <div className="text-sm text-slate-500 py-2">Loading…</div>}
        {error && <div className="text-sm text-red-400 py-2">{error}</div>}
        {transitions && allTransitions.length === 0 && (
          <div className="text-sm text-slate-600">No transitions found.</div>
        )}

        {allTransitions.length > 0 && (
          <HorizontalTimeline
            transitions={allTransitions}
            recordings={recordings ?? null}
            elapsed={playerProgress.elapsed}
            totalDuration={playerProgress.total}
            journeyStartTime={journey.time}
          />
        )}
      </div>

      {/* Recordings section */}
      <div className="mt-6">
        <div className="flex items-center gap-2.5 mb-4">
          <Mic size={14} className="text-slate-500" />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Recordings</span>
          {recordings && recordings.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/5 text-slate-500">
              {recordings.length}
            </span>
          )}
          {!recordings && !recordingsLoading && cssToken && (
            <button
              className="ml-auto text-xs px-3 py-1 rounded border border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10 transition-colors"
              onClick={loadRecordings}
            >
              Load
            </button>
          )}
          {!recordings && !recordingsLoading && !cssToken && !demoRecordings && (
            <span className="ml-auto text-xs text-slate-600">Add a CSS token to load recordings</span>
          )}
        </div>
        {recordingsLoading && <div className="text-sm text-slate-500 py-2">Loading…</div>}
        {recordingsError && <div className="text-sm text-red-400 py-2">{recordingsError}</div>}
        {recordings && recordings.length === 0 && (
          <div className="text-sm text-slate-600">No recordings found for this journey.</div>
        )}
        {recordings && recordings.length > 0 && (
          <RecordingPlayer segments={recordings} onProgressChange={handleProgress} />
        )}
      </div>
    </div>
  );
}

function JourneyRow({ journey, selected, onClick }) {
  const outcome = journey.outcome || 'Unknown';
  const contact = journey.contact;
  const displayName = contact?.name || contact?.phoneNumber || contact?.email || 'Unknown Contact';
  const outcomeColors = {
    handled:        '#10b981',
    abandoned:      '#f59e0b',
    endedinscript:  '#8b5cf6',
  };
  const dotColor = outcomeColors[outcome.toLowerCase()] || '#6b7280';

  return (
    <div
      className={`px-2.5 py-2 rounded-md cursor-pointer transition-colors mb-0.5 ${
        selected
          ? 'bg-[#1e2d4a] border-l-2 border-indigo-500'
          : 'hover:bg-[#1a2030] border-l-2 border-transparent'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} title={outcome} />
        <span className="text-sm text-slate-200 flex-1 truncate">{displayName}</span>
        {journey.mediaTypes?.map(m => (
          <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">{m}</span>
        ))}
      </div>
      <div className="flex items-center gap-1.5 pl-4 mt-0.5">
        <span className="text-[11px] text-slate-600">
          {new Date(journey.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        {journey.transfersCompleted > 0 && (
          <span className="text-[10px] text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded">
            {journey.transfersCompleted}x xfer
          </span>
        )}
      </div>
    </div>
  );
}

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 16);
};

const todayEnd = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 0);
  return d.toISOString().slice(0, 16);
};

export default function App() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('cidp_theme') !== 'light');
  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem('cidp_theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('cidp_api_key') || '');
  const [cssToken, setCssToken] = useState(() => localStorage.getItem('cidp_css_token') || '');
  const [region, setRegion] = useState(() => localStorage.getItem('cidp_region') || 'us');
  const [startDate, setStartDate] = useState(todayStart);
  const [endDate, setEndDate] = useState(todayEnd);
  const [journeys, setJourneys] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [total, setTotal] = useState(null);
  const [isDemo, setIsDemo] = useState(false);

  const loadDemo = useCallback(() => {
    setIsDemo(true);
    setJourneys(DEMO_JOURNEYS);
    setTotal(DEMO_JOURNEYS.length);
    setNextCursor(null);
    setError(null);
    setSelectedJourney(DEMO_JOURNEYS[0]);
  }, []);

  const search = useCallback(async (cursor = null) => {
    if (!apiKey) { setError('API key is required'); return; }
    setIsDemo(false);
    setLoading(true);
    setError(null);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const body = {
        dateRange: {
          start: new Date(startDate).toISOString(),
          end: new Date(endDate).toISOString(),
        },
        displayTimezone: tz,
        limit: 50,
        sortDirection: 'DESC',
      };
      if (cursor) body.nextPageCursor = cursor;
      const data = await searchJourneys(region, apiKey, body);
      const items = data.data || [];
      setJourneys(prev => cursor ? [...(prev || []), ...items] : items);
      setNextCursor(data.nextPageCursor || null);
      setTotal(data.totalElements ?? null);
      if (!cursor) setSelectedJourney(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiKey, region, startDate, endDate]);

  const handleKeyDown = (e) => { if (e.key === 'Enter') search(); };

  return (
    <div className="flex flex-col h-screen overflow-hidden text-slate-200" style={{ background: 'var(--bg-base)' }} data-theme={isDark ? 'dark' : 'light'}>
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-3 border-b border-[#1e2533] flex-shrink-0">
        <div className="flex-1">
          <h1 className="m-0 text-lg font-semibold text-slate-100">Customer Journey Map</h1>
          <span className="text-xs text-slate-600 block mt-px">8x8 CIDP End-to-End Journey API</span>
        </div>
        {isDemo && (
          <span className="text-xs px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-medium">
            Demo mode
          </span>
        )}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-8 h-8 rounded-md border border-[#2d3748] text-slate-400 hover:border-indigo-500/50 hover:text-indigo-400 transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <button
          onClick={loadDemo}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[#2d3748] text-slate-400 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
        >
          <FlaskConical size={13} />
          Load demo
        </button>
      </header>

      {/* Controls */}
      <div className="px-5 py-3 border-b border-[#1e2533] bg-[#0d1018] flex-shrink-0">
        <div className="flex gap-2.5 items-end flex-wrap">
          {/* API Key */}
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-[11px] uppercase tracking-widest text-slate-600">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onBlur={() => localStorage.setItem('cidp_api_key', apiKey)}
              onKeyDown={handleKeyDown}
              placeholder="Paste your x-api-key here"
              className="bg-[#1a2030] border border-[#2d3748] rounded-md text-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
            />
          </div>
          {/* CSS Token */}
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <label className="text-[11px] uppercase tracking-widest text-slate-600">CSS Token</label>
            <input
              type="password"
              value={cssToken}
              onChange={e => setCssToken(e.target.value)}
              onBlur={() => localStorage.setItem('cidp_css_token', cssToken)}
              placeholder="Bearer token for recordings"
              className="bg-[#1a2030] border border-[#2d3748] rounded-md text-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
            />
          </div>
          {/* Region */}
          <div className="flex flex-col gap-1 w-[90px]">
            <label className="text-[11px] uppercase tracking-widest text-slate-600">Region</label>
            <select
              value={region}
              onChange={e => { setRegion(e.target.value); localStorage.setItem('cidp_region', e.target.value); }}
              className="bg-[#1a2030] border border-[#2d3748] rounded-md text-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="us">US</option>
              <option value="eu">EU</option>
            </select>
          </div>
          {/* Start */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-widest text-slate-600">Start</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-[#1a2030] border border-[#2d3748] rounded-md text-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          {/* End */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-widest text-slate-600">End</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-[#1a2030] border border-[#2d3748] rounded-md text-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <button
            className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors self-end"
            onClick={() => search()}
            disabled={loading}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
        {error && (
          <div className="mt-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Main layout */}
      {journeys !== null && (
        <div className="flex flex-1 overflow-hidden">
          {/* Journeys panel */}
          <div className="w-[300px] flex-shrink-0 border-r border-[#1e2533] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-3.5 py-2.5 text-xs font-semibold uppercase tracking-widest text-slate-500 border-b border-[#1e2533] flex-shrink-0">
              <span>Journeys</span>
              {total !== null && (
                <span className="text-slate-600">{journeys.length} / {total}</span>
              )}
            </div>
            {journeys.length === 0 && (
              <div className="p-5 text-center text-slate-600 text-sm">No journeys found for this period.</div>
            )}
            <div className="overflow-y-auto flex-1 p-1.5">
              {journeys.map(j => (
                <JourneyRow
                  key={j.journeyId}
                  journey={j}
                  selected={selectedJourney?.journeyId === j.journeyId}
                  onClick={() => setSelectedJourney(j)}
                />
              ))}
            </div>
            {nextCursor && (
              <button
                className="w-full bg-transparent border border-[#2d3748] rounded-md text-slate-500 py-2 text-xs hover:border-indigo-500 hover:text-indigo-400 disabled:opacity-50 transition-colors m-1.5"
                onClick={() => search(nextCursor)}
                disabled={loading}
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>

          {/* Detail panel */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {selectedJourney ? (
              <JourneyDetail
                key={selectedJourney.journeyId}
                journey={selectedJourney}
                region={region}
                apiKey={apiKey}
                cssToken={cssToken}
                demoTransitions={isDemo ? DEMO_TRANSITIONS[selectedJourney.journeyId] : undefined}
                demoRecordings={isDemo ? (DEMO_RECORDINGS[selectedJourney.journeyId] ?? []) : undefined}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 text-sm">
                Select a journey to view its timeline
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
