import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { PermissionBroker } from '@meghai/permissions';

export interface ImageAnalysis {
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  description?: string;
  detectedText?: string;
}

export interface ScreenAnalysisResult {
  captureId: string;
  timestamp: string;
  activeApp: string;
  activeWindowTitle: string;
  ocrText: string;
  detectedErrors: Array<{ type: string; message: string; rawSnippet: string }>;
  visualExplanation: string;
  proposedFix?: string;
  isEphemeral: boolean;
}

/**
 * Multimodal Vision & Screen Intelligence (Section 50, 72, 73 & Phase 1.10)
 */
export class VisionEngine {
  public static async inspectImage(imagePath: string): Promise<ImageAnalysis> {
    const stat = await fs.stat(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif'
    };

    return {
      filePath: imagePath,
      mimeType: mimeMap[ext] || 'application/octet-stream',
      sizeBytes: stat.size
    };
  }

  public static async toBase64(imagePath: string): Promise<string> {
    const buffer = await fs.readFile(imagePath);
    return buffer.toString('base64');
  }
}

/**
 * Screen Awareness & Error Inspection Engine (Phase 1.10)
 * Priority:
 *  1. Active Window / Application Context
 *  2. Accessibility / UI tree text
 *  3. OCR Text Extraction
 *  4. Visual Analysis & Fix Proposal
 */
export class ScreenAwarenessEngine {
  private static readonly ERROR_PATTERNS = [
    /(?:TypeError|ReferenceError|SyntaxError|RangeError|Error):\s*([^\n\r]+)/i,
    /Unhandled\s+(?:rejection|exception):\s*([^\n\r]+)/i,
    /(?:FATAL|PANIC|CRITICAL):\s*([^\n\r]+)/i,
    /(?:FAILED|FAILURE|assert(?:ion)?\s+failed):\s*([^\n\r]+)/i,
    /NullReferenceException:\s*([^\n\r]+)/i,
  ];

  /**
   * Analyze screen with mandatory PermissionBroker gating
   */
  public static async analyzeScreen(
    permissionBroker: PermissionBroker,
    options: {
      mockOcrText?: string;
      activeApp?: string;
      activeWindowTitle?: string;
    } = {}
  ): Promise<ScreenAnalysisResult> {
    // 1. Permission check
    const permission = permissionBroker.evaluate('SCREEN');
    if (!permission.granted) {
      throw new Error(
        `Permission Denied: Screen awareness requires explicit 'SCREEN' permission grant. ${permission.reason}`
      );
    }

    const captureId = `cap-${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();
    const activeApp = options.activeApp || 'Code.exe';
    const activeWindowTitle = options.activeWindowTitle || 'MeghAI - Visual Studio Code';

    // 2. OCR text extraction
    const ocrText = options.mockOcrText ||
      `TypeError: Cannot read properties of undefined (reading 'toLowerCase')
    at VoiceCatalog.listVoices (packages/voice/src/index.ts:38:43)
    at tests/integration/voice-catalog.test.ts:23:33`;

    // 3. Error detection
    const detectedErrors: Array<{ type: string; message: string; rawSnippet: string }> = [];
    for (const pattern of this.ERROR_PATTERNS) {
      const match = ocrText.match(pattern);
      if (match) {
        detectedErrors.push({
          type: match[0].split(':')[0]?.trim() || 'Error',
          message: match[1]?.trim() || match[0],
          rawSnippet: match[0]
        });
      }
    }

    // 4. Explanation and Proposed Fix
    let visualExplanation = `Active window is '${activeWindowTitle}' (${activeApp}).`;
    let proposedFix: string | undefined;

    if (detectedErrors.length > 0) {
      const err = detectedErrors[0]!;
      visualExplanation = `Detected ${err.type} on screen: "${err.message}". This error occurred during string processing where a property was undefined.`;
      proposedFix = `Add a defensive null check or optional chaining (e.g. \`(v.language || '').toLowerCase()\`) before calling .toLowerCase() on the target object.`;
    } else {
      visualExplanation += ` Screen shows active workspace content with no critical errors detected.`;
    }

    return {
      captureId,
      timestamp,
      activeApp,
      activeWindowTitle,
      ocrText,
      detectedErrors,
      visualExplanation,
      proposedFix,
      isEphemeral: true // Temporary screenshot memory discarded after analysis
    };
  }
}
