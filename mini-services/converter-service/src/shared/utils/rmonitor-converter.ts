/**
 * RMonitor ↔ WebJSON Converter
 * Bidirectional conversion between RMonitor protocol and WebJSON
 */

import type {
  WebJsonMessage,
  WebJsonMessageId,
  WebJsonMessage_I,
  WebJsonMessage_E,
  WebJsonMessage_B,
  WebJsonMessage_C,
  WebJsonMessage_A,
  WebJsonMessage_COMP,
  WebJsonMessage_G,
  WebJsonMessage_H,
  WebJsonMessage_J,
  WebJsonMessage_F,
  WebJsonMessage_DPD,
  WebJsonMessage_DPF,
  WebJsonMessage_DSI,
} from "../types";
import type { RMonitorMessage } from "../types";
import { encodeRMonitorMessage } from "./rmonitor-parser";

/**
 * Convert RMonitor message to WebJSON
 */
export function rMonitorToJson(msg: RMonitorMessage): WebJsonMessage | null {
  const { command, fields } = msg;

  switch (command as WebJsonMessageId) {
    case "I":
      return {
        Id: "I",
        TimeOfDay: fields[0] || "",
        Date: fields[1] || "",
      } as WebJsonMessage_I;

    case "E":
      return {
        Id: "E",
        Description: fields[0] || "",
        Value: fields[1] || "",
      } as WebJsonMessage_E;

    case "B":
      return {
        Id: "B",
        UniqueNumber: fields[0] || "",
        Description: fields[1] || "",
      } as WebJsonMessage_B;

    case "C":
      return {
        Id: "C",
        UniqueNumber: fields[0] || "",
        Description: fields[1] || "",
      } as WebJsonMessage_C;

    case "A":
      return {
        Id: "A",
        RegistrationNumber: fields[0] || "",
        Number: fields[1] || "",
        TransponderNumber: fields[2] || "",
        FirstName: fields[3] || "",
        LastName: fields[4] || "",
        Nationality: fields[5] || "",
        ClassNumber: fields[6] || "",
      } as WebJsonMessage_A;

    case "COMP":
      return {
        Id: "COMP",
        RegistrationNumber: fields[0] || "",
        Number: fields[1] || "",
        ClassNumber: fields[2] || "",
        FirstName: fields[3] || "",
        LastName: fields[4] || "",
        Nationality: fields[5] || "",
        AdditionalData: fields[6] || "",
      } as WebJsonMessage_COMP;

    case "G":
      return {
        Id: "G",
        Position: fields[0] || "",
        RegistrationNumber: fields[1] || "",
        Laps: fields[2] || "",
        TotalTime: fields[3] || "",
      } as WebJsonMessage_G;

    case "H":
      return {
        Id: "H",
        Position: fields[0] || "",
        RegistrationNumber: fields[1] || "",
        BestLap: fields[2] || "",
        BestLaptime: fields[3] || "",
      } as WebJsonMessage_H;

    case "J":
      return {
        Id: "J",
        RegistrationNumber: fields[0] || "",
        Laptime: fields[1] || "",
        TotalTime: fields[2] || "",
      } as WebJsonMessage_J;

    case "F":
      return {
        Id: "F",
        LapsToGo: fields[0] || "",
        TimeToGo: fields[1] || "",
        TimeOfDay: fields[2] || "",
        RaceTime: fields[3] || "",
        FlagStatus: fields[4] || "",
      } as WebJsonMessage_F;

    case "DPD":
      return {
        Id: "DPD",
        DECODER_ID: fields[0] || "",
        TRANSPONDER: fields[1] || "",
        RegistrationNumber: fields[2] || "",
        RTC_TIME: fields[3] || "",
        UTC_TIME: fields[4],
        STC_TIME: fields[5],
      } as WebJsonMessage_DPD;

    case "DPF":
      return {
        Id: "DPF",
        DECODER_ID: fields[0] || "",
        Controller_id: fields[1] || "",
        Request_id: fields[2] || "",
        Passing_number: fields[3] || "",
        Transponder: fields[4] || "",
        RTC_id: fields[5] || "",
        RTC_Time: fields[6] || "",
        UTC_Time: fields[7] || "",
        STC_Time: fields[8] || "",
        Strength: fields[9] || "",
        Hits: fields[10] || "",
        Flags: fields[11] || "",
        Tran_code: fields[12] || "",
        User_flag: fields[13] || "",
        Driver_id: fields[14] || "",
        Sport: fields[15] || "",
      } as WebJsonMessage_DPF;

    case "DSI":
      return {
        Id: "DSI",
        RegistrationNumber: fields[0] || "",
        Number: fields[1] || "",
        TransponderNumber: fields[2] || "",
        Name: fields[3] || "",
        TimeOfStay: fields[4] || "",
        Speed: fields[5] || "",
      } as WebJsonMessage_DSI;

    default:
      console.warn(`Unknown RMonitor command: ${command}`);
      return null;
  }
}

/**
 * Convert WebJSON message back to RMonitor format
 */
export function jsonToRMonitor(json: WebJsonMessage): string {
  const id = json.Id;

  switch (id) {
    case "I": {
      const msg = json as WebJsonMessage_I;
      return encodeRMonitorMessage("I", [msg.TimeOfDay, msg.Date]);
    }

    case "E": {
      const msg = json as WebJsonMessage_E;
      return encodeRMonitorMessage("E", [msg.Description, msg.Value]);
    }

    case "B": {
      const msg = json as WebJsonMessage_B;
      return encodeRMonitorMessage("B", [msg.UniqueNumber, msg.Description]);
    }

    case "C": {
      const msg = json as WebJsonMessage_C;
      return encodeRMonitorMessage("C", [msg.UniqueNumber, msg.Description]);
    }

    case "A": {
      const msg = json as WebJsonMessage_A;
      return encodeRMonitorMessage("A", [
        msg.RegistrationNumber,
        msg.Number,
        msg.TransponderNumber,
        msg.FirstName,
        msg.LastName,
        msg.Nationality,
        msg.ClassNumber,
      ]);
    }

    case "COMP": {
      const msg = json as WebJsonMessage_COMP;
      return encodeRMonitorMessage("COMP", [
        msg.RegistrationNumber,
        msg.Number,
        msg.ClassNumber,
        msg.FirstName,
        msg.LastName,
        msg.Nationality,
        msg.AdditionalData,
      ]);
    }

    case "G": {
      const msg = json as WebJsonMessage_G;
      return encodeRMonitorMessage("G", [
        msg.Position,
        msg.RegistrationNumber,
        msg.Laps,
        msg.TotalTime,
      ]);
    }

    case "H": {
      const msg = json as WebJsonMessage_H;
      return encodeRMonitorMessage("H", [
        msg.Position,
        msg.RegistrationNumber,
        msg.BestLap,
        msg.BestLaptime,
      ]);
    }

    case "J": {
      const msg = json as WebJsonMessage_J;
      return encodeRMonitorMessage("J", [
        msg.RegistrationNumber,
        msg.Laptime,
        msg.TotalTime,
      ]);
    }

    case "F": {
      const msg = json as WebJsonMessage_F;
      return encodeRMonitorMessage("F", [
        msg.LapsToGo,
        msg.TimeToGo,
        msg.TimeOfDay,
        msg.RaceTime,
        msg.FlagStatus,
      ]);
    }

    case "DPD": {
      const msg = json as WebJsonMessage_DPD;
      return encodeRMonitorMessage("DPD", [
        msg.DECODER_ID,
        msg.TRANSPONDER,
        msg.RegistrationNumber,
        msg.RTC_TIME,
        msg.UTC_TIME || "",
        msg.STC_TIME || "",
      ]);
    }

    case "DPF": {
      const msg = json as WebJsonMessage_DPF;
      return encodeRMonitorMessage("DPF", [
        msg.DECODER_ID,
        msg.Controller_id,
        msg.Request_id,
        msg.Passing_number,
        msg.Transponder,
        msg.RTC_id,
        msg.RTC_Time,
        msg.UTC_Time,
        msg.STC_Time,
        msg.Strength,
        msg.Hits,
        msg.Flags,
        msg.Tran_code,
        msg.User_flag,
        msg.Driver_id,
        msg.Sport,
      ]);
    }

    case "DSI": {
      const msg = json as WebJsonMessage_DSI;
      return encodeRMonitorMessage("DSI", [
        msg.RegistrationNumber,
        msg.Number,
        msg.TransponderNumber,
        msg.Name,
        msg.TimeOfStay,
        msg.Speed,
      ]);
    }

    default:
      throw new Error(`Unknown WebJSON message ID: ${id}`);
  }
}

/**
 * Get cache key for a message (for deduplication)
 */
export function getCacheKey(msg: WebJsonMessage): string {
  const id = msg.Id;

  switch (id) {
    case "I":
      return "I"; // Single instance
    case "E":
      return `E:${(msg as WebJsonMessage_E).Description}`;
    case "B":
      return `B:${(msg as WebJsonMessage_B).UniqueNumber}`;
    case "C":
      return `C:${(msg as WebJsonMessage_C).UniqueNumber}`;
    case "A":
      return `A:${(msg as WebJsonMessage_A).RegistrationNumber}:${(msg as WebJsonMessage_A).TransponderNumber}`;
    case "COMP":
      return `COMP:${(msg as WebJsonMessage_COMP).RegistrationNumber}`;
    case "G":
      return `G:${(msg as WebJsonMessage_G).RegistrationNumber}`;
    case "H":
      return `H:${(msg as WebJsonMessage_H).RegistrationNumber}`;
    case "J":
      return `J:${(msg as WebJsonMessage_J).RegistrationNumber}`;
    case "F":
      return "F"; // Single instance
    case "DPD": {
      const dpd = msg as WebJsonMessage_DPD;
      return `DPD:${dpd.DECODER_ID}:${dpd.RegistrationNumber}`;
    }
    case "DPF":
      return ""; // DPF is not cached
    case "DSI":
      return `DSI:${(msg as WebJsonMessage_DSI).RegistrationNumber}`;
    default:
      return `${id}:${Date.now()}`;
  }
}
