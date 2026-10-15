/**
 * Digital Agency Dashboard Widgets
 * VANNI — Layer 6 Enterprise Portal
 * Multi-client management dashboard for agencies
 */

import React from 'react';

interface ClientOverviewWidgetProps {
  clients: Array<{
    businessName: string;
    industry: string;
    status: 'ACTIVE' | 'TRIAL' | 'SUSPENDED';
    callsThisMonth: number;
    leadsThisMonth: number;
  }>;
}

/**
 * Client Overview Widget
 */
export const ClientOverviewWidget: React.FC<ClientOverviewWidgetProps> = ({ clients }) => {
  const activeClients = clients.filter(c => c.status === 'ACTIVE').length;
  const totalCalls = clients.reduce((sum, c) => sum + c.callsThisMonth, 0);
  const totalLeads = clients.reduce((sum, c) => sum + c.leadsThisMonth, 0);

  const statusColors = {
    ACTIVE: '#10b981',
    TRIAL: '#3b82f6',
    SUSPENDED: '#ef4444',
  };

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          Client Overview
        </h3>
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          {activeClients}/{clients.length} active
        </div>
      </div>
      <div style={{ display: 'grid', gap: '12px' }}>
        {clients.map((client) => (
          <div key={client.businessName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{client.businessName}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>{client.industry.replace('_', ' ')}</div>
            </div>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#3b82f6' }}>{client.callsThisMonth}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>calls</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#10b981' }}>{client.leadsThisMonth}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>leads</div>
              </div>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColors[client.status] }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface AgencyRevenueWidgetProps {
  currentMonth: number;
  previousMonth: number;
  platformFees: number;
  margin: number;
}

/**
 * Agency Revenue Widget
 */
export const AgencyRevenueWidget: React.FC<AgencyRevenueWidgetProps> = ({ currentMonth, previousMonth, platformFees, margin }) => {
  const growth = (((currentMonth - previousMonth) / previousMonth) * 100).toFixed(1);
  const isPositive = parseFloat(growth) >= 0;

  return (
    <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>This Month Revenue</div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: '#ffffff' }}>
            ₹{(currentMonth / 1000).toFixed(0)}K
          </div>
        </div>
        <div style={{ padding: '6px 12px', background: isPositive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', borderRadius: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: isPositive ? '#10b981' : '#ef4444' }}>
            {isPositive ? '↑' : '↓'} {Math.abs(parseFloat(growth))}%
          </span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Platform Fees</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#e2e8f0' }}>₹{(platformFees / 1000).toFixed(0)}K</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Your Margin</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#10b981' }}>₹{(margin / 1000).toFixed(0)}K</div>
        </div>
      </div>
    </div>
  );
};

interface UsageBreakdownWidgetProps {
  clients: Array<{
    businessName: string;
    calls: number;
    callsLimit: number;
    overage: number;
  }>;
}

/**
 * Usage Breakdown Widget
 */
export const UsageBreakdownWidget: React.FC<UsageBreakdownWidgetProps> = ({ clients }) => {
  const totalUsage = clients.reduce((sum, c) => sum + c.calls, 0);
  const totalLimit = clients.reduce((sum, c) => sum + c.callsLimit, 0);
  const totalOverage = clients.reduce((sum, c) => sum + c.overage, 0);

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          Usage Breakdown
        </h3>
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          {totalUsage.toLocaleString()}/{totalLimit.toLocaleString()} calls
        </div>
      </div>
      <div style={{ display: 'grid', gap: '12px' }}>
        {clients.map((client) => {
          const usagePercent = ((client.calls / client.callsLimit) * 100).toFixed(0);
          const isOverLimit = parseFloat(usagePercent) > 100;
          return (
            <div key={client.businessName}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>{client.businessName}</div>
                <div style={{ fontSize: '12px', color: isOverLimit ? '#ef4444' : '#64748b' }}>
                  {client.calls}/{client.callsLimit}
                  {isOverLimit && <span style={{ marginLeft: '8px', fontWeight: 600 }}>OVER</span>}
                </div>
              </div>
              <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(parseFloat(usagePercent), 100)}%`,
                  height: '100%',
                  background: isOverLimit ? '#ef4444' : parseFloat(usagePercent) > 80 ? '#f59e0b' : '#10b981',
                }} />
              </div>
            </div>
          );
        })}
      </div>
      {totalOverage > 0 && (
        <div style={{ marginTop: '16px', padding: '12px', background: '#fef2f2', borderRadius: '6px', fontSize: '13px', color: '#ef4444', fontWeight: 600 }}>
          Total overage this month: ₹{totalOverage.toLocaleString('en-IN')}
        </div>
      )}
    </div>
  );
};

interface IndustryDistributionWidgetProps {
  data: Array<{
    industry: string;
    clientCount: number;
    totalCalls: number;
    avgLeadQuality: number;
  }>;
}

/**
 * Industry Distribution Widget
 */
export const IndustryDistributionWidget: React.FC<IndustryDistributionWidgetProps> = ({ data }) => {
  const totalClients = data.reduce((sum, d) => sum + d.clientCount, 0);

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 20px 0', color: '#0f172a' }}>
        Clients by Industry
      </h3>
      <div style={{ display: 'grid', gap: '16px' }}>
        {data.map((item) => {
          const percentage = ((item.clientCount / totalClients) * 100).toFixed(0);
          return (
            <div key={item.industry} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    {item.industry.replace('_', ' ')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{item.clientCount} clients</div>
                </div>
                <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${percentage}%`, height: '100%', background: '#3b82f6' }} />
                </div>
              </div>
              <div style={{ width: '100px', textAlign: 'right' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{item.totalCalls.toLocaleString()}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>calls</div>
              </div>
              <div style={{ width: '60px', textAlign: 'right' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#10b981' }}>{item.avgLeadQuality}%</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>quality</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default {
  ClientOverviewWidget,
  AgencyRevenueWidget,
  UsageBreakdownWidget,
  IndustryDistributionWidget,
};
