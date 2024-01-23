import {Device} from "react-native-ble-plx";

export const aes_iv = "41d2067961d7438aab6f2ac736b2d136";
export const aes_key = "306f56538ca5ecbc416a58480102f5f0735bf4fe29d409b81a18f621756e126c";
export const ble_service = "00000001-710e-4a5b-8d75-3e5b444bc3cf";
export const ble_write_characteristic = "00000004-710e-4a5b-8d75-3e5b444bc3cf";
export const ble_read_characteristic = "00000004-710e-4a5b-8d75-3e5b444bc3cf";
export const ble_read_UUID_characteristic = "00000005-710e-4a5b-8d75-3e5b444bc3cf";

export type BluetoothLowEnergyApi = {
    requestPermissions(): Promise<boolean>;
    scanForPeripherals(): void;
    bleDevicesList: Device[];
    connectToDevice(bearer_token: string, deviceId: string, wifiPass: string, wifiName: string): void;
    changeDeviceWifiCredentials(bearer_token: string, deviceMac:string, deviceUUID: string, wifiPass: string, wifiName: string): void;
}

export type decryptedData = {
    iv: string,
    cipher: string
}

// {
//     "when": "2024-01-10T16:00:00.054000Z",
//     "temperature": 25.02,
//     "pressure": 1002.2,
//     "device_id": 76
// },
export type WeatherRecord = {
    device_id: string,
    temperature: number,
    pressure: number,
    when: string
}

export type DeviceProperties = {
    id: string,
    user_id: number,
    name: string,
    activated: boolean
}