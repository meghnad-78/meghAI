import { MeghAIServer } from '../apps/api/src/server.js';

async function runLiveMemoryVerification() {
  console.log('=== MeghAI Live Memory End-to-End Verification (Step 13) ===\n');

  const server = new MeghAIServer();
  const port = await server.start(0);
  console.log(`MeghAI API server running on port ${port}`);

  // PRE-STEP A: Clean up any prior test memory for Meghnad name
  const existingMemories = await server.db.listMemories();
  for (const m of existingMemories) {
    if (m.content.toLowerCase().includes('meghnad')) {
      console.log(`Cleaning prior test record: "${m.content}"`);
      await server.db.deleteMemory(m.id);
    }
  }

  // PRE-STEP B: Ensure "My favorite programming language is Java." exists in DB (Step 14)
  const hasJavaMemory = (await server.db.listMemories()).some(m =>
    m.content.toLowerCase().includes('favorite programming language is java')
  );
  if (!hasJavaMemory) {
    console.log('Seeding baseline memory: "My favorite programming language is Java."');
    await server.db.createMemory({
      id: `mem-seed-java-${Date.now()}`,
      userId: 'default-user',
      type: 'SEMANTIC',
      layer: 'SEMANTIC',
      content: 'My favorite programming language is Java.',
      source: 'User Entry',
      importance: 1,
      entities: [],
      tags: [],
      confidence: 0.95,
      sensitivity: 'PERSONAL',
      lifecycle: 'DURABLE',
      provenance: 'User Entry',
      accessCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userApproved: true,
      locked: false,
      pinned: false
    } as any);
  } else {
    console.log('Verified existing baseline record: "My favorite programming language is Java."');
  }

  let allPassed = true;

  // STEP 1: Command "Megh, remember that my name is Meghnad."
  console.log('\n--------------------------------------------------');
  console.log('>>> TEST 1: Send "Megh, remember that my name is Meghnad."');
  {
    const res = await fetch(`http://localhost:${port}/api/v1/input/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Megh, remember that my name is Meghnad.' })
    });
    const data = await res.json() as any;

    console.log(`<<< STATUS: ${data.status}`);
    console.log(`<<< ASSISTANT CONFIRMATION: "${data.reply}"`);

    // Verify timeline events
    const timelineRes = await fetch(`http://localhost:${port}/api/v1/timeline?limit=20`);
    const timeline = await timelineRes.json() as any[];
    const cmdEvt = timeline.find(e => e.type === 'MEMORY_COMMAND_DETECTED');
    const storedEvt = timeline.find(e => e.type === 'MEMORY_STORED');

    if (cmdEvt && cmdEvt.payload?.action === 'STORE') {
      console.log(`  ✓ MEMORY_COMMAND_DETECTED event present! (action: STORE)`);
    } else {
      console.error(`  ✗ Missing or invalid MEMORY_COMMAND_DETECTED event!`);
      allPassed = false;
    }

    if (storedEvt) {
      console.log(`  ✓ MEMORY_STORED event present in timeline!`);
    } else {
      console.error(`  ✗ Missing MEMORY_STORED event in timeline!`);
      allPassed = false;
    }

    // Verify DB persistence
    const memoriesInDb = await server.db.listMemories();
    const meghnadRecord = memoriesInDb.find(m => m.content.toLowerCase().includes('name is meghnad'));
    if (meghnadRecord) {
      console.log(`  ✓ Memory successfully persisted to database! ("${meghnadRecord.content}")`);
    } else {
      console.error(`  ✗ Memory not found in database!`);
      allPassed = false;
    }

    // Verify Memory Center API
    const memCenterRes = await fetch(`http://localhost:${port}/api/v1/memory`);
    const memCenterData = await memCenterRes.json() as any;
    const inCenter = (memCenterData.memories || []).some((m: any) =>
      m.content.toLowerCase().includes('name is meghnad')
    );
    if (inCenter) {
      console.log(`  ✓ Memory Center API successfully displays the new memory!`);
    } else {
      console.error(`  ✗ Memory Center API missing memory!`);
      allPassed = false;
    }
  }

  // STEP 2: Ask "What is my name?"
  console.log('\n--------------------------------------------------');
  console.log('>>> TEST 2: Ask "What is my name?"');
  {
    const startTime = Date.now();
    const res = await fetch(`http://localhost:${port}/api/v1/input/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'What is my name?' })
    });
    const elapsed = Date.now() - startTime;
    const data = await res.json() as any;

    console.log(`<<< STATUS: ${data.status} (${elapsed}ms)`);
    console.log(`<<< MODEL REPLY:\n${data.reply}`);

    const timelineRes = await fetch(`http://localhost:${port}/api/v1/timeline?limit=20`);
    const timeline = await timelineRes.json() as any[];
    const retrievedEvt = timeline.find(e => e.type === 'MEMORY_RETRIEVED');

    if (retrievedEvt) {
      console.log(`  ✓ MEMORY_RETRIEVED event present! (count: ${retrievedEvt.payload?.count})`);
    } else {
      console.error(`  ✗ Missing MEMORY_RETRIEVED event in timeline!`);
      allPassed = false;
    }

    if (data.reply && data.reply.toLowerCase().includes('meghnad')) {
      console.log(`  ✓ Model correctly identified Meghnad from persistent memory!`);
    } else {
      console.error(`  ✗ Model failed to answer Meghnad. Reply: "${data.reply}"`);
      allPassed = false;
    }
  }

  // STEP 3: Step 14 check: "What is my favorite programming language?"
  console.log('\n--------------------------------------------------');
  console.log('>>> TEST 3: Ask baseline query "What is my favorite programming language?"');
  {
    const startTime = Date.now();
    const res = await fetch(`http://localhost:${port}/api/v1/input/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'What is my favorite programming language?' })
    });
    const elapsed = Date.now() - startTime;
    const data = await res.json() as any;

    console.log(`<<< STATUS: ${data.status} (${elapsed}ms)`);
    console.log(`<<< MODEL REPLY:\n${data.reply}`);

    if (data.reply && data.reply.toLowerCase().includes('java')) {
      console.log(`  ✓ Baseline Java memory retrieval intact!`);
    } else {
      console.error(`  ✗ Baseline Java memory retrieval failed! Reply: "${data.reply}"`);
      allPassed = false;
    }
  }

  // STEP 4: Send "Forget that my name is Meghnad."
  console.log('\n--------------------------------------------------');
  console.log('>>> TEST 4: Send "Forget that my name is Meghnad."');
  {
    const res = await fetch(`http://localhost:${port}/api/v1/input/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Forget that my name is Meghnad.' })
    });
    const data = await res.json() as any;

    console.log(`<<< STATUS: ${data.status}`);
    console.log(`<<< ASSISTANT CONFIRMATION: "${data.reply}"`);

    const timelineRes = await fetch(`http://localhost:${port}/api/v1/timeline?limit=20`);
    const timeline = await timelineRes.json() as any[];
    const cmdEvt = timeline.find(e => e.type === 'MEMORY_COMMAND_DETECTED' && e.payload?.action === 'FORGET');
    const deletedEvt = timeline.find(e => e.type === 'MEMORY_DELETED');

    if (cmdEvt) {
      console.log(`  ✓ MEMORY_COMMAND_DETECTED event present! (action: FORGET)`);
    } else {
      console.error(`  ✗ Missing MEMORY_COMMAND_DETECTED for forget!`);
      allPassed = false;
    }

    if (deletedEvt) {
      console.log(`  ✓ MEMORY_DELETED event present in timeline!`);
    } else {
      console.error(`  ✗ Missing MEMORY_DELETED event in timeline!`);
      allPassed = false;
    }

    // Verify DB removal
    const memoriesInDb = await server.db.listMemories();
    const stillPresent = memoriesInDb.some(m => m.content.toLowerCase().includes('name is meghnad'));
    if (!stillPresent) {
      console.log(`  ✓ Memory successfully removed from database!`);
    } else {
      console.error(`  ✗ Memory still present in database after forget!`);
      allPassed = false;
    }
  }

  // STEP 5: Ask "What is my name?" after deletion
  console.log('\n--------------------------------------------------');
  console.log('>>> TEST 5: Ask "What is my name?" after memory was deleted');
  {
    const startTime = Date.now();
    const res = await fetch(`http://localhost:${port}/api/v1/input/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'What is my name?' })
    });
    const elapsed = Date.now() - startTime;
    const data = await res.json() as any;

    console.log(`<<< STATUS: ${data.status} (${elapsed}ms)`);
    console.log(`<<< MODEL REPLY:\n${data.reply}`);

    const timelineRes = await fetch(`http://localhost:${port}/api/v1/timeline?limit=5`);
    const timeline = await timelineRes.json() as any[];
    // Most recent event correlation should not have MEMORY_RETRIEVED for name
    const recentRetrieved = timeline.find(
      e => e.type === 'MEMORY_RETRIEVED' && e.correlationId === data.timelineCorrelationId
    );

    if (!recentRetrieved) {
      console.log(`  ✓ No MEMORY_RETRIEVED event emitted for deleted memory!`);
    } else {
      console.error(`  ✗ MEMORY_RETRIEVED unexpectedly emitted!`);
      allPassed = false;
    }

    if (!data.reply || !data.reply.toLowerCase().includes('meghnad')) {
      console.log(`  ✓ Model truthfully responds without the deleted memory!`);
    } else {
      console.error(`  ✗ Model still reported Meghnad despite deletion!`);
      allPassed = false;
    }
  }

  await server.stop();
  console.log(`\nMeghAI server stopped.`);

  if (allPassed) {
    console.log(`\n🎉 SUCCESS: All Step 13 & 14 end-to-end memory flows verified against live Ollama!`);
    process.exit(0);
  } else {
    console.error(`\n❌ VERIFICATION FAILED: One or more memory checks failed.`);
    process.exit(1);
  }
}

runLiveMemoryVerification().catch(err => {
  console.error('Fatal live verification error:', err);
  process.exit(1);
});
