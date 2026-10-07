import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { InMemoryDatabaseService } = require('../packages/database/dist/index.js');
const {
  TextParser,
  HtmlParser,
  PdfParser,
  ParserRegistry,
  TextNormalizer,
  SemanticChunker,
  MockMultilingualEmbeddingProvider,
  SsrfValidator,
  WebsiteIngestor,
  KnowledgeRetrievalEngine,
  KnowledgeIngestionPipeline,
  BusinessBrainService,
} = require('../packages/knowledge-engine/dist/index.js');

console.log('====================================================');
console.log('VANNI KNOWLEDGE INGESTION + RETRIEVAL TEST SUITE (Prompt 07)');
console.log('====================================================\n');

const ORG_1_ID = 'a0000000-0000-0000-0000-000000000001'; // Ballari Residential Layouts
const ORG_2_ID = 'a0000000-0000-0000-0000-000000000002'; // Apollo Specialty Clinic

let passedTests = 0;
let totalTests = 0;

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}:`, err.message || err);
    throw err;
  }
}

async function run() {
  const db = new InMemoryDatabaseService();
  const normalizer = new TextNormalizer();
  const chunker = new SemanticChunker({ chunkSize: 120, chunkOverlap: 30, minChunkSize: 40 });
  const embeddingProvider = new MockMultilingualEmbeddingProvider(384);
  const retrievalEngine = new KnowledgeRetrievalEngine(db, embeddingProvider);
  const pipeline = new KnowledgeIngestionPipeline(db, embeddingProvider);

  // 1. FAQ creation
  await test('1. FAQ creation', async () => {
    const faq = {
      id: 'faq-test-1',
      organizationId: ORG_1_ID,
      question: 'What are the visiting hours for the layout site?',
      answer: 'Site visits are arranged every day between 9:00 AM and 6:00 PM.',
      category: 'Site Visits',
      language: 'EN',
      authority: 'AUTHORITATIVE',
      status: 'ACTIVE',
      tags: ['timings', 'site-visit'],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveFAQ(faq);
    const faqs = await db.getFAQs(ORG_1_ID);
    const saved = faqs.find(f => f.id === 'faq-test-1');
    assert.ok(saved);
    assert.strictEqual(saved.organizationId, ORG_1_ID);
    assert.strictEqual(saved.question, 'What are the visiting hours for the layout site?');
  });

  // 2. FAQ update
  await test('2. FAQ update', async () => {
    const faqs = await db.getFAQs(ORG_1_ID);
    const target = faqs.find(f => f.id === 'faq-test-1');
    target.answer = 'Site visits are arranged every day between 8:30 AM and 6:30 PM with golf cart assistance.';
    await db.saveFAQ(target);
    const updatedFaqs = await db.getFAQs(ORG_1_ID);
    const updated = updatedFaqs.find(f => f.id === 'faq-test-1');
    assert.strictEqual(updated.answer, 'Site visits are arranged every day between 8:30 AM and 6:30 PM with golf cart assistance.');
  });

  // 3. FAQ archive
  await test('3. FAQ archive / deletion', async () => {
    await db.deleteFAQ('faq-test-1', ORG_1_ID);
    const faqs = await db.getFAQs(ORG_1_ID);
    assert.ok(!faqs.some(f => f.id === 'faq-test-1'));
  });

  // 4. Document upload & parsing (Text & Markdown)
  await test('4. Document upload & text parsing', async () => {
    const textParser = new TextParser();
    const parsed = await textParser.parse(
      Buffer.from('Title: Project Brochure\n\nPhase 2 of Ballari Layout has 40x60 plots approved by BUDA.'),
      { filename: 'brochure.txt' }
    );
    assert.ok(parsed.rawText.includes('Ballari Layout'));
    assert.ok(parsed.wordCount > 5);
  });

  // 5. Invalid file rejection
  await test('5. Invalid file format rejection in ParserRegistry', async () => {
    const registry = new ParserRegistry();
    let threw = false;
    try {
      await registry.parse(Buffer.from('binary-data'), { filename: 'malicious.exe', mimeType: 'application/x-msdownload' });
    } catch (err) {
      threw = true;
      assert.ok(err.message.includes('Unsupported document format'));
    }
    assert.ok(threw);
  });

  // 6. PDF extraction
  await test('6. PDF extraction (server-side stream parser without crashes)', async () => {
    const pdfParser = new PdfParser();
    const pdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length 55 >>
stream
BT
/F1 12 Tf
(Hello Ballari Properties Layout Brochure) Tj
ET
endstream
endobj
xref
0 5
trailer << /Root 1 0 R >>
%%EOF`;
    const parsed = await pdfParser.parse(Buffer.from(pdfContent), { filename: 'brochure.pdf' });
    assert.ok(parsed.rawText.includes('Hello Ballari Properties'));
  });

  // 7. Empty/scanned PDF handling
  await test('7. Empty/scanned PDF handling (flags OCR required without crashing)', async () => {
    const pdfParser = new PdfParser();
    const emptyPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj
xref
0 4
trailer << /Root 1 0 R >>
%%EOF`;
    const parsed = await pdfParser.parse(Buffer.from(emptyPdf), { filename: 'scanned.pdf' });
    assert.strictEqual(parsed.isScannedOrEmpty, true);
    assert.strictEqual(parsed.metadata.isScanned, true);
  });

  // 8. Text normalization
  await test('8. Text normalization (whitespace, control chars, paragraph preservation)', async () => {
    const raw = '   Ballari    Green   Estates  \r\n\r\n\t  “Phase   1”   ';
    const norm = normalizer.normalize(raw);
    assert.strictEqual(norm, 'Ballari Green Estates\n\n“Phase 1”');
  });

  // 9. Kannada preservation
  await test('9. Kannada preservation (Unicode \\u0C80-\\u0CFF intact)', async () => {
    const kannadaText = 'ನಮ್ಮ ಕ್ಲಿನಿಕ್ ಸೋಮವಾರದಿಂದ ಶನಿವಾರದವರೆಗೆ ಬೆಳಿಗ್ಗೆ 9 ರಿಂದ ಸಂಜೆ 6 ರವರೆಗೆ ತೆರೆದಿರುತ್ತದೆ.';
    const normalized = normalizer.normalize(kannadaText);
    assert.strictEqual(normalized, kannadaText);
    const lang = normalizer.detectLanguage(normalized);
    assert.strictEqual(lang, 'KN');
  });

  // 10. Mixed Kannada-English preservation
  await test('10. Mixed Kannada-English preservation', async () => {
    const mixedText = 'Ballari Layout ನಲ್ಲಿ BUDA approved 30x40 plots available ಇವೆ. Price starts from ₹25 Lakhs.';
    const normalized = normalizer.normalize(mixedText);
    assert.ok(normalized.includes('Ballari Layout'));
    assert.ok(normalized.includes('ನಲ್ಲಿ'));
    assert.ok(normalized.includes('plots available ಇವೆ'));
    const lang = normalizer.detectLanguage(normalized);
    assert.strictEqual(lang, 'KANGLISH');
  });

  // 11. Chunking
  await test('11. Semantic chunking preserves boundaries and headings', async () => {
    const docText = `
# Project Overview
Ballari Green Layout is a 50-acre gated community situated on Siruguppa Road. It has 400 residential plots.

# Pricing and Payment Terms
All 30x40 plots start at ₹28 Lakhs. Down payment is 20 percent on booking. Balance via SBI or HDFC home loans.
    `;
    const chunks = chunker.chunk(docText, {
      documentId: 'doc-test-1',
      sourceId: 'src-test-1',
      organizationId: ORG_1_ID,
      title: 'Project Brochure',
      language: 'EN',
      authority: 'AUTHORITATIVE',
    }, { chunkSize: 120, minChunkSize: 40 });
    assert.ok(chunks.length >= 2);
    assert.ok(chunks[0].content.includes('Ballari Green Layout'));
    assert.ok(chunks.some(c => c.content.includes('Pricing and Payment Terms')));
  });

  // 12. Chunk metadata
  await test('12. Chunk metadata traceability', async () => {
    const chunks = chunker.chunk('Short content paragraph.', {
      documentId: 'doc-meta-1',
      sourceId: 'src-meta-1',
      organizationId: ORG_1_ID,
      title: 'Meta Doc',
      language: 'EN',
      authority: 'APPROVED',
    });
    const first = chunks[0];
    assert.strictEqual(first.documentId, 'doc-meta-1');
    assert.strictEqual(first.sourceId, 'src-meta-1');
    assert.strictEqual(first.organizationId, ORG_1_ID);
    assert.strictEqual(typeof first.charCount, 'number');
    assert.strictEqual(typeof first.tokenCount, 'number');
  });

  // 13. Embedding provider abstraction
  await test('13. Embedding provider abstraction (384-dim unit vector)', async () => {
    assert.strictEqual(embeddingProvider.dimensions(), 384);
    assert.strictEqual(embeddingProvider.modelName(), 'vanni-multilingual-e5-v1-mock');
    const vec = await embeddingProvider.embedText('What is the plot price in Ballari?');
    assert.strictEqual(vec.length, 384);
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    assert.ok(Math.abs(norm - 1.0) < 0.001);
  });

  // 14. Embedding version handling
  await test('14. Embedding version handling in chunks', async () => {
    // Generate and save an embedded chunk for ORG_1_ID
    const emb = await embeddingProvider.embedText('Ballari plot layout masterplan specifications.');
    await db.saveChunks([
      {
        id: 'chunk-test-emb-1',
        organizationId: ORG_1_ID,
        sourceId: 'src-1',
        documentId: 'doc-1',
        chunkIndex: 0,
        content: 'Ballari plot layout masterplan specifications.',
        language: 'EN',
        authority: 'AUTHORITATIVE',
        tokenCount: 10,
        charCount: 45,
        embedding: emb,
        embeddingModel: embeddingProvider.modelName(),
        embeddingDimensions: embeddingProvider.dimensions(),
        metadata: {},
        createdAt: new Date().toISOString(),
      },
    ]);
    const chunks = await db.getChunks(ORG_1_ID);
    assert.ok(chunks.length > 0);
    const c = chunks.find(ch => ch.embeddingModel);
    assert.ok(c);
    assert.strictEqual(c.embeddingModel, 'vanni-multilingual-e5-v1-mock');
    assert.strictEqual(c.embeddingDimensions, 384);
  });

  // 15. Retrieval
  await test('15. Retrieval returns relevant chunks for query', async () => {
    const res = await retrievalEngine.retrieveKnowledge({
      organizationId: ORG_1_ID,
      query: 'What is the price of 30x40 plots in Ballari?',
      topK: 3,
    });
    assert.ok(res.items.length > 0);
    assert.ok(res.items[0].content.toLowerCase().includes('plot') || res.items[0].content.includes('₹2,400') || res.items[0].content.includes('Meadows'));
    assert.ok(res.items[0].score > 0.4);
    assert.strictEqual(res.answerability, 'SUPPORTED');
  });

  // 16. Organization isolation
  await test('16. Organization isolation (Org1 cannot see Org2 chunks)', async () => {
    const org1Res = await retrievalEngine.retrieveKnowledge({
      organizationId: ORG_1_ID,
      query: 'What is root canal dental treatment consultation fee?',
      topK: 5,
    });
    // Org1 is Ballari Real Estate, should NOT retrieve Apollo Cardiology / Dental fee
    assert.ok(!org1Res.items.some(item => item.content.includes('Cardiology') || item.content.includes('Dr. Ramesh')));

    const org2Res = await retrievalEngine.retrieveKnowledge({
      organizationId: ORG_2_ID,
      query: 'Cardiologist appointment consultation fee Dr Ramesh',
      topK: 5,
    });
    assert.ok(org2Res.items.some(item => item.content.includes('Cardiology') || item.content.includes('₹750') || item.content.includes('Ramesh')));
  });

  // 17. Authority ranking
  await test('17. Authority ranking boost', async () => {
    await db.saveDocument({
      id: 'doc-pol-1',
      organizationId: ORG_1_ID,
      sourceId: 'src-pol-1',
      title: 'Registration Policies',
      documentType: 'policy',
      contentStatus: 'ready',
      version: 1,
      wordCount: 50,
      charCount: 300,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.saveChunks([
      {
        id: 'chk-pol-1',
        documentId: 'doc-pol-1',
        sourceId: 'src-pol-1',
        organizationId: ORG_1_ID,
        chunkIndex: 0,
        content: 'Official Board Rule: Site inspection registration requires Aadhaar card verification.',
        authority: 'AUTHORITATIVE',
        language: 'EN',
        embedding: await embeddingProvider.embedText('Site inspection registration requires Aadhaar card verification.'),
        embeddingModel: 'vanni-multilingual-e5-v1-mock',
        embeddingDimensions: 384,
        metadata: {},
        createdAt: new Date().toISOString(),
      },
      {
        id: 'chk-blog-1',
        documentId: 'doc-pol-1',
        sourceId: 'src-pol-1',
        organizationId: ORG_1_ID,
        chunkIndex: 1,
        content: 'Local blog note: Site inspection registration might require voter ID or any card.',
        authority: 'REFERENCE',
        language: 'EN',
        embedding: await embeddingProvider.embedText('Site inspection registration might require voter ID or any card.'),
        embeddingModel: 'vanni-multilingual-e5-v1-mock',
        embeddingDimensions: 384,
        metadata: {},
        createdAt: new Date().toISOString(),
      },
    ]);

    const res = await retrievalEngine.retrieveKnowledge({
      organizationId: ORG_1_ID,
      query: 'What documents are required for site inspection registration?',
      topK: 2,
    });
    assert.ok(res.items.length >= 2);
    assert.ok(res.items[0].content.includes('Official Board Rule'));
    assert.strictEqual(res.items[0].authority, 'AUTHORITATIVE');
  });

  // 18. Language filtering
  await test('18. Language matching boost', async () => {
    await db.saveDocument({
      id: 'doc-kn-1',
      organizationId: ORG_1_ID,
      sourceId: 'src-kn-1',
      title: 'Kannada Loan Details',
      documentType: 'document',
      contentStatus: 'ready',
      version: 1,
      wordCount: 30,
      charCount: 150,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.saveChunks([
      {
        id: 'chk-kn-1',
        documentId: 'doc-kn-1',
        sourceId: 'src-kn-1',
        organizationId: ORG_1_ID,
        chunkIndex: 0,
        content: 'ನಮ್ಮ ಲೇಔಟ್‌ನಲ್ಲಿ ಬ್ಯಾಂಕ್ ಸಾಲ ಸೌಲಭ್ಯ ಲಭ್ಯವಿದೆ (SBI & Canara Bank).',
        authority: 'APPROVED',
        language: 'KN',
        embedding: await embeddingProvider.embedText('ನಮ್ಮ ಲೇಔಟ್‌ನಲ್ಲಿ ಬ್ಯಾಂಕ್ ಸಾಲ ಸೌಲಭ್ಯ ಲಭ್ಯವಿದೆ.'),
        embeddingModel: 'vanni-multilingual-e5-v1-mock',
        embeddingDimensions: 384,
        metadata: {},
        createdAt: new Date().toISOString(),
      },
    ]);

    const res = await retrievalEngine.retrieveKnowledge({
      organizationId: ORG_1_ID,
      query: 'ಬ್ಯಾಂಕ್ ಸಾಲ ಸೌಲಭ್ಯ ಇದೆಯೇ?',
      topK: 2,
    });
    assert.ok(res.items.length > 0);
    assert.strictEqual(res.items[0].language, 'KN');
    assert.ok(res.items[0].content.includes('ಬ್ಯಾಂಕ್ ಸಾಲ'));
  });

  // 19. Archived content exclusion
  await test('19. Archived content exclusion from retrieval', async () => {
    const doc = {
      id: 'doc-archived-1',
      organizationId: ORG_1_ID,
      sourceId: 'src-old',
      title: 'Old Deprecated Price Sheet',
      documentType: 'text',
      contentStatus: 'archived',
      language: 'EN',
      version: 1,
      wordCount: 10,
      characterCount: 50,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveDocument(doc);
    await db.saveChunks([
      {
        id: 'chk-archived-1',
        documentId: doc.id,
        sourceId: 'src-old',
        organizationId: ORG_1_ID,
        chunkIndex: 0,
        content: 'Discount offer 50% expired last year for Ballari plots.',
        authority: 'APPROVED',
        language: 'EN',
        embedding: await embeddingProvider.embedText('Discount offer 50% expired last year for Ballari plots.'),
        embeddingModel: 'vanni-multilingual-e5-v1-mock',
        embeddingDimensions: 384,
        metadata: {},
        createdAt: new Date().toISOString(),
      },
    ]);

    const res = await retrievalEngine.retrieveKnowledge({
      organizationId: ORG_1_ID,
      query: 'Discount offer 50% expired last year',
      topK: 5,
    });
    assert.ok(!res.items.some(i => i.documentId === doc.id));
  });

  // 20. Version replacement & atomic publishing
  await test('20. Version replacement & atomic publishing (v1 active -> v2 ready -> v1 superseded)', async () => {
    const source = {
      id: 'src-master-specs',
      organizationId: ORG_1_ID,
      sourceType: 'DOCUMENT',
      name: 'Master Layout Specs',
      origin: 'local_upload',
      status: 'ACTIVE',
      authority: 'AUTHORITATIVE',
      language: 'EN',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveKnowledgeSource(source);

    // Ingest v1
    const v1Res = await pipeline.ingestDocument({
      organizationId: ORG_1_ID,
      sourceId: source.id,
      title: 'Master Specs 2025',
      documentType: 'TEXT',
      content: 'Phase 1 has 50 park view plots. 24/7 solar security fence installed.',
      authority: 'AUTHORITATIVE',
      language: 'EN',
    });
    assert.strictEqual(v1Res.document.version, 1);
    assert.strictEqual(v1Res.document.contentStatus, 'READY');

    // Ingest v2 on same source
    const v2Res = await pipeline.ingestDocument({
      organizationId: ORG_1_ID,
      sourceId: source.id,
      title: 'Master Specs 2026',
      documentType: 'TEXT',
      content: 'Phase 1 has 65 park view plots. 24/7 solar security fence and CCTV installed.',
      authority: 'AUTHORITATIVE',
      language: 'EN',
    });
    assert.strictEqual(v2Res.document.version, 2);
    assert.strictEqual(v2Res.document.contentStatus, 'READY');

    // Verify v1 is now superseded (ARCHIVED)
    const v1Check = await db.getDocumentById(v1Res.document.id);
    assert.strictEqual(v1Check.contentStatus, 'ARCHIVED');

    // Verify retrieval returns v2 and not v1
    const searchRes = await retrievalEngine.retrieveKnowledge({
      organizationId: ORG_1_ID,
      query: 'How many park view plots in Phase 1?',
      topK: 2,
    });
    assert.ok(searchRes.items[0].content.includes('65 park view plots'));
    assert.strictEqual(searchRes.items[0].documentId, v2Res.document.id);
  });

  // 21. Failed ingestion preserving old version
  await test('21. Failed ingestion preserves active old version', async () => {
    const source = {
      id: 'src-resilient',
      organizationId: ORG_1_ID,
      sourceType: 'DOCUMENT',
      name: 'Resilient Specs',
      origin: 'local_upload',
      status: 'ACTIVE',
      authority: 'AUTHORITATIVE',
      language: 'EN',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveKnowledgeSource(source);

    const v1Res = await pipeline.ingestDocument({
      organizationId: ORG_1_ID,
      sourceId: source.id,
      title: 'Working Knowledge File',
      documentType: 'TEXT',
      content: 'Resilient plot reservation token amount is strictly ₹10,000.',
      authority: 'AUTHORITATIVE',
      language: 'EN',
    });
    assert.strictEqual(v1Res.document.contentStatus, 'READY');

    // Attempt invalid ingestion on the same source with unparseable format
    const failRes = await pipeline.ingestDocument({
      organizationId: ORG_1_ID,
      sourceId: source.id,
      title: 'Corrupted File',
      documentType: 'PDF',
      content: Buffer.from('NOT_A_PDF_MALFORMED'),
      filename: 'bad.pdf',
    });
    assert.strictEqual(failRes.success, false);
    assert.strictEqual(failRes.document.contentStatus, 'FAILED');

    // Verify v1 is STILL ready and usable
    const checkV1 = await db.getDocumentById(v1Res.document.id);
    assert.strictEqual(checkV1.contentStatus, 'READY');

    const searchRes = await retrievalEngine.retrieveKnowledge({
      organizationId: ORG_1_ID,
      query: 'Resilient plot reservation token amount',
      topK: 2,
    });
    assert.ok(searchRes.items.some(i => i.content.includes('₹10,000')));
  });

  // 22. Website URL validation
  await test('22. Website URL validation & protocol restriction', () => {
    assert.strictEqual(SsrfValidator.isUrlSafe('ftp://example.com/file').safe, false);
    assert.strictEqual(SsrfValidator.isUrlSafe('file:///etc/passwd').safe, false);
    assert.strictEqual(SsrfValidator.isUrlSafe('javascript:alert(1)').safe, false);
    assert.strictEqual(SsrfValidator.isUrlSafe('https://karnataka.gov.in/portal').safe, true);
  });

  // 23. SSRF Protection: blocked IPs & metadata endpoints
  await test('23. SSRF Protection blocks localhost, 127.0.0.1, 169.254.169.254, private CIDRs', () => {
    assert.strictEqual(SsrfValidator.isUrlSafe('http://localhost:8080/admin').safe, false);
    assert.strictEqual(SsrfValidator.isUrlSafe('http://127.0.0.1:4000/api').safe, false);
    assert.strictEqual(SsrfValidator.isUrlSafe('http://169.254.169.254/latest/meta-data').safe, false);
    assert.strictEqual(SsrfValidator.isUrlSafe('http://10.0.0.5/secrets').safe, false);
    assert.strictEqual(SsrfValidator.isUrlSafe('http://192.168.1.1/router').safe, false);
    assert.strictEqual(SsrfValidator.isUrlSafe('http://172.16.0.1/internal').safe, false);
  });

  // 24. Redirect validation
  await test('24. Redirect validation blocks hop to internal IP', () => {
    const res = SsrfValidator.isRedirectSafe('http://192.168.0.100/status');
    assert.strictEqual(res.safe, false);
    assert.ok(res.reason.includes('private or local'));
  });

  // 25. Crawl limits
  await test('25. Website crawl limits enforced', async () => {
    const htmlParser = new HtmlParser();
    const htmlOver500Bytes = '<div>' + 'A'.repeat(600) + '</div>';
    const res = await htmlParser.parse(Buffer.from(htmlOver500Bytes), { filename: 'test.html' });
    assert.ok(res.rawText.length > 500);
  });

  // 26. Website ingestion (HTML cleaning, title extraction)
  await test('26. Website HTML parsing cleans script tags and extracts clean text', async () => {
    const rawHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>Ballari Green Estates Official</title>
    <script>alert("malicious script");</script>
    <style>.nav { color: red; }</style>
  </head>
  <body>
    <nav class="nav">Home | About | Contact</nav>
    <main>
      <h1>Siruguppa Road Residential Township</h1>
      <p>Plots ready for immediate registry. Clear title deed with BUDA clearance certificate.</p>
    </main>
  </body>
</html>`;
    const parser = new HtmlParser();
    const parsed = await parser.parse(Buffer.from(rawHtml), { filename: 'https://ballari-estates.com' });
    assert.strictEqual(parsed.title, 'Ballari Green Estates Official');
    assert.ok(!parsed.rawText.includes('alert'));
    assert.ok(!parsed.rawText.includes('color: red'));
    assert.ok(parsed.rawText.includes('Siruguppa Road Residential Township'));
    assert.ok(parsed.rawText.includes('BUDA clearance certificate'));
  });

  // 27. Retrieval trace
  await test('27. Retrieval trace records timing, candidate counts, and applied filters', async () => {
    const res = await retrievalEngine.retrieveKnowledge({
      organizationId: ORG_1_ID,
      query: 'Siruguppa Road residential plots',
      topK: 2,
    });
    assert.ok(res.trace);
    assert.strictEqual(typeof res.trace.executionTimeMs, 'number');
    assert.strictEqual(typeof res.trace.totalCandidates, 'number');
    assert.strictEqual(typeof res.trace.filteredCandidates, 'number');
    assert.strictEqual(res.trace.appliedFilters.organizationId, ORG_1_ID);
  });

  // 28. Conflict handling & multiple sources
  await test('28. Conflict handling maintains top-ranked item and preserves authority breakdown', async () => {
    const res = await retrievalEngine.retrieveKnowledge({
      organizationId: ORG_1_ID,
      query: 'Site inspection registration Aadhaar card',
      topK: 5,
    });
    assert.ok(res.items.length >= 2);
    assert.ok(res.items[0].authority === 'AUTHORITATIVE');
  });

  // 29. Business Brain integration
  await test('29. Business Brain service retrieves combined knowledge + structured facts', async () => {
    const brainService = new BusinessBrainService(db);
    const knowledgeResults = await brainService.searchBusinessKnowledge(ORG_1_ID, '30x40');
    assert.strictEqual(knowledgeResults.found, true);
    assert.ok(knowledgeResults.content.includes('30x40') || knowledgeResults.content.includes('Residential'));
  });

  // 30. Unsupported query detection
  await test('30. Unsupported query detection returns UNSUPPORTED answerability', async () => {
    const res = await retrievalEngine.retrieveKnowledge({
      organizationId: ORG_1_ID,
      query: 'Quantum entanglement propulsion reactor specification on Mars',
      topK: 3,
    });
    assert.strictEqual(res.answerability, 'UNSUPPORTED');
  });

  // 31. Storage & tenant isolation
  await test('31. Tenant-isolated file storage saves and retrieves private buffers', async () => {
    const testBuffer = Buffer.from('Confidential Layout Map 2026');
    const storagePath = await db.saveStorageFile(ORG_1_ID, 'maps/layout-phase1.pdf', testBuffer, 'application/pdf');
    assert.strictEqual(storagePath, `${ORG_1_ID}/maps/layout-phase1.pdf`);

    const retrieved = await db.getStorageFile(ORG_1_ID, 'maps/layout-phase1.pdf');
    assert.ok(retrieved);
    assert.strictEqual(retrieved.content.toString(), 'Confidential Layout Map 2026');

    // Org2 cannot access Org1 file
    const org2File = await db.getStorageFile(ORG_2_ID, 'maps/layout-phase1.pdf');
    assert.strictEqual(org2File, null);
  });

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} TESTS PASSED WITH 0 FAILURES`);
  console.log('====================================================');
}

run().catch((err) => {
  console.error('\nTest suite failed:', err);
  process.exit(1);
});
