export type DeviceStatus =
  | "active"
  | "revoked"
  | "pending";

export type AuthDeviceMethod =
  | "totp"
  | "passkey"
  | "email";

export type TrustedDevice = {
  deviceId: string;

  deviceName?: string;
  platform?: string;
  browser?: string;

  status: DeviceStatus;

  authMethod: AuthDeviceMethod;

  linkedAt?: unknown;
  lastUsedAt?: unknown;

  createdBy?: string;
};

export type DeviceTransferStatus =
  | "pending"
  | "verified"
  | "completed"
  | "cancelled";


export type DeviceTransferRequest = {
  requestId: string;

  userId: string;

  oldDeviceId?: string;

  newDeviceId: string;

  status: DeviceTransferStatus;

  createdAt?: unknown;

  completedAt?: unknown;
};