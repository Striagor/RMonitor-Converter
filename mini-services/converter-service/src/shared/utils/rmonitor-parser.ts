/**
 * RMonitor Stream Parser
 * Handles fragmented TCP packets and parses RMonitor messages
 *
 * RMonitor structure:
 * <SOR><Command><Sep>...fields...<EOR>
 * SOR: $ (0x24)
 * Sep: , (0x2C)
 * EOR: CR/LF (0x0D 0x0A)
 */

import type { RMonitorMessage } from "../types";

export class RMonitorStreamParser {
  private buffer: string = "";

  /**
   * Parse incoming data and extract complete messages
   * Handles fragmented packets by buffering incomplete data
   */
  parse(data: Buffer | string): RMonitorMessage[] {
    const messages: RMonitorMessage[] = [];
    const dataStr = Buffer.isBuffer(data) ? data.toString("utf-8") : data;

    // Append to buffer
    this.buffer += dataStr;

    // Process complete messages
    let eorIndex: number;
    while ((eorIndex = this.buffer.indexOf("\r\n")) !== -1) {
      const rawMessage = this.buffer.slice(0, eorIndex + 2);
      this.buffer = this.buffer.slice(eorIndex + 2);

      const parsed = this.parseSingleMessage(rawMessage);
      if (parsed) {
        messages.push(parsed);
      }
    }

    return messages;
  }

  /**
   * Parse a single RMonitor message
   */
  private parseSingleMessage(raw: string): RMonitorMessage | null {
    // Must start with $ (SOR)
    if (!raw.startsWith("$")) {
      return null;
    }

    // Remove EOR for parsing
    const content = raw.replace(/\r\n$/, "");

    // Split by comma, but handle quoted strings
    const fields = this.splitFields(content);

    if (fields.length === 0) {
      return null;
    }

    // First field is the command (e.g., "$A", "$COMP", "$DPD")
    const command = fields[0].substring(1); // Remove $

    return {
      command,
      fields: fields.slice(1),
      raw,
    };
  }

  /**
   * Split fields handling quoted strings correctly
   * RMonitor uses format: $CMD,"field1","field2",123
   */
  private splitFields(content: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (char === '"') {
        inQuotes = !inQuotes;
        // Don't include quotes in the field value
        continue;
      }

      if (char === "," && !inQuotes) {
        fields.push(current);
        current = "";
        continue;
      }

      current += char;
    }

    // Don't forget the last field
    if (current.length > 0) {
      fields.push(current);
    }

    return fields;
  }

  /**
   * Clear the buffer (used for reset)
   */
  reset(): void {
    this.buffer = "";
  }

  /**
   * Get current buffer content (for debugging)
   */
  getBuffer(): string {
    return this.buffer;
  }
}

/**
 * Parse a single complete RMonitor message string
 */
export function parseRMonitorMessage(raw: string): RMonitorMessage | null {
  const parser = new RMonitorStreamParser();
  return parser.parse(raw)[0] || null;
}

/**
 * Encode fields back to RMonitor format
 */
export function encodeRMonitorMessage(
  command: string,
  fields: (string | number)[]
): string {
  const encodedFields = fields.map((f) => {
    const str = String(f);
    // Quote if contains special characters
    if (str.includes(",") || str.includes('"') || str.includes(" ")) {
      return `"${str.replace(/"/g, '\\"')}"`;
    }
    return str;
  });

  return `$${command},${encodedFields.join(",")}\r\n`;
}
