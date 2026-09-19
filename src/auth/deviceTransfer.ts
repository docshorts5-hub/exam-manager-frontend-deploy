import type {
  DeviceTransferRequest,
  TrustedDevice,
} from "./deviceTypes";

import {
  addTrustedDevice,
} from "./deviceService";

import {
  createDeviceTransferRequest,
  completeDeviceTransfer,
} from "./deviceTransferService";


export async function startDeviceTransfer(
  request: DeviceTransferRequest
): Promise<void> {

  await createDeviceTransferRequest(request);
}


export async function registerVerifiedNewDevice(
  request: DeviceTransferRequest,
  device: TrustedDevice
): Promise<void> {

  await addTrustedDevice(
    request.userId,
    device
  );

  await completeDeviceTransfer(
    request.userId,
    request.requestId
  );
}
