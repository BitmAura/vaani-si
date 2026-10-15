/**
 * Healthcare Compliance Badges Component
 * VANNI — Layer 6 Enterprise Portal
 * Displays HIPAA, ABDM, ISO 27001, and data localization badges
 */

import React from 'react';

interface ComplianceBadgeProps {
  type: 'HIPAA' | 'ABDM' | 'ISO_27001' | 'DATA_LOCALIZATION';
  compact?: boolean;
}

const badgeConfig = {
  HIPAA: {
    label: 'HIPAA Compliant',
    icon: '🔒',
    description: 'Health Insurance Portability and Accountability Act',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
  },
  ABDM: {
    label: 'ABDM Compatible',
    icon: '🏥',
    description: 'Ayushman Bharat Digital Mission Integration',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
  },
  ISO_27001: {
    label: 'ISO 27001 Certified',
    icon: '✓',
    description: 'Enterprise-grade Information Security Management',
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.1)',
  },
  DATA_LOCALIZATION: {
    label: 'Data in India',
    icon: '🇮🇳',
    description: 'All patient data stored in Mumbai data centers',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
  },
};

export const ComplianceBadge: React.FC<ComplianceBadgeProps> = ({ type, compact = false }) => {
  const config = badgeConfig[type];

  if (compact) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          background: config.bgColor,
          border: `1px solid ${config.color}33`,
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 600,
          color: config.color,
        }}
      >
        <span>{config.icon}</span>
        <span>{config.label}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          background: config.bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          flexShrink: 0,
        }}
      >
        {config.icon}
      </div>
      <div>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: config.color,
            marginBottom: '4px',
          }}
        >
          {config.label}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: '#64748b',
            lineHeight: '1.5',
          }}
        >
          {config.description}
        </div>
      </div>
    </div>
  );
};

/**
 * All Compliance Badges Component
 * Displays all healthcare compliance badges in a grid
 */
export const AllComplianceBadges: React.FC = () => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '16px',
      }}
    >
      <ComplianceBadge type="HIPAA" />
      <ComplianceBadge type="ABDM" />
      <ComplianceBadge type="ISO_27001" />
      <ComplianceBadge type="DATA_LOCALIZATION" />
    </div>
  );
};

/**
 * Compact Compliance Banner
 * Single-line display of all compliance badges
 */
export const CompactComplianceBanner: React.FC = () => {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(59, 130, 246, 0.05))',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}
    >
      <ComplianceBadge type="HIPAA" compact />
      <ComplianceBadge type="ABDM" compact />
      <ComplianceBadge type="ISO_27001" compact />
      <ComplianceBadge type="DATA_LOCALIZATION" compact />
    </div>
  );
};

export default ComplianceBadge;
