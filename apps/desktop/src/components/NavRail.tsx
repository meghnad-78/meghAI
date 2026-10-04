import React from 'react';
import type { ActiveTab } from '../App.js';
import {
  CompassNodeIcon,
  VoiceIcon,
  MemoryIcon,
  NotesIcon,
  TasksIcon,
  RoutineIcon,
  SecurityIcon,
  ModelIcon,
  TimelineIcon
} from './ui/Icons.js';

interface NavRailProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onToggleTimeline: () => void;
  eventCount: number;
}

type NavItem = {
  id: ActiveTab;
  label: string;
  icon: React.FC<{ size?: number | string; color?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'home',        label: 'Console',   icon: CompassNodeIcon },
  { id: 'voice',       label: 'Voice',     icon: VoiceIcon },
  { id: 'memory',      label: 'Memory',    icon: MemoryIcon },
  { id: 'knowledge',   label: 'Knowledge', icon: ModelIcon },
  { id: 'notes',       label: 'Notes',     icon: NotesIcon },
  { id: 'tasks',       label: 'Tasks',     icon: TasksIcon },
  { id: 'routines',    label: 'Routines',  icon: RoutineIcon },
  { id: 'providers',   label: 'Providers', icon: ModelIcon },
  { id: 'permissions', label: 'Safety',    icon: SecurityIcon },
];

export const NavRail: React.FC<NavRailProps> = ({
  activeTab,
  onSelectTab,
  onToggleTimeline,
  eventCount
}) => {
  return (
    <nav className="nav-rail" aria-label="Main navigation">
      {/* Logo / Brand */}
      <div
        className="nav-rail-logo"
        onClick={() => onSelectTab('home')}
        title="MeghAI Console"
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onSelectTab('home')}
      >
        <CompassNodeIcon size={20} color="#4fa8b5" />
      </div>

      <div className="nav-rail-sep" />

      {/* Main nav items */}
      {NAV_ITEMS.map(item => {
        const isActive = activeTab === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            className={`nav-rail-item${isActive ? ' active' : ''}`}
            onClick={() => onSelectTab(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon
              size={16}
              color={isActive ? '#4fa8b5' : '#616a78'}
            />
            <span className="nav-tooltip">{item.label}</span>
          </button>
        );
      })}

      <div style={{ flex: 1 }} />

      <div className="nav-rail-sep" />

      {/* Timeline trigger at the bottom */}
      <button
        className="nav-rail-item"
        onClick={onToggleTimeline}
        aria-label={`Action timeline (${eventCount} events)`}
        title="Action timeline"
        style={{ position: 'relative' }}
      >
        <TimelineIcon size={15} color="#616a78" />
        {eventCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              minWidth: 13,
              height: 13,
              borderRadius: 7,
              background: '#4fa8b5',
              color: '#07080a',
              fontSize: 8,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 2px'
            }}
          >
            {eventCount > 99 ? '99' : eventCount}
          </span>
        )}
        <span className="nav-tooltip">Timeline</span>
      </button>
    </nav>
  );
};
