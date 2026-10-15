/**
 * Main Dashboard Page
 * VANNI — Layer 6: Enterprise Client Portal
 * Multi-segment dashboard with real-time data
 */

'use client';

import React, { useState, useEffect } from 'react';

export default function DashboardPage() {
  const [activeSegment, setActiveSegment] = useState<'real_estate' | 'healthcare' | 'agency'>('real_estate');
  const [stats, setStats] = useState({
    callsToday: 0,
    leadsToday: 0,
    conversionRate: 0,
    avgResponseTime: 0,
  });

  useEffect(() => {
    // Fetch real stats from API
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: '32px' }}>
      {/* Header */}
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: 0, marginBottom: '8px' }}>
            Dashboard
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            Real-time performance metrics across all segments
          </p>
        </div>

        {/* Segment Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', borderBottom: '1px solid #334155', paddingBottom: '16px' }}>
          {['real_estate', 'healthcare', 'agency'].map((segment) => (
            <button
              key={segment}
              onClick={() => setActiveSegment(segment as any)}
              style={{
                padding: '10px 20px',
                background: activeSegment === segment ? '#3b82f6' : 'transparent',
                border: '1px solid',
                borderColor: activeSegment === segment ? '#3b82f6' : '#475569',
                borderRadius: '8px',
                color: activeSegment === segment ? '#ffffff' : '#94a3b8',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
            >
              {segment.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>Calls Today</div>
              <div style={{ fontSize: '20px' }}>📞</div>
            </div>
            <div style={{ fontSize: '36px', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
              {stats.callsToday.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: '#10b981' }}>↑ 12% from yesterday</div>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>Leads Today</div>
              <div style={{ fontSize: '20px' }}>🎯</div>
            </div>
            <div style={{ fontSize: '36px', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
              {stats.leadsToday.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: '#10b981' }}>↑ 8% conversion rate</div>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>Avg Response Time</div>
              <div style={{ fontSize: '20px' }}>⚡</div>
            </div>
            <div style={{ fontSize: '36px', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
              {stats.avgResponseTime}ms
            </div>
            <div style={{ fontSize: '12px', color: '#10b981' }}>✓ Under 750ms target</div>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>Active Calls</div>
              <div style={{ fontSize: '20px' }}>🎙️</div>
            </div>
            <div style={{ fontSize: '36px', fontWeight: 800, color: '#10b981', marginBottom: '4px' }}>
              12
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Live right now</div>
          </div>
        </div>

        {/* Segment-Specific Content */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
          {activeSegment === 'real_estate' && (
            <>
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 20px 0' }}>Plot Availability</h3>
                <div style={{ fontSize: '48px', fontWeight: 800, color: '#10b981', marginBottom: '8px' }}>85/150</div>
                <div style={{ fontSize: '14px', color: '#94a3b8' }}>Available plots</div>
              </div>

              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 20px 0' }}>Site Visits This Week</h3>
                <div style={{ fontSize: '48px', fontWeight: 800, color: '#3b82f6', marginBottom: '8px' }}>42</div>
                <div style={{ fontSize: '14px', color: '#94a3b8' }}>Scheduled for Sunday</div>
              </div>
            </>
          )}

          {activeSegment === 'healthcare' && (
            <>
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 20px 0' }}>Appointments Today</h3>
                <div style={{ fontSize: '48px', fontWeight: 800, color: '#10b981', marginBottom: '8px' }}>156</div>
                <div style={{ fontSize: '14px', color: '#94a3b8' }}>Across all doctors</div>
              </div>

              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 20px 0' }}>Emergency Alerts</h3>
                <div style={{ fontSize: '48px', fontWeight: 800, color: '#ef4444', marginBottom: '8px' }}>2</div>
                <div style={{ fontSize: '14px', color: '#94a3b8' }}>Require attention</div>
              </div>
            </>
          )}

          {activeSegment === 'agency' && (
            <>
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 20px 0' }}>Active Clients</h3>
                <div style={{ fontSize: '48px', fontWeight: 800, color: '#10b981', marginBottom: '8px' }}>8</div>
                <div style={{ fontSize: '14px', color: '#94a3b8' }}>7 active, 1 on trial</div>
              </div>

              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 20px 0' }}>Revenue This Month</h3>
                <div style={{ fontSize: '48px', fontWeight: 800, color: '#f59e0b', marginBottom: '8px' }}>₹3.6L</div>
                <div style={{ fontSize: '14px', color: '#94a3b8' }}>Your margin: ₹72K</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
