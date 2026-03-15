/**
 * WebJSON Message Types
 * Types for all RMonitor commands converted to JSON format
 */

// $I - Init/Time message
export interface WebJsonMessage_I {
  Id: "I";
  TimeOfDay: string; // "HH:MM:SS:MS"
  Date: string; // "DD Mon YY"
}

// $E - Extra data
export interface WebJsonMessage_E {
  Id: "E";
  Description: string;
  Value: string;
}

// $B - Line description
export interface WebJsonMessage_B {
  Id: "B";
  UniqueNumber: string;
  Description: string;
}

// $C - Class description
export interface WebJsonMessage_C {
  Id: "C";
  UniqueNumber: string;
  Description: string;
}

// $A - Competitor registration
export interface WebJsonMessage_A {
  Id: "A";
  RegistrationNumber: string;
  Number: string;
  TransponderNumber: string;
  FirstName: string;
  LastName: string;
  Nationality: string;
  ClassNumber: string;
}

// $COMP - Competitor info
export interface WebJsonMessage_COMP {
  Id: "COMP";
  RegistrationNumber: string;
  Number: string;
  ClassNumber: string;
  FirstName: string;
  LastName: string;
  Nationality: string;
  AdditionalData: string;
}

// $G - Position
export interface WebJsonMessage_G {
  Id: "G";
  Position: string;
  RegistrationNumber: string;
  Laps: string;
  TotalTime: string;
}

// $H - Best lap
export interface WebJsonMessage_H {
  Id: "H";
  Position: string;
  RegistrationNumber: string;
  BestLap: string;
  BestLaptime: string;
}

// $J - Lap time
export interface WebJsonMessage_J {
  Id: "J";
  RegistrationNumber: string;
  Laptime: string;
  TotalTime: string;
}

// $F - Flag/Race status
export interface WebJsonMessage_F {
  Id: "F";
  LapsToGo: string;
  TimeToGo: string;
  TimeOfDay: string;
  RaceTime: string;
  FlagStatus: string;
}

// $DPD - Decoder passing data
export interface WebJsonMessage_DPD {
  Id: "DPD";
  DECODER_ID: string;
  TRANSPONDER: string;
  RegistrationNumber: string;
  RTC_TIME: string;
  UTC_TIME?: string;
  STC_TIME?: string;
}

// $DPF - Decoder passing full
export interface WebJsonMessage_DPF {
  Id: "DPF";
  DECODER_ID: string;
  Controller_id: string;
  Request_id: string;
  Passing_number: string;
  Transponder: string;
  RTC_id: string;
  RTC_Time: string;
  UTC_Time: string;
  STC_Time: string;
  Strength: string;
  Hits: string;
  Flags: string;
  Tran_code: string;
  User_flag: string;
  Driver_id: string;
  Sport: string;
}

// $DSI - Speed/Interval data
export interface WebJsonMessage_DSI {
  Id: "DSI";
  RegistrationNumber: string;
  Number: string;
  TransponderNumber: string;
  Name: string;
  TimeOfStay: string;
  Speed: string;
}

// Union type for all messages
export type WebJsonMessage =
  | WebJsonMessage_I
  | WebJsonMessage_E
  | WebJsonMessage_B
  | WebJsonMessage_C
  | WebJsonMessage_A
  | WebJsonMessage_COMP
  | WebJsonMessage_G
  | WebJsonMessage_H
  | WebJsonMessage_J
  | WebJsonMessage_F
  | WebJsonMessage_DPD
  | WebJsonMessage_DPF
  | WebJsonMessage_DSI;

// Message ID types
export type WebJsonMessageId =
  | "I"
  | "E"
  | "B"
  | "C"
  | "A"
  | "COMP"
  | "G"
  | "H"
  | "J"
  | "F"
  | "DPD"
  | "DPF"
  | "DSI";

// All supported command IDs
export const ALL_COMMAND_IDS: WebJsonMessageId[] = [
  "I",
  "E",
  "B",
  "C",
  "A",
  "COMP",
  "G",
  "H",
  "J",
  "F",
  "DPD",
  "DPF",
  "DSI",
];

// WebSocket message wrapper
export interface WsMessageWrapper {
  action: "init" | "data" | "send" | "error" | "ping" | "pong" | "status";
  message?: WebJsonMessage | WebJsonMessage[] | string;
  timestamp?: string;
}

// WebSocket client info
export interface WsClientInfo {
  id: string;
  apiKey: string;
  roleId: string;
  roleName: string;
  allowedCommands: string[] | "all";
  canSend: boolean;
  canReceive: boolean;
  connectedAt: Date;
  ipAddress: string;
}
