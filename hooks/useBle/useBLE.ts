/* eslint-disable no-bitwise */
import {useMemo, useState} from "react";
import {Alert, PermissionsAndroid, Platform} from "react-native";

import {BleManager, Device} from "react-native-ble-plx";
import {createDevice, deleteDevice, getDeviceKey} from "../Endpoints";
import {
    ble_read_characteristic,
    ble_read_UUID_characteristic,
    ble_service,
    BluetoothLowEnergyApi,
    aes_key, aes_iv
} from "../../types/types";
import {useUserCredentials} from "../useUserCredentials/useUserCredentials";
import {
    _enableBluetooth,
    _singleScan, decryptData,
    sendWiFiCredentials, waitForResponse
} from "./bleHelperFunctions";
import Aes from "react-native-aes-crypto";



export default function useBLE(): BluetoothLowEnergyApi {
    const bleManager = useMemo(() => {return new BleManager();}, []);
    const [bleDevicesList, setBleDevicesList] = useState<Device[]>([]);
    const {setAddDeviceSignal} = useUserCredentials();
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

    const connectToDevice = (bearer_token: string, deviceId: string, wifiPass: string, wifiName: string) => {
        // Alert.alert("Połączenie", "Rozpoczynamy proces łączenia z urządzeniem. Proszę czekać.");
        //ŁĄCZENIE Z URZĄDZENIEM
        bleManager.connectToDevice(
            deviceId,
            {requestMTU: 1024}
        )
            .then(async (device) => device.discoverAllServicesAndCharacteristics())
            .then(async (device) => {
                //WYCIĄGANIE UUID Z URZĄDZENIA
                const deviceUUIDBase64 = await device.readCharacteristicForService(ble_service, ble_read_UUID_characteristic);
                const deviceUUIDutf8 = Buffer.from(deviceUUIDBase64.value || "", "base64").toString("utf8");
                const deviceUUID = await decryptData(deviceUUIDutf8);
                // Alert.alert("Otrzymano id", "Otrzymano id urządzenia: " + deviceUUID);
                //GENERACJA KLUCZA I WYSŁANIE DO SERWERA ORAZ URZĄDZENIA
                const aesKey = await Aes.randomKey(128);
                const serverResponsePromise = createDevice(bearer_token, device.id, aesKey, deviceUUID);
                const rpiResponsePromise = sendWiFiCredentials(device, aesKey, wifiName, wifiPass);
                const serverResponse = await serverResponsePromise;
                const rpiResponse = await rpiResponsePromise;
                //CZEKANIE NA ODPOWIEDZI
                if(serverResponse && rpiResponse) {
                    setTimeout(async () => {
                        await waitForResponse(device, bearer_token);
                    } , 2500);
                }
                else Alert.alert("Fail!", "Odpowiedzi od serwera i urządzenia nie otrzymane - serwer: " + serverResponse + " i rpi: " + rpiResponse);
            })
            .catch((error) => Alert.alert("Błąd połączenia", "Nie udało się połączyć z urządzeniem. Błąd: " + error))
    }

    const changeDeviceWifiCredentials = async (bearer_token: string, deviceId: string, wifiPass: string, wifiSSID: string) => {
        bleManager.connectToDevice(deviceId)
            .then(async (device) => {
                getDeviceKey(deviceId, bearer_token)
                    .then(async (aesKey: string) => {
                        console.log("Before sending:", {
                            device,
                            aesKey,
                            wifiSSID,
                            wifiPass
                        });
                    // await sendWiFiCredentials(
                    //     device,
                    //     deviceId,
                    //     wifiSSID,
                    //     wifiPass,
                    //     ""
                    // );
                    await waitForResponse(device, bearer_token);
                })
                .catch((error) => {
                    Alert.alert("Błąd połączenia", "Nie udało się zmienić danych urządzenia. Spróbuj ponownie.")
                });
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

