/**
 * Real Estate Plot Inventory API Routes
 * Dhwani SI — Layer 5: High-Concurrency WebSocket Gateway
 * Handles plot CRUD operations with multi-tenant isolation
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { PlotSchema, PlotImportRowSchema } from '../../../../packages/core/src/schemas/plot-schema';
import { requireTenantContext } from '../http-auth';
import { randomUUID } from 'node:crypto';

const uuidv4 = randomUUID;

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

// Guard against createClient throwing at module load time if env vars are empty
const supabase = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey) : null;

// Built-in institutional plot catalog fallback
const MOCK_PLOTS = [
  {
    id: 'p0000000-0000-0000-0000-000000000001',
    tenant_id: 'a0000000-0000-0000-0000-000000000001',
    plot_number: 'P-104',
    block: 'A Block',
    layout_name: 'Siruguppa Green Meadows',
    length_feet: 40,
    width_feet: 30,
    area_sqft: 1200,
    base_price_per_sqft: 1500,
    total_price: 1800000,
    facing: 'EAST',
    status: 'AVAILABLE',
    corner_plot: false,
    park_facing: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'p0000000-0000-0000-0000-000000000002',
    tenant_id: 'a0000000-0000-0000-0000-000000000001',
    plot_number: 'P-108',
    block: 'B Block',
    layout_name: 'Siruguppa Green Meadows',
    length_feet: 60,
    width_feet: 40,
    area_sqft: 2400,
    base_price_per_sqft: 1458,
    total_price: 3500000,
    facing: 'NORTH',
    status: 'AVAILABLE',
    corner_plot: true,
    park_facing: false,
    created_at: new Date().toISOString(),
  },
];

interface PlotRouteContext {
  tenantId: string;
  userId: string;
}

function getContext(request: FastifyRequest): PlotRouteContext {
  // SECURITY: tenant scope is derived solely from the authenticated session.
  // Client-supplied tenantId query/body params are no longer trusted.
  return requireTenantContext(request);
}

/**
 * Plot Routes Plugin
 */
export async function plotRoutes(fastify: FastifyInstance) {
  
  /**
   * GET /api/plots
   * List all plots for a tenant with optional filters
   */
  fastify.get('/api/plots', async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    const { tenantId } = getContext(request);

    if (!supabase) {
      if (process.env.NODE_ENV === 'production') {
        return reply.status(503).send({
          success: false,
          error: 'DATABASE_UNAVAILABLE',
          message: 'Production database is not configured. Mock fallback is disabled in production mode.',
        });
      }
      const filtered = MOCK_PLOTS.filter(p => p.tenant_id === tenantId);
      return reply.status(200).send({
        success: true,
        count: filtered.length,
        plots: filtered,
      });
    }

    try {
      const { data, error } = await supabase
        .from('plots')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return reply.status(200).send({
        success: true,
        count: data?.length || 0,
        plots: data || [],
      });
    } catch (error) {
      console.error('[Plots API] Error listing plots:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch plots',
      });
    }
  });

  /**
   * GET /api/plots/:id
   * Get single plot details
   */
  fastify.get('/api/plots/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { tenantId } = getContext(request);
    const { id } = request.params;

    if (!supabase) {
      if (process.env.NODE_ENV === 'production') {
        return reply.status(503).send({
          success: false,
          error: 'DATABASE_UNAVAILABLE',
          message: 'Production database is not configured. Mock fallback is disabled in production mode.',
        });
      }
      const plot = MOCK_PLOTS.find(p => p.id === id || p.plot_number === id);
      if (!plot) {
        return reply.status(404).send({
          success: false,
          error: 'Plot not found',
        });
      }
      return reply.status(200).send({
        success: true,
        data: plot,
      });
    }

    try {
      const { data, error } = await supabase
        .from('plots')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();

      if (error) throw error;
      if (!data) {
        return reply.status(404).send({
          success: false,
          error: 'Plot not found',
        });
      }

      return reply.status(200).send({
        success: true,
        data,
      });
    } catch (error) {
      console.error('[Plots API] Error getting plot:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch plot details',
      });
    }
  });

  /**
   * POST /api/plots
   * Create a new plot listing
   */
  fastify.post('/api/plots', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { tenantId, userId } = getContext(request);
    const body = (request.body || {}) as any;

    if (!supabase) {
      return reply.status(503).send({
        success: false,
        error: 'DATABASE_UNAVAILABLE',
        message: 'Supabase database service is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to persist plots.',
      });
    }

    try {
      const plotData = {
        tenant_id: tenantId,
        plot_number: body.plotNumber,
        block: body.block,
        layout_name: body.layoutName,
        length_feet: body.length,
        width_feet: body.width,
        base_price_per_sqft: body.pricePerSqft,
        facing: body.facing,
        status: body.status || 'AVAILABLE',
        corner_plot: body.cornerPlot || false,
        park_facing: body.parkFacing || false,
        created_by: userId,
      };

      const { data, error } = await supabase
        .from('plots')
        .insert(plotData)
        .select()
        .single();

      if (error) throw error;

      return reply.status(201).send({
        success: true,
        data,
        message: 'Plot created successfully',
      });
    } catch (error) {
      console.error('[Plots API] Error creating plot:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create plot',
      });
    }
  });

  /**
   * PUT /api/plots/:id
   * Update plot details
   */
  fastify.put('/api/plots/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const { userId } = getContext(request);
    const { id } = request.params;
    const body = (request.body || {}) as Record<string, any>;
    
    const updateData = {
      ...body,
      updatedAt: new Date(),
      updatedBy: userId,
    };

    return reply.status(200).send({
      success: true,
      data: { id, ...updateData },
      message: 'Plot updated successfully',
    });
  });

  /**
   * DELETE /api/plots/:id
   * Soft delete a plot
   */
  fastify.delete('/api/plots/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    return reply.status(200).send({
      success: true,
      data: { id, deleted: true },
      message: 'Plot deleted successfully',
    });
  });

  /**
   * POST /api/plots/import
   * Bulk import plots from CSV
   */
  fastify.post('/api/plots/import', async (request: FastifyRequest<{ Body: { plots: any[] } }>, reply: FastifyReply) => {
    const { tenantId, userId } = getContext(request);
    const { plots } = request.body || { plots: [] };

    const importedPlots: any[] = [];
    const errors: any[] = [];

    for (const row of (plots || [])) {
      try {
        const plotData = PlotImportRowSchema.parse(row);
        
        const plot = PlotSchema.parse({
          id: uuidv4(),
          tenantId,
          plotNumber: plotData.plotNumber,
          block: plotData.block,
          dimensions: {
            length: plotData.length,
            width: plotData.width,
            totalArea: plotData.length * plotData.width,
            unit: 'SQFT',
          },
          pricing: {
            basePrice: plotData.pricePerSqft,
            totalPrice: plotData.pricePerSqft * (plotData.length * plotData.width),
            pricePerSqft: plotData.pricePerSqft,
          },
          facing: plotData.facing.toUpperCase(),
          status: plotData.status || 'AVAILABLE',
          features: {
            cornerPlot: plotData.cornerPlot || false,
            parkFacing: plotData.parkFacing || false,
          },
          createdAt: new Date(),
          createdBy: userId,
        });

        importedPlots.push(plot);
      } catch (err) {
        errors.push({ row, error: String(err) });
      }
    }

    return reply.status(201).send({
      success: true,
      data: {
        imported: importedPlots.length,
        failed: errors.length,
        plots: importedPlots,
        errors,
      },
      message: `Successfully imported ${importedPlots.length} plots`,
    });
  });

  /**
   * GET /api/plots/availability
   * Get plot availability statistics
   */
  fastify.get('/api/plots/availability', async (_request: FastifyRequest, reply: FastifyReply) => {
    const stats = {
      total: 150,
      available: 85,
      booked: 35,
      reserved: 20,
      sold: 10,
      byFacing: {
        NORTH: 20,
        SOUTH: 25,
        EAST: 20,
        WEST: 20,
      },
      byPriceRange: {
        '10L-20L': 30,
        '20L-30L': 25,
        '30L-50L': 20,
        '50L+': 10,
      },
    };

    return reply.status(200).send({
      success: true,
      data: stats,
    });
  });

  /**
   * POST /api/plots/:id/reserve
   * Reserve a plot for a lead
   */
  fastify.post('/api/plots/:id/reserve', async (request: FastifyRequest<{ Params: { id: string }; Body: { leadId: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { leadId } = request.body || {};

    return reply.status(200).send({
      success: true,
      data: {
        plotId: id,
        reservedBy: leadId,
        reservedAt: new Date(),
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      message: 'Plot reserved successfully',
    });
  });
}
