const { Client } = require('pg');
require('dotenv').config();

// Set to true to preview changes without applying them
const DRY_RUN = false;

async function cleanup() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:haris.exe@localhost:5432/CRM'
  });

  try {
    await client.connect();
    console.log('Connected to database. Starting cleanup...\n');
    if (DRY_RUN) console.log('*** DRY RUN MODE: No changes will be saved ***\n');

    // ============================================================
    // PART 1: Fix leads/deals with invalid stage keys (UUIDs, etc.)
    // ============================================================
    console.log('=== PART 1: Fixing invalid stage keys ===');

    const stagesRes = await client.query('SELECT org_id, stage_key, pipeline FROM pipeline_stages');
    const validStagesMap = {};

    stagesRes.rows.forEach(row => {
      const key = `${row.org_id}_${row.pipeline}`;
      if (!validStagesMap[key]) validStagesMap[key] = new Set();
      validStagesMap[key].add(row.stage_key);
    });

    // Leads with invalid stage
    const leadsRes = await client.query('SELECT id, org_id, status, stage, title FROM leads');
    const leadsToFix = [];
    for (const lead of leadsRes.rows) {
      if (!lead.org_id) continue;
      const validStages = validStagesMap[`${lead.org_id}_leads`] || new Set();
      const isStatusInvalid = lead.status && !validStages.has(lead.status);
      const isStageInvalid = lead.stage && !validStages.has(lead.stage);
      if (isStatusInvalid || isStageInvalid) {
        leadsToFix.push({ id: lead.id, org_id: lead.org_id, title: lead.title, oldStatus: lead.status, oldStage: lead.stage });
      }
    }

    // Deals with invalid stage
    const dealsRes = await client.query('SELECT id, org_id, status, stage, title FROM deals');
    const dealsInvalidStage = [];
    for (const deal of dealsRes.rows) {
      if (!deal.org_id) continue;
      const validStages = validStagesMap[`${deal.org_id}_deals`] || new Set();
      const isStageInvalid = deal.stage && !validStages.has(deal.stage);
      if (isStageInvalid) {
        dealsInvalidStage.push({ id: deal.id, org_id: deal.org_id, title: deal.title, oldStatus: deal.status, oldStage: deal.stage });
      }
    }

    console.log(`  Leads with invalid stage: ${leadsToFix.length}`);
    console.log(`  Deals with invalid stage: ${dealsInvalidStage.length}`);

    // Ensure 'unqualified' stage exists for affected orgs
    const orgIdsForStageCreation = new Set([
      ...leadsToFix.map(r => r.org_id),
      ...dealsInvalidStage.map(r => r.org_id)
    ]);

    for (const orgId of orgIdsForStageCreation) {
      if (!orgId) continue;
      const check = await client.query('SELECT id FROM pipeline_stages WHERE org_id = $1 AND stage_key = $2 LIMIT 1', [orgId, 'unqualified']);
      if (check.rowCount === 0) {
        console.log(`  Creating 'unqualified' stage for org ${orgId}...`);
        if (!DRY_RUN) {
          await client.query(`INSERT INTO pipeline_stages (id, org_id, stage_key, stage_label, pipeline, is_active, "order") VALUES (gen_random_uuid(), $1, 'unqualified', 'unqualified', 'leads', true, 10)`, [orgId]);
          await client.query(`INSERT INTO pipeline_stages (id, org_id, stage_key, stage_label, pipeline, is_active, "order") VALUES (gen_random_uuid(), $1, 'unqualified', 'unqualified', 'deals', true, 10) ON CONFLICT DO NOTHING`, [orgId]);
        }
      }
    }

    if (!DRY_RUN) {
      if (leadsToFix.length > 0) {
        await client.query(`UPDATE leads SET status = 'unqualified', stage = 'unqualified' WHERE id = ANY($1)`, [leadsToFix.map(l => l.id)]);
        console.log(`  ✓ Fixed ${leadsToFix.length} leads → stage/status set to 'unqualified'`);
      }
      if (dealsInvalidStage.length > 0) {
        await client.query(`UPDATE deals SET stage = 'unqualified' WHERE id = ANY($1)`, [dealsInvalidStage.map(d => d.id)]);
        console.log(`  ✓ Fixed ${dealsInvalidStage.length} deals → stage set to 'unqualified'`);
      }
    }

    // ============================================================
    // PART 2: Fix deals where status has a stage value instead of
    //         a proper deal status (open/won/lost)
    // ============================================================
    console.log('\n=== PART 2: Fixing deal status values ===');

    const validDealStatuses = ['open', 'won', 'lost', 'unqualified'];

    const dealsWithBadStatus = await client.query(`
      SELECT id, title, status, stage FROM deals 
      WHERE status IS NOT NULL 
      AND LOWER(status) NOT IN ('open', 'won', 'lost', 'unqualified')
    `);

    console.log(`  Deals with stage value in status column: ${dealsWithBadStatus.rowCount}`);

    if (dealsWithBadStatus.rowCount > 0) {
      // Show a sample
      const samples = dealsWithBadStatus.rows.slice(0, 5);
      console.log('  Sample records:');
      samples.forEach(d => {
        console.log(`    "${d.title}" — status: "${d.status}", stage: "${d.stage}"`);
      });

      if (!DRY_RUN) {
        // For deals whose status is NOT a valid deal status, reset to 'open'
        // but keep the stage value intact (that's the pipeline position)
        const badIds = dealsWithBadStatus.rows.map(d => d.id);
        await client.query(`UPDATE deals SET status = 'open' WHERE id = ANY($1)`, [badIds]);
        console.log(`  ✓ Fixed ${dealsWithBadStatus.rowCount} deals → status set to 'open'`);
      }
    }

    console.log('\n=== Cleanup complete ===');

  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await client.end();
  }
}

cleanup();
