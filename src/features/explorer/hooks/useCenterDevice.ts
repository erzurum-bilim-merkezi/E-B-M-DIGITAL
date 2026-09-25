import { centerDevice } from '../api/device'

/** The centre (kiosk) device registration of this browser, or null on a personal device. */
export function useCenterDevice() {
  return centerDevice.useValue()
}
