import {View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView} from "react-native";
import Modal from "../../components/modal";
import {useUserCredentials} from "../../hooks/useUserCredentials/useUserCredentials";
import {getDevices, unassignDevice} from "../../hooks/Endpoints";
import {DeviceProperties} from "../../types/types";

export default function MyDevices({navigation}: any) {
    const {token, devices, setDevices} = useUserCredentials();

    return (
        <>
            <Text style={styles.grayText}>Can't see your devices? Try to refresh</Text>
            <TouchableOpacity style={styles.refreshButton} onPress={() => {
                getDevices(token).then((devices: DeviceProperties[]) => {
                    setDevices(() => devices);
                });
            }
            }>
                <Text style={styles.buttonText}>Refresh</Text>
            </TouchableOpacity>
            <ScrollView contentContainerStyle={styles.cardsContainer}>
                {devices.length > 0 && devices.map((device, index) => {
                    return (
                        <View style={styles.deviceContainer} key={index}>
                            <View style={styles.deviceCard}>
                                <View>
                                    <Text>Device id: {device.id}</Text>
                                    <Text>Device name: {device.name}</Text>
                                    <Text>Activated: {device.activated ? "Yes" : "No"}</Text>
                                </View>
                                <TouchableOpacity style={styles.deleteButton} onPress={() => {
                                    deleteDeviceFromList(token, `${device.id}`);
                                    getDevices(token).then((devices: DeviceProperties[]) => {
                                        setDevices(() => devices);
                                    });
                                }}>
                                    <Text style={styles.buttonText}>X</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={() => {
                                navigation.navigate("EditWifiSSid", {
                                    device_id: device.name,
                                    deviceUUID: device.id
                                });
                            }} style={styles.blueButton}>
                                <Text style={styles.whiteText}>Change Wifi SSID</Text>
                            </TouchableOpacity>
                        </View>
                    )
                })}
            </ScrollView>
            <Modal navigation={navigation}/>
        </>

    );
}

function deleteDeviceFromList(
    token:string,
    id:string
) {
    Alert.alert(
        "Usuwanie urządzenia",
        "Czy na pewno chcesz usunąć to urządzenie?",
        [
            {
                text: "Nie",
                style: "cancel"
            },
            {
                text: "Tak",
                onPress: () => {
                    console.log({
                        token,
                        id
                    })
                    unassignDevice(token, id)
                        .then((response) => {
                            console.log(JSON.stringify(response));
                        })
                        .catch((error) => {
                            console.log(error);
                        })
                }
            }
        ]
    )
}

let styles = StyleSheet.create({
    cardsContainer: {
        display:"flex",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 100
    },
    deviceCard: {
        backgroundColor: "#fff",
        margin: 10,
        width: "80%",
        borderRadius: 10,
        display:"flex",
        flexDirection:"row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    buttonText: {
        fontSize: 14,
        color: "white",
        textAlign: "center"
    },
    deleteButton: {
        backgroundColor: "red",
        padding: 10,
        borderRadius: 4,
        width: 40,
        height: 40,
        textAlign: "center",
    },
    deviceContainer: {
        display: "flex",
        alignItems: "center",
        backgroundColor: "#fff",
        marginBottom: 10,
        padding:10
    },
    blueButton: {
        backgroundColor: "blue",
        padding: 10,
        borderRadius: 4,
        width: "80%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginVertical: 10
    },
    whiteText: {
        color: "white"
    },
    centeredText: {
        textAlign: "center"
    },
    refreshButton: {
        backgroundColor: "blue",
        padding: 10,
        borderRadius: 4,
        width: "80%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginVertical: 10,
        alignSelf: "center"
    },
    grayText: {
        color: "gray",
        textAlign: "center",
        marginTop: 10
    }
})

