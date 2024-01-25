/* eslint-disable no-bitwise */
import {useMemo, useState} from "react";
import {Alert, PermissionsAndroid, Platform} from "react-native";

import {BleManager, Device} from "react-native-ble-plx";
import {assignDevice, getDeviceKey} from "../Endpoints";
import {
    ble_read_UUID_characteristic,
    ble_service,
    BluetoothLowEnergyApi,
} from "../../types/types";
import {useUserCredentials} from "../useUserCredentials/useUserCredentials";
import {
    _enableBluetooth, _isDuplicteDevice,
     decryptData,
    sendWiFiCredentials, waitForResponse
} from "./bleHelperFunctions";
import Aes from "react-native-aes-crypto";
import WifiManager from "react-native-wifi-reborn";


export default function useBLE(): BluetoothLowEnergyApi {
    const bleManager = useMemo(() => {return new BleManager();}, []);
    const [bleDevicesList, setBleDevicesList] = useState<Device[]>([]);
    const {setDevices} = useUserCredentials();
    const requestPermissions = async () => {
        if (Platform.OS === 'android' && PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION) {
            const apiLevel = parseInt(Platform.Version.toString(), 10)

            if (apiLevel < 31) {
                const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
                return granted === PermissionsAndroid.RESULTS.GRANTED
            }
            if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN && PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) {
                const result = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
                ])

                return (
                    result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
                    result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
                    result['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
                )
            }
        }
        return false
    }

    const scanForPeripherals = async (isScanning: boolean) => {
        await _enableBluetooth(bleManager);
        bleManager.startDeviceScan(null, null, (error, device) => {
            if (error || !isScanning) {
                bleManager.stopDeviceScan();
                return;
            }
            if (
                device
                && device.name
            ) {
                console.log("scan..")
                setBleDevicesList((prev) => {
                    const isItOldDevice = prev.some((prevDevice) => prevDevice.id === device.id);
                    return isItOldDevice ? prev : [...prev, device];
                });
            }
        });
    }

    const connectToDevice = async (bearer_token: string, deviceId: string, wifiPass: string, wifiName: string, slowMode:boolean) => {
        if (wifiName === "") {
            Alert.alert("Błąd", "Nie podano nazwy sieci WiFi.");
            return;
        }
        let isMobileConnected = await WifiManager.getCurrentWifiSSID() !== "<unknown ssid>";
        if (!isMobileConnected) {
            Alert.alert("Błąd", "Nie jesteś połączony z siecią WiFi. Połącz się i spróbuj ponownie.");
            return;
        }
        Alert.alert("Parowanie", "Rozpoczynam parowanie...");
        //ŁĄCZENIE Z URZĄDZENIEM
        bleManager.connectToDevice(
            deviceId,
            {requestMTU: 512, timeout: 60000}
        )
            .then(async (device) => device.discoverAllServicesAndCharacteristics())
            .then(async (device) => {
                Alert.alert("Parowanie", "Nawiązano połączenie z urządzeniem. Rozpoczynam parowanie...")
                //WYCIĄGANIE UUID Z URZĄDZENIA
                const deviceUUIDBase64 = await device.readCharacteristicForService(ble_service, ble_read_UUID_characteristic)
                    .catch((error) => { Alert.alert("Błąd", "Wybrano niepoprawne urządzenie. Spróbuj ponownie."); return undefined; });
                if (!deviceUUIDBase64) return;
                const deviceUUIDutf8 = Buffer.from(deviceUUIDBase64.value || "", "base64").toString("utf8");
                const deviceUUID = await decryptData(deviceUUIDutf8);
                //GENERACJA KLUCZA I WYSŁANIE DO SERWERA ORAZ URZĄDZENIA
                const aesKey = await Aes.randomKey(32);
                const rpiResponsePromise = sendWiFiCredentials(device, aesKey, wifiName, wifiPass);
                //FETCHUJEMY AŻ OTRZYMAMY SUKCES
                // let numberOfTries = 0;
                let serverResponsePromise;
                if(slowMode) {
                    Alert.alert("Parowanie", "Włączony tryb wolny. Oczekiwanie na odpowiedź serwera...");
                    serverResponsePromise = new Promise((resolve, reject) => {
                        setTimeout(() => {
                            resolve(assignDevice(bearer_token, deviceId, aesKey, deviceUUID));
                        }, 15000);
                    });
                }
                else {
                    serverResponsePromise = assignDevice(bearer_token, deviceId, aesKey, deviceUUID);
                }
                const serverResponse = await serverResponsePromise;
                const rpiResponse = await rpiResponsePromise;
                //CZEKANIE NA ODPOWIEDZI
                if (serverResponse && rpiResponse) {
                    await waitForResponse(device, bearer_token);
                } else Alert.alert("Fail!", "Odpowiedzi od serwera i urządzenia nie otrzymane - serwer: " + serverResponse + " i rpi: " + rpiResponse);
            })
            .catch((error) => Alert.alert("Błąd połączenia", "Nie udało się połączyć z urządzeniem. Błąd: " + error))
    }

    const changeDeviceWifiCredentials = async (bearer_token: string, deviceMAC: string, deviceUUID: string, wifiSSID:string, wifiPass:string) => {
        if(wifiSSID === "") {
            Alert.alert("Błąd", "Nie podano nazwy sieci WiFi.");
            return;
        }
        const deviceKey = await getDeviceKey(deviceUUID, bearer_token);
        console.log({
            deviceKey,
            deviceUUID,
            wifiPass,
            wifiSSID
        });
        Alert.alert("Parowanie", "Rozpoczynam zmianę danych...");
        bleManager.connectToDevice(
            deviceMAC,
            {requestMTU: 512, timeout: 60000}
            )
            .then(async (device) => {
                device = await device.discoverAllServicesAndCharacteristics();
                const isDataSent = await sendWiFiCredentials(device, deviceKey, wifiSSID, wifiPass);
                if(isDataSent)
                    setTimeout(async () => {
                        await waitForResponse(device, bearer_token);
                    }
                    , 1000);
            }
            )
            .catch((error) => Alert.alert("Błąd połączenia", "Nie udało się połączyć z urządzeniem. " + error))
    }

    return {
        scanForPeripherals,
        requestPermissions,
        bleDevicesList,
        connectToDevice,
        changeDeviceWifiCredentials
    };
}

