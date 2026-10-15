/**
 * Healthcare Dashboard Widgets
 * VANNI — Layer 6 Enterprise Portal
 * Industry-specific dashboard components for hospitals
 */

import React from 'react';

interface DoctorAvailabilityWidgetProps {
  doctors: Array<{
    name: string;
    specialization: string;
    nextAvailable: string;
    status: 'AVAILABLE' | 'BUSY' | 'ON_LEAVE' | 'ON_CALL';
  }>;
}

/**
 * Doctor Availability Widget
 */
export const DoctorAvailabilityWidget: React.FC<DoctorAvailabilityWidgetProps> = ({ doctors }) => {
  const statusColors = {
    AVAILABLE: '#10b981',
    BUSY: '#f59e0b',
    ON_LEAVE: '#94a3b8',
    ON_CALL: '#3b82f6',
  };

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          Doctor Availability
        </h3>
        <div style={{ fontSize: '12px', color: '#64748b' }}>{doctors.length} doctors</div>
      </div>
      <div style={{ display: 'grid', gap: '12px' }}>
        {doctors.map((doctor) => (
          <div key={doctor.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{doctor.name}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>{doctor.specialization}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: `${statusColors[doctor.status]}15`, borderRadius: '4px', marginBottom: '4px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColors[doctor.status] }} />
                <span style={{ fontSize: '11px', fontWeight: 600, color: statusColors[doctor.status] }}>
                  {doctor.status.replace('_', ' ')}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>{doctor.nextAvailable}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface AppointmentTrendsWidgetProps {
  data: Array<{
    day: string;
    scheduled: number;
    completed: number;
    noShows: number;
  }>;
}

/**
 * Appointment Trends Widget
 */
export const AppointmentTrendsWidget: React.FC<AppointmentTrendsWidgetProps> = ({ data }) => {
  const totalScheduled = data.reduce((sum, d) => sum + d.scheduled, 0);
  const totalCompleted = data.reduce((sum, d) => sum + d.completed, 0);
  const totalNoShows = data.reduce((sum, d) => sum + d.noShows, 0);
  const avgNoShowRate = ((totalNoShows / totalScheduled) * 100).toFixed(1);

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 20px 0', color: '#0f172a' }}>
        Appointment Trends (Last 7 Days)
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
        <div style={{ textAlign: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#3b82f6' }}>{totalScheduled}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Scheduled</div>
        </div>
        <div style={{ textAlign: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981' }}>{totalCompleted}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Completed</div>
        </div>
        <div style={{ textAlign: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#ef4444' }}>{avgNoShowRate}%</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>No-Show Rate</div>
        </div>
      </div>
      <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
        SMS reminders reduced no-shows by 30% this month
      </div>
    </div>
  );
};

interface EmergencyAlertsWidgetProps {
  alerts: Array<{
    id: string;
    time: string;
    type: 'CRITICAL' | 'URGENT' | 'MODERATE';
    patientPhone: string;
    status: 'PENDING' | 'TRANSFERRED' | 'RESOLVED';
  }>;
}

/**
 * Emergency Alerts Widget
 */
export const EmergencyAlertsWidget: React.FC<EmergencyAlertsWidgetProps> = ({ alerts }) => {
  const pendingCount = alerts.filter(a => a.status === 'PENDING').length;
  const typeColors = {
    CRITICAL: '#ef4444',
    URGENT: '#f59e0b',
    MODERATE: '#3b82f6',
  };

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          Emergency Alerts
        </h3>
        {pendingCount > 0 && (
          <div style={{ padding: '4px 12px', background: '#ef4444', borderRadius: '12px', fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>
            {pendingCount} pending
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gap: '12px' }}>
        {alerts.slice(0, 5).map((alert) => (
          <div key={alert.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: alert.status === 'PENDING' ? '#fef2f2' : '#f8fafc', borderRadius: '8px', border: alert.status === 'PENDING' ? '1px solid #fecaca' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: typeColors[alert.type] }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{alert.type}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>{alert.time}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: alert.status === 'PENDING' ? '#ef4444' : '#10b981' }}>
                {alert.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface SpecializationDistributionWidgetProps {
  data: Array<{
    specialization: string;
    appointments: number;
    revenue: number;
  }>;
}

/**
 * Specialization Distribution Widget
 */
export const SpecializationDistributionWidget: React.FC<SpecializationDistributionWidgetProps> = ({ data }) => {
  const totalAppointments = data.reduce((sum, d) => sum + d.appointments, 0);
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          Appointments by Specialization
        </h3>
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          ₹{totalRevenue.toLocaleString('en-IN')} total revenue
        </div>
      </div>
      <div style={{ display: 'grid', gap: '12px' }}>
        {data.map((item) => {
          const percentage = ((item.appointments / totalAppointments) * 100).toFixed(0);
          return (
            <div key={item.specialization} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '140px', fontSize: '13px', color: '#334155' }}>{item.specialization}</div>
              <div style={{ flex: 1, height: '24px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${percentage}%`, height: '100%', background: '#3b82f6', display: 'flex', alignItems: 'center', paddingLeft: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#ffffff' }}>{item.appointments}</span>
                </div>
              </div>
              <div style={{ width: '80px', fontSize: '12px', color: '#64748b', textAlign: 'right' }}>
                ₹{(item.revenue / 1000).toFixed(0)}K
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default {
  DoctorAvailabilityWidget,
  AppointmentTrendsWidget,
  EmergencyAlertsWidget,
  SpecializationDistributionWidget,
};
