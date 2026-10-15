/**
 * Real Estate Plot Inventory Schema
 * Dhwani SI — Layer 1 Domain Entity
 * Defines plot listing structure for layout developers
 */

import { z } from 'zod';

export const PlotStatus = z.enum(['AVAILABLE', 'BOOKED', 'RESERVED', 'SOLD']);
export const PlotFacing = z.enum(['NORTH', 'SOUTH', 'EAST', 'WEST', 'NORTH_EAST', 'NORTH_WEST', 'SOUTH_EAST', 'SOUTH_WEST']);
export const PlotType = z.enum(['RESIDENTIAL', 'COMMERCIAL', 'AGRICULTURAL', 'INDUSTRIAL']);

export const PlotSchema = z.object({
  // Primary identifiers
  id: z.string().uuid(),
  tenantId: z.string().uuid(), // Multi-tenant isolation
  plotNumber: z.string().min(1).max(20), // e.g., "A-15", "B-23"
  
  // Location details
  layoutName: z.string().min(1).max(200), // e.g., "Ballari Green Valley Layout"
  block: z.string().optional(), // e.g., "Block A", "Phase 1"
  sector: z.string().optional(),
  
  // Dimensions (in square feet)
  dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    totalArea: z.number().positive(), // Calculated: length × width
    unit: z.enum(['SQFT', 'SQYARDS', 'CENTS']).default('SQFT'),
  }),
  
  // Pricing (in INR)
  pricing: z.object({
    basePrice: z.number().positive(), // Price per sqft
    totalPrice: z.number().positive(), // Calculated: basePrice × totalArea
    offerPrice: z.number().positive().optional(), // Discounted price
    priceNegotiable: z.boolean().default(true),
    pricePerSqft: z.number().positive(), // Calculated for display
  }),
  
  // Facing and Type
  facing: PlotFacing,
  plotType: PlotType.default('RESIDENTIAL'),
  
  // Features
  features: z.object({
    cornerPlot: z.boolean().default(false),
    parkFacing: z.boolean().default(false),
    roadWidth: z.number().positive().optional(), // In feet
    nearMainRoad: z.boolean().default(false),
    nearPark: z.boolean().default(false),
    nearSchool: z.boolean().default(false),
    nearHospital: z.boolean().default(false),
    nearTemple: z.boolean().default(false),
  }),
  
  // Status and availability
  status: PlotStatus.default('AVAILABLE'),
  reservedBy: z.string().optional(), // Lead ID if reserved
  bookedBy: z.string().optional(), // Customer ID if booked
  soldTo: z.string().optional(), // Customer ID if sold
  
  // Legal and approvals
  legal: z.object({
    dcConverted: z.boolean().default(true),
    reraApproved: z.boolean().default(false),
    reraNumber: z.string().optional(),
    khataNumber: z.string().optional(),
    surveyNumber: z.string().optional(),
    titleClear: z.boolean().default(true),
    bankLoanApproved: z.boolean().default(true),
    approvedBanks: z.array(z.string()).optional(), // List of banks
  }),
  
  // Development status
  development: z.object({
    roadsDone: z.boolean().default(false),
    electricityDone: z.boolean().default(false),
    waterConnection: z.boolean().default(false),
    drainageDone: z.boolean().default(false),
    streetLights: z.boolean().default(false),
    compoundWall: z.boolean().default(false),
    undergroundDrainage: z.boolean().default(false),
  }),
  
  // Images and media
  media: z.object({
    plotImage: z.string().url().optional(),
    layoutMap: z.string().url().optional(),
    siteVideo: z.string().url().optional(),
    brochureLink: z.string().url().optional(),
  }),
  
  // Metadata
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(), // e.g., ["premium", "investment", "hot-selling"]
  
  // Timestamps
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
});

export type Plot = z.infer<typeof PlotSchema>;
export type PlotStatusType = z.infer<typeof PlotStatus>;
export type PlotFacingType = z.infer<typeof PlotFacing>;
export type PlotTypeType = z.infer<typeof PlotType>;

/**
 * CSV Import Schema for bulk plot upload
 */
export const PlotImportRowSchema = z.object({
  plotNumber: z.string(),
  block: z.string().optional(),
  length: z.string().transform(val => parseFloat(val)),
  width: z.string().transform(val => parseFloat(val)),
  facing: z.string(),
  pricePerSqft: z.string().transform(val => parseFloat(val)),
  cornerPlot: z.string().transform(val => val.toLowerCase() === 'yes' || val === 'true').optional(),
  parkFacing: z.string().transform(val => val.toLowerCase() === 'yes' || val === 'true').optional(),
  status: z.string().default('AVAILABLE'),
});

export type PlotImportRow = z.infer<typeof PlotImportRowSchema>;

/**
 * Plot Filter Schema for search
 */
export const PlotFilterSchema = z.object({
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  minArea: z.number().optional(),
  maxArea: z.number().optional(),
  facing: PlotFacing.optional(),
  status: PlotStatus.optional(),
  plotType: PlotType.optional(),
  cornerPlot: z.boolean().optional(),
  parkFacing: z.boolean().optional(),
});

export type PlotFilter = z.infer<typeof PlotFilterSchema>;
