import {BleManager, Device} from "react-native-ble-plx";
import {aes_iv, aes_key, ble_read_characteristic, ble_service, ble_write_characteristic} from "../../types/types";
import {Alert} from "react-native";
import Aes from "react-native-aes-crypto";

export const _isDuplicteDevice = (devices: Device[], nextDevice: Device) => {
    return devices.some((device) => device.id === nextDevice.id);
};

export async function _enableBluetooth(bleManager: BleManager) {
    const isOn = await bleManager.state();
    if( isOn !== "PoweredOn")
        bleManager.enable()
            .then(() => console.log("Bluetooth is now on"))
            .catch((error) => console.log("An error occurred while enabling Bluetooth", error));
    return isOn === "PoweredOn";
}

export async function _singleScan(bleManager:BleManager): Promise<Device[]> {
    const devices: Device[] = [];
    bleManager.startDeviceScan(null, null, (error, device) => {
        if (error) {
            bleManager.stopDeviceScan();
            return;
        }
        if (
            device
            && !_isDuplicteDevice(devices, device)
            && device.name
        ) {
            devices.push(device);
        }
    });
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            bleManager.stopDeviceScan();
            resolve(devices);
        }, 1500);
    });
}
export async function sendWiFiCredentials(device: Device, aesKey: string, wifiName: string, wifiPass: string): Promise<boolean> {
    const message = JSON.stringify({
        wifi_ssid: wifiName,
        wifi_password: wifiPass,
        host: "https://krecikiot.cytr.us/",
        aes_key: aesKey
    });
    const fullEncryptedMessage = await encryptData(message)
    return device.writeCharacteristicWithResponseForService(
        ble_service,
        ble_write_characteristic,
        Buffer.from(fullEncryptedMessage, "utf8").toString("base64")
    )
        .then((characteristic) =>
        {
            return true;
        })
        .catch( (error) => {
                Alert.alert(
                    "Error",
                    "Nie udało się wysłać danych. Błąd: " + error,
                    [
                        {
                            text: "Zamknij",
                            style: "cancel"
                        }
                    ]
                )
                return false;
            }
        );
}

export function waitForResponse(device: Device, bearerToken:string ): Promise<boolean>{
    return new Promise<boolean>((resolve, reject) => {
        const interval = setInterval(() => {
            device.readCharacteristicForService(ble_service, ble_read_characteristic)
                .then(async (characteristic) => {
                    const utfMessage = Buffer.from(characteristic.value || "", "base64").toString("utf8");
                    const message = await decryptData(utfMessage);
                    if (message !== "R") {
                        if (message !== "R") {
                            Alert.alert("Odpowiedź od rpi: ", message === "S" ? "Sukces łączenia z wifi" : "Fail łączenia z wifi")
                            clearInterval(interval);
                            if(message === "S") {
                                resolve(true);
                            }
                            else {
                                resolve(false);
                            }
                        }
                    }
                })
                .catch((error) => {
                    Alert.alert("Błąd połączenia", "Nie udało się połączyć z urządzeniem. Error: " + error);
                    clearInterval(interval);
                    resolve(false);
                });
        }, 1500);
    });
}


export function alertNoWifiCredentials() {
    Alert.alert(
        "No Wifi credentials",
        "Please enter wifi credentials",
        [
            {
                text: "Close",
                style: "cancel"
            }
        ]
    );
}

export const encryptData = async (text: string) => {
    return await Aes.encrypt(text, aes_key, aes_iv, 'aes-256-cbc');
}

export const decryptData = async (text: string) => {
    return await Aes.decrypt(text, aes_key, aes_iv, 'aes-256-cbc');
}