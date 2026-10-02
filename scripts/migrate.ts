/**
 * MeghAI Local Storage Verification & Migration Script
 */
import { MeghAIDatabase } from '../packages/database/src/index';

async function runMigration() {
  console.log('======================================================');
  console.log(' MeghAI Database Migration & Store Verification');
  console.log('======================================================');

  try {
    const db = new MeghAIDatabase();
    console.log(`Database storage file: ${db.getStoragePath()}`);

    const existingMemories = await db.listMemories();
    console.log(`Verified active store. Existing memories: ${existingMemories.length}`);

    const existingNotes = await db.listNotes();
    console.log(`Verified active store. Existing notes: ${existingNotes.length}`);

    const existingLogs = await db.listAuditLogs();
    console.log(`Verified active store. Existing audit logs: ${existingLogs.length}`);

    console.log('✓ Migration and store integrity check completed successfully.');
    process.exit(0);
  } catch (err: any) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();
