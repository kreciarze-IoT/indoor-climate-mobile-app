/* eslint-disable no-bitwise */
import {useMemo, useState} from "react";
import {Alert, PermissionsAndroid, Platform} from "react-native";
import WifiManager from "react-native-wifi-reborn";

import {BleManager, Device} from "react-native-ble-plx";
import {createDevice, deleteDevice, getDeviceToken} from "../Endpoints";
import {BluetoothLowEnergyApi} from "../../types/types";
import {useUserCredentials} from "../useUserCredentials/useUserCredentials";
import {
    _enableBluetooth,
    _singleScan,
    sendWiFiCredentials, waitForResponse
} from "./bleHelperFunctions";
import { RSA } from "react-native-rsa-native";



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

    const connectToDevice = async (bearer_token: string, deviceId: string, wifiPass: string, wifiName: string) => {
        const {public: publicRsaKey, private: privateRsaKey} = await RSA.generateKeys(2048);
        Alert.alert("Połączenie", "Rozpoczynamy proces łączenia z urządzeniem. Proszę czekać.");
        bleManager.connectToDevice(deviceId)
            .then(async (device) => {
                return device.discoverAllServicesAndCharacteristics()
            })
            .then(async (device) => {
                createDevice(bearer_token, device.id)
                    .then(async (deviceNum: string) => {
                        // console.log("Before sending:", {
                        //     device,
                        //     privateRsaKey,
                        //     wifiName,
                        //     wifiPass,
                        //     deviceNum
                        // })
                        const success = await sendWiFiCredentials(
                            device,
                            privateRsaKey,
                            wifiName,
                            wifiPass,
                            deviceNum
                        );
                        console.log({
                            success
                        })
                        if(success)
                            await waitForResponse(device, bearer_token);
                    })
                    .catch((error) => {
                        deleteDevice(bearer_token, device.id)
                        Alert.alert("Błąd połączenia", "Nie udało się połączyć z serwerem. Błąd: " + error);
                    });
            })
            .catch((error) => Alert.alert("Błąd połączenia", "Nie udało się połączyć z urządzeniem. Błąd: " + error));
    }

    const changeDeviceWifiCredentials = async (bearer_token: string, deviceId: string, wifiPass: string, wifiSSID: string) => {
        bleManager.connectToDevice(deviceId)
            .then(async (device) => {
                //TODO: change to get RSA Public Key from server
                getDeviceToken(deviceId, bearer_token)
                    .then(async (publicKey: string) => {
                        console.log("Before sending:", {
                            device,
                            publicKey,
                            wifiSSID,
                            wifiPass
                        });
                    await sendWiFiCredentials(
                        device,
                        publicKey,
                        wifiSSID,
                        wifiPass,
                        ""
                    );
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

