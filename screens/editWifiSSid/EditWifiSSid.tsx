import {View, Text, TextInput, StyleSheet, TouchableOpacity} from "react-native";
import {useUserCredentials} from "../../hooks/useUserCredentials/useUserCredentials";
import {useEffect, useState} from "react";
import Modal from "../../components/modal";
import {colors} from "../../styles/global";
import useBLE from "../../hooks/useBle";
import {Picker} from "@react-native-picker/picker";
import WifiManager from "react-native-wifi-reborn";

export default function EditWifiSSid(
    props: {
        navigation: any,
        route: any
    }
) {
    const {navigation, route} = props;
    const {device_mac} = route.params;
    const {changeDeviceWifiCredentials} = useBLE();
    const {token} = useUserCredentials();
    const [wifiSSID, setWifiSSID] = useState("");
    const [wifiList, setWifiList] = useState([] as WifiManager.WifiEntry[]);
    const [newWifiPassword, setNewWifiPassword] = useState("");

    useEffect(() => {
        WifiManager.loadWifiList().then((wifiList) => {
            setWifiList(wifiList);
        });
    }, []);

    return (
        <>
            <View style={styles.container}>
                <Picker style={styles.picker} selectedValue={wifiSSID} onValueChange={
                    (itemValue, itemIndex) => {
                        setWifiSSID(itemValue);
                    }
                }>
                    {wifiList.length > 0 && wifiList.map((wifi, index) => {
                        return (
                            <Picker.Item key={index} label={wifi.SSID} value={wifi.SSID} />
                        )
                    })}
                </Picker>
                <TextInput placeholder={"Enter new Wifi password"} onChange={(event) => {
                    setNewWifiPassword(event.nativeEvent.text);
                } } style={styles.textInput} secureTextEntry={true} />
                <TouchableOpacity style={styles.actionButtons} onPress={
                    () => {
                        changeDeviceWifiCredentials(token, device_mac, wifiSSID, newWifiPassword);
                    }
                }>
                    <Text style={styles.whiteText}>EditWifiSSid</Text>
                </TouchableOpacity>
            </View>
            <Modal navigation={navigation} />
        </>
    )
}

let styles = StyleSheet.create({
    container: {
        height: "90%",
        alignItems: "center",
        backgroundColor: colors.white,
        padding: 10
    },
    text: {
        fontSize: 20,
        paddingVertical: 10,
        textAlign: "center"
    },
    textInput: {
        height: 50,
        width: "100%",
        backgroundColor: colors.gray,
        borderRadius: 10,
        margin: 10,
        paddingHorizontal: 10,
    },
    actionButtons: {
        backgroundColor: colors.primary,
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
        marginTop: 10,
    },
    whiteText: {
        color: colors.white,
        textAlign: "center"
    },
    picker: {
        width: "100%",
        height: 50,
        backgroundColor: colors.gray,
        borderRadius: 10,
        marginBottom: 10
    }
});