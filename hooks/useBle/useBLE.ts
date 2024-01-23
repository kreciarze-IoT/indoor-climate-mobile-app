/* eslint-disable no-bitwise */
import {useMemo, useState} from "react";
import {Alert, PermissionsAndroid, Platform} from "react-native";

import {BleManager, Device} from "react-native-ble-plx";
import {assignDevice, getDeviceKey, getDevices} from "../Endpoints";
import {
    ble_read_UUID_characteristic,
    ble_service,
    BluetoothLowEnergyApi,
} from "../../types/types";
import {useUserCredentials} from "../useUserCredentials/useUserCredentials";
import {
    _enableBluetooth,
    _singleScan, decryptData,
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

    const scanForPeripherals = async () => {
        await _enableBluetooth(bleManager);
        const devices = await _singleScan(bleManager);
        setBleDevicesList((prev) => {
            const savedDevicesMAC = prev.map((device) => device.id);
            const newDevices = devices.filter((device) => !savedDevicesMAC.includes(device.id));
            return [...prev, ...newDevices];
        });
    }

    const connectToDevice = async (bearer_token: string, deviceId: string, wifiPass: string, wifiName: string) => {
        if (wifiName === "") {
            Alert.alert("Błąd", "Nie podano nazwy sieci WiFi.");
            return;
        }
        let isMobileConnected = await WifiManager.getCurrentWifiSSID() !== "<unknown ssid>";
        if (!isMobileConnected) {
            Alert.alert("Błąd", "Nie jesteś połączony z siecią WiFi. Połącz się i spróbuj ponownie.");
            return;
        }
        //ŁĄCZENIE Z URZĄDZENIEM
        bleManager.connectToDevice(
            deviceId,
            {requestMTU: 512, timeout: 45000}
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
                // let serverResponsePromise: Promise<string> | undefined;
                // const interval = setInterval(async () => {
                //     try {
                //         serverResponsePromise = createDevice(bearer_token, deviceId, aesKey, deviceUUID);
                //         numberOfTries++;
                //     } catch (e) {
                //         console.log(e);
                //     }
                //     if (numberOfTries > 5) {
                //         clearInterval(interval);
                //         Alert.alert("Błąd", "Nie udało się wysłać danych do serwera. Sprawdź połączenie z internetem.");
                //     }
                // }, 1000 * 3 * numberOfTries);
                const serverResponsePromise = assignDevice(bearer_token, deviceId, aesKey, deviceUUID);
                const serverResponse = await serverResponsePromise;
                const rpiResponse = await rpiResponsePromise;
                //CZEKANIE NA ODPOWIEDZI
                if (serverResponse && rpiResponse) {
                    setTimeout(async () => {
                        await waitForResponse(device, bearer_token);
                        setDevices(prev => [...prev, {
                            id: deviceUUID,
                            name: deviceId,
                            activated: false,
                            user_id: 0
                        }]);
                    }, 2500);
                } else Alert.alert("Fail!", "Odpowiedzi od serwera i urządzenia nie otrzymane - serwer: " + serverResponse + " i rpi: " + rpiResponse);
            })
            .catch((error) => Alert.alert("Błąd połączenia", "Nie udało się połączyć z urządzeniem. Błąd: " + error));
    }

    const changeDeviceWifiCredentials = async (bearer_token: string, deviceMAC: string, deviceUUID: string, wifiPass: string, wifiSSID: string) => {
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
        bleManager.connectToDevice(
            deviceMAC,
            {requestMTU: 512, timeout: 45000}
            )
            .then(async (device) => {
                device = await device.discoverAllServicesAndCharacteristics();
                const isDataSent = await sendWiFiCredentials(device, deviceKey, wifiSSID, wifiPass);
                if(isDataSent)
                    setTimeout(async () => {
                        await waitForResponse(device, bearer_token);
                    }
                    , 5000);
            }
            )
            .catch((error) => Alert.alert("Błąd połączenia", "Nie udało się połączyć z urządzeniem. Spróbuj ponownie."));
    }

    return {
        scanForPeripherals,
        requestPermissions,
        bleDevicesList,
        connectToDevice,
        changeDeviceWifiCredentials
    };
}

