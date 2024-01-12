/* eslint-disable no-bitwise */
import {useMemo, useState} from "react";
import {Alert, PermissionsAndroid, Platform} from "react-native";
import WifiManager from "react-native-wifi-reborn";

import {BleManager, Device} from "react-native-ble-plx";
import {createDevice, deleteDevice, getDeviceToken} from "../Endpoints";
import Aes from 'react-native-aes-crypto'
import {aes_iv, aes_key, ble_write_characteristic, ble_service, ble_read_characteristic, BluetoothLowEnergyApi} from "../../types/types";
import {useUserCredentials} from "../useUserCredentials/useUserCredentials";
import {
    _enableBluetooth,
    _singleScan,
    alertNoWifiCredentials, notifyAboutConnecitonResult,
    notifyAboutConnectingProcess, sendWiFiCredentials, waitForResponse
} from "./bleHelperFunctions";



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

    const connectToDevice = async (bearer_token: string, deviceId: string, wifiPass: string) => {
        let wifiName = "";
        if(wifiPass === ""){
            alertNoWifiCredentials();
            return;
        }
        await WifiManager.getCurrentWifiSSID()
            .then(ssid => {
                wifiName = ssid;
            })
            .catch((error) => {
                console.log(error);
            });
        //rozpoczynamy proces łączenia z urządzeniem
        notifyAboutConnectingProcess();
        bleManager.connectToDevice(deviceId)
            .then(async (device) => {
                createDevice(bearer_token, device.id)
                    .then(async (rpiToken: string) => {
                        await sendWiFiCredentials(
                            device,
                            rpiToken,
                            wifiName,
                            wifiPass
                        );
                        await waitForResponse(device, bearer_token);
                    })
                    .then(() => {
                        setAddDeviceSignal(prev => !prev);
                        console.log("Device created successfully")
                    })
                    .catch((error) => {
                        deleteDevice(bearer_token, device.id)
                        console.log("An error occurred while creating device", error);
                    });
            }
            )
            .catch((error) => console.log("An error occurred while discovering all services and characteristics", error));
    }

    const changeDeviceWifiCredentials = async (bearer_token: string, deviceId: string, wifiPass: string, wifiSSID: string) => {
        bleManager.connectToDevice(deviceId)
            .then(async (device) => {
                getDeviceToken(deviceId, bearer_token)
                    .then(async (rpiToken: string) => {
                    await sendWiFiCredentials(
                        device,
                        rpiToken,
                        wifiSSID,
                        wifiPass
                    );
                    await waitForResponse(device, bearer_token);
                })
                .catch((error) => {
                    console.log("An error occurred while creating device", error);
                });
            }
            )
            .catch((error) => console.log("An error occurred while discovering all services and characteristics", error));
    }

    return {
        scanForPeripherals,
        requestPermissions,
        bleDevicesList,
        connectToDevice,
        changeDeviceWifiCredentials
    };
}

