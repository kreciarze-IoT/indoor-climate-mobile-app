import {BleManager, Device} from "react-native-ble-plx";
import {aes_iv, aes_key, ble_read_characteristic, ble_service, ble_write_characteristic} from "../../types/types";
import {Alert} from "react-native";
import Aes from "react-native-aes-crypto";
import {SetStateAction} from "react";
import {deleteDevice} from "../Endpoints";

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
        ) {
            devices.push(device);
        }
    });
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            bleManager.stopDeviceScan();
            resolve(devices);
        }, 1000);
    });
}
export async function sendWiFiCredentials(device: Device, rpiToken: string, wifiName: string, wifiPass: string): Promise<string> {

    const message = JSON.stringify({
        wifi_ssid: wifiName,
        wifi_password: wifiPass,
        host: "https://krecikiot.cytr.us/",
        auth_token: rpiToken
    });
    const fullEncryptedMessage = await encryptData(message)
    device.writeCharacteristicWithoutResponseForService(
        ble_service,
        ble_write_characteristic,
        Buffer.from(fullEncryptedMessage, "utf8").toString("base64")
    )
        .then((characteristic) => console.log("Data written to characteristic", JSON.stringify(characteristic, null, 2)))
        .catch((error) => console.log("An error occurred while writing data to characteristic", JSON.stringify(error, null, 2)))
    return "";
}

export function waitForResponse(device: Device, bearerToken:string ): Promise<void>{
    return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
            console.log("Interval called")
            device.readCharacteristicForService(ble_service, ble_read_characteristic)
                .then((characteristic) => {
                    console.log("Data read from characteristic", JSON.stringify(characteristic, null, 2))
                    if (characteristic.value) {
                        console.log("Characteristic Value: ", characteristic.value)
                        const utfMessage = Buffer.from(characteristic.value, "base64").toString("utf8");
                        const decryptedMessage = decryptData(utfMessage);
                        decryptedMessage.then((value) => {
                            const message = JSON.parse(value);
                            console.log("Message: ", message)
                            if (message === "s" || message === "f") {
                                clearInterval(interval);
                                notifyAboutConnecitonResult(message === "s")
                                if(message === "f") deleteDevice(bearerToken, device.id)
                            }
                        });
                    }
                })
                .catch((error) => console.log("An error occurred while reading data from characteristic", JSON.stringify(error, null, 2)))
        }, 1000);
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

export function notifyAboutConnectingProcess() {
    Alert.alert(
        "Connecting to device",
        "Please wait",
        [
            {
                text: "Close",
                style: "cancel"
            }
        ]
    );
}

export function notifyAboutConnecitonResult(
    result: boolean
) {
    Alert.alert(
        "Connection result: ",
        result ? "Successfully connected to device" : "Failed to connect to device",
        [
            {
                text: "Close",
                onPress: () => console.log("Cancel Pressed"),
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