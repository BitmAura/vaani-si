/**
 * Real Estate Dashboard Widgets
 * VANNI — Layer 6 Enterprise Portal
 * Industry-specific dashboard components for plot developers
 */

import React from 'react';

interface PlotAvailabilityHeatmapProps {
  data: Array<{
    block: string;
    available: number;
    booked: number;
    total: number;
  }>;
}

/**
 * Plot Availability Heatmap Widget
 */
export const PlotAvailabilityHeatmap: React.FC<PlotAvailabilityHeatmapProps> = ({ data }) => {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 20px 0', color: '#0f172a' }}>
        Plot Availability Heatmap
      </h3>
      <div style={{ display: 'grid', gap: '12px' }}>
        {data.map((block) => {
          const availability = (block.available / block.total) * 100;
          return (
            <div key={block.block} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '80px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                {block.block}
              </div>
              <div style={{ flex: 1, height: '24px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${availability}%`,
                  height: '100%',
                  background: availability > 60 ? '#10b981' : availability > 30 ? '#f59e0b' : '#ef4444',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ width: '100px', fontSize: '12px', color: '#64748b', textAlign: 'right' }}>
                {block.available}/{block.total} available
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface SiteVisitBookingRateProps {
  data: Array<{
    week: string;
    scheduled: number;
    completed: number;
    converted: number;
  }>;
}

/**
 * Site Visit Booking Rate Widget
 */
export const SiteVisitBookingRate: React.FC<SiteVisitBookingRateProps> = ({ data }) => {
  const totalScheduled = data.reduce((sum, d) => sum + d.scheduled, 0);
  const totalCompleted = data.reduce((sum, d) => sum + d.completed, 0);
  const totalConverted = data.reduce((sum, d) => sum + d.converted, 0);
  const completionRate = ((totalCompleted / totalScheduled) * 100).toFixed(0);
  const conversionRate = ((totalConverted / totalCompleted) * 100).toFixed(0);

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 20px 0', color: '#0f172a' }}>
        Sunday Site Visit Performance
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#3b82f6' }}>{totalScheduled}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Scheduled</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#10b981' }}>{completionRate}%</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Completed</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#f59e0b' }}>{conversionRate}%</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Converted</div>
        </div>
      </div>
      <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
        Avg. 1 in {Math.round(100 / parseFloat(conversionRate))} site visits converts to booking
      </div>
    </div>
  );
};

interface LeadSourceBreakdownProps {
  data: Array<{
    source: string;
    count: number;
    percentage: number;
    cost: number;
  }>;
}

/**
 * Lead Source Breakdown Widget
 */
export const LeadSourceBreakdown: React.FC<LeadSourceBreakdownProps> = ({ data }) => {
  const totalLeads = data.reduce((sum, d) => sum + d.count, 0);
  const totalCost = data.reduce((sum, d) => sum + d.cost, 0);

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          Lead Source Breakdown
        </h3>
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          {totalLeads} leads • ₹{totalCost.toLocaleString('en-IN')} spent
        </div>
      </div>
      <div style={{ display: 'grid', gap: '12px' }}>
        {data.map((item) => (
          <div key={item.source} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '120px', fontSize: '13px', color: '#334155' }}>{item.source}</div>
            <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${item.percentage}%`, height: '100%', background: '#3b82f6' }} />
            </div>
            <div style={{ width: '80px', fontSize: '12px', color: '#64748b', textAlign: 'right' }}>
              {item.count} ({item.percentage}%)
            </div>
            <div style={{ width: '80px', fontSize: '12px', color: '#64748b', textAlign: 'right' }}>
              ₹{item.cost.toLocaleString('en-IN')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface RevenueProjectionProps {
  data: Array<{
    plotType: string;
    available: number;
    avgPrice: number;
    projectedRevenue: number;
  }>;
}

/**
 * Revenue Projection by Plot Type Widget
 */
export const RevenueProjection: React.FC<RevenueProjectionProps> = ({ data }) => {
  const totalProjected = data.reduce((sum, d) => sum + d.projectedRevenue, 0);

  return (
    <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#ffffff' }}>
          Revenue Projection
        </h3>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>If all plots sold</div>
      </div>
      <div style={{ fontSize: '36px', fontWeight: 800, color: '#10b981', marginBottom: '24px' }}>
        ₹{(totalProjected / 100000).toFixed(1)} Cr
      </div>
      <div style={{ display: 'grid', gap: '12px' }}>
        {data.map((item) => (
          <div key={item.plotType} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>{item.plotType}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>{item.available} plots • ₹{item.avgPrice.toLocaleString('en-IN')}/sqft</div>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#10b981' }}>
              ₹{(item.projectedRevenue / 100000).toFixed(1)}L
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface CallConversionFunnelProps {
  stages: Array<{
    stage: string;
    count: number;
    percentage: number;
  }>;
}

/**
 * Call Conversion Funnel Widget
 */
export const CallConversionFunnel: React.FC<CallConversionFunnelProps> = ({ stages }) => {
  const maxCount = Math.max(...stages.map(s => s.count));

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 20px 0', color: '#0f172a' }}>
        Call Conversion Funnel
      </h3>
      <div style={{ display: 'grid', gap: '16px' }}>
        {stages.map((stage, index) => (
          <div key={stage.stage}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', color: '#334155' }}>{stage.stage}</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>{stage.count}</div>
            </div>
            <div style={{ height: '32px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                width: `${(stage.count / maxCount) * 100}%`,
                height: '100%',
                background: index === 0 ? '#3b82f6' : index === 1 ? '#8b5cf6' : index === 2 ? '#f59e0b' : '#10b981',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '12px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#ffffff',
              }}>
                {stage.percentage}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default {
  PlotAvailabilityHeatmap,
  SiteVisitBookingRate,
  LeadSourceBreakdown,
  RevenueProjection,
  CallConversionFunnel,
};
