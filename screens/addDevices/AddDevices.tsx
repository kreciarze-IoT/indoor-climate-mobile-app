import {View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, TextInput} from "react-native";
import {colors} from "../../styles/global";
import {useEffect, useRef, useState} from "react";
import useBLE from "../../hooks/useBle/useBLE";
import Modal from "../../components/modal";
import {useUserCredentials} from "../../hooks/useUserCredentials/useUserCredentials";

export default function AddDevices(
    {navigation}: any
){
    let { token } = useUserCredentials();
    const [isScanning, setIsScanning] = useState(false);
    const [slowMode, setSlowMode] = useState(false);
    const [permissions, setPermissions] = useState(false);
    const [wifiPass, setWifiPass] = useState('');
    const [wifiName, setWifiName] = useState('');
    const {
        requestPermissions,
        scanForPeripherals,
        bleDevicesList,
        connectToDevice
    } = useBLE();

    useEffect(() => {
        requestPermissions().then((result) => {
            setPermissions(result);
        });
    }, [isScanning]);

    return (
        <>
            <View>
                <TextInput  style={styles.textInput} placeholder={"Enter wifi name"}
                            onChangeText={text => {
                                setWifiName(text)}
                            }
                            value={wifiName} maxLength={32} />
                <TextInput  style={styles.textInput} placeholder={"Enter wifi password"}
                            onChangeText={text => {
                                setWifiPass(text)}
                            }
                            value={wifiPass} maxLength={63} />
            </View>
        <View style={styles.container}>
            <TouchableOpacity style={[styles.button, styles.bgRed]} onPress={() => {
                setSlowMode(!slowMode);
            } }>
                <Text style={styles.buttonText}>Slow mode: {slowMode ? "ON" : "OFF"}</Text>
            </TouchableOpacity>
            <Text style={styles.text}>Click "Scan" to start scanning area for devices.</Text>
            <View style={styles.actionButtons}>
                <TouchableOpacity
                    style={[styles.button, styles.bgRed]}
                    onPress={() => {
                        setIsScanning(false)
                        scanForPeripherals(false)
                    }}
                >
                    <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.button,
                        styles.bgPrimary
                    ]}
                    onPress={() => {
                        if(permissions){
                            setIsScanning(prev => !prev);
                            scanForPeripherals(!isScanning);
                        }
                    }}
                >
                    <Text style={styles.buttonText}>Scan</Text>
                </TouchableOpacity>
            </View>
        </View>
        <ScrollView>
            <Text style={[
                styles.text,
                styles.textCenter
            ]}>
                {isScanning ? "Scanning..." : "Not scanning"}
            </Text>
            <ScrollView>
                {bleDevicesList.length > 0 && (
                    <ScrollView contentContainerStyle={styles.bluetoothDevices}>
                        <Text style={styles.text}>Devices found:</Text>
                        {bleDevicesList.map((device, index) => (
                            <TouchableOpacity
                                style={styles.bluetoothDeviceButton}
                                onPress={() => {
                                    setIsScanning(false)
                                    connectToDevice(token ,device.id, wifiPass, wifiName, slowMode);
                                }}
                                key={device.id}
                            >
                                <Text>{device.name || `Unknown device ${index} (${device.id})`}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </ScrollView>
        </ScrollView>
            <Modal navigation={navigation} />
    </>
    )
}

let styles = StyleSheet.create({
    container: {
        display:"flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 15,
        marginBottom: 10,
        width: "100%",
    },
    actionButtons: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
    },
    text: {
        fontSize: 16,
        paddingVertical: 10,
    },
    textCenter: {
        textAlign: "center"
    },
    bluetoothDevices: {
        padding: 15,
        display: "flex",
        alignItems: "center",
        marginBottom: 100,
        height: "100%"
    },
    bluetoothDeviceButton: {
        backgroundColor: colors.gray,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
        marginTop: 10,
        width: "80%",
    },
    button: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
        marginTop: 10,
        width: "45%",
    },
    bgRed: {
        backgroundColor: colors.red
    },
    bgPrimary: {
        backgroundColor: colors.primary
    },
    buttonText: {
        color: colors.white,
        fontSize: 14,
        fontFamily: "montserrat-bold",
        textAlign: "center"
    },
    textInput: {
        height: 50,
        backgroundColor: colors.gray,
        borderRadius: 10,
        margin: 10,
        paddingHorizontal: 10,
    }
});