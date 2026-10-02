import React, { useState, useEffect } from 'react';
import { MEGHAI_COLORS, formatCurrencyINR } from '@meghai/ui';

export default function WebCompanionApp() {
  const [nodeStatus, setNodeStatus] = useState<string>('CONNECTING');
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        setNodeStatus('CONNECTED');
      } else {
        setNodeStatus('DEGRADED');
      }
    } catch {
      setNodeStatus('OFFLINE');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isProcessing) return;

    const userText = query.trim();
    setQuery('');
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setIsProcessing(true);

    try {
      const res = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
      });

      const data = await res.json();
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.response || data.message || 'Action executed.' },
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Error communicating with MeghAI: ${err.message}` },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerKillSwitch = async () => {
    try {
      await fetch('/api/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Web companion emergency trigger' }),
      });
      alert('EMERGENCY KILL SWITCH ACTIVATED. All executions halted.');
    } catch (err) {
      alert(`Kill switch error: ${err}`);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: MEGHAI_COLORS.bgVoid,
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '20px',
        borderBottom: `1px solid ${MEGHAI_COLORS.borderMuted}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            backgroundColor: nodeStatus === 'CONNECTED' ? MEGHAI_COLORS.greenNeon : MEGHAI_COLORS.redDanger,
            boxShadow: `0 0 10px ${nodeStatus === 'CONNECTED' ? MEGHAI_COLORS.greenNeon : MEGHAI_COLORS.redDanger}`
          }} />
          <h1 style={{ margin: 0, fontSize: '20px', letterSpacing: '1px', color: MEGHAI_COLORS.cyanPrimary }}>
            MEGHAI <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 'normal' }}>// WEB COMPANION</span>
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>
            NODE: {nodeStatus} | COST: {formatCurrencyINR(0)}
          </span>
          <button
            onClick={triggerKillSwitch}
            style={{
              backgroundColor: 'rgba(255, 0, 85, 0.2)',
              border: `1px solid ${MEGHAI_COLORS.redCritical}`,
              color: MEGHAI_COLORS.redCritical,
              padding: '6px 14px',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '11px',
              letterSpacing: '1px'
            }}
          >
            STOP MEGH
          </button>
        </div>
      </header>

      {/* Main chat / stream body */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '800px',
        width: '100%',
        margin: '0 auto'
      }}>
        {messages.length === 0 ? (
          <div style={{
            margin: 'auto',
            textAlign: 'center',
            color: '#64748b',
            border: `1px dashed ${MEGHAI_COLORS.borderMuted}`,
            padding: '40px',
            borderRadius: '12px'
          }}>
            <h3 style={{ color: MEGHAI_COLORS.cyanPrimary, marginBottom: '8px' }}>Personal AI Operating Layer</h3>
            <p style={{ margin: 0, fontSize: '14px' }}>
              Connected to Windows desktop node. Ready for commands, notes, automation, and queries.
            </p>
          </div>
        ) : (
          messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: m.role === 'user' ? 'rgba(0, 240, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${m.role === 'user' ? MEGHAI_COLORS.borderActive : MEGHAI_COLORS.borderMuted}`,
                padding: '12px 18px',
                borderRadius: '8px',
                maxWidth: '80%',
                fontSize: '14px',
                lineHeight: '1.5'
              }}
            >
              <div style={{
                fontSize: '11px',
                color: m.role === 'user' ? MEGHAI_COLORS.cyanPrimary : MEGHAI_COLORS.purpleNeon,
                fontFamily: 'monospace',
                marginBottom: '4px'
              }}>
                {m.role === 'user' ? 'USER' : 'MEGHAI'}
              </div>
              {m.content}
            </div>
          ))
        )}
      </main>

      {/* Input bar */}
      <footer style={{
        maxWidth: '800px',
        width: '100%',
        margin: '0 auto',
        paddingTop: '16px',
        borderTop: `1px solid ${MEGHAI_COLORS.borderMuted}`
      }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type command or prompt (e.g. 'create note groceries', 'system status')..."
            disabled={isProcessing}
            style={{
              flex: 1,
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              border: `1px solid ${MEGHAI_COLORS.borderMuted}`,
              color: '#f8fafc',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={isProcessing || !query.trim()}
            style={{
              backgroundColor: MEGHAI_COLORS.cyanPrimary,
              color: '#030712',
              border: 'none',
              padding: '0 24px',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              opacity: isProcessing || !query.trim() ? 0.5 : 1
            }}
          >
            {isProcessing ? 'RUNNING...' : 'SEND'}
          </button>
        </form>
      </footer>
    </div>
  );
}
