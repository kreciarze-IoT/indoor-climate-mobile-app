import {
    View,
    Text,
    StyleSheet, TouchableOpacity, ScrollView, TextInput,
} from "react-native";
import {Picker} from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker"
import { colors } from "../../styles/global";
import Modal from "../../components/modal";
import {useUserCredentials} from "../../hooks/useUserCredentials/useUserCredentials";
import {SetStateAction, useEffect, useState} from "react";
import {getDevices, getRecords} from "../../hooks/Endpoints";
import Record from "../../components/weatherRecordCard";
import {DeviceProperties, WeatherRecord} from "../../types/types";
import Aes from "react-native-aes-crypto";



function Dashboard({navigation}: any) {
    let { verifiedLogin, token, devices, setDevices} = useUserCredentials();
    if(verifiedLogin === ""){ verifiedLogin = "User" }
    const [dateFrom, setDateFrom] = useState<Date>(new Date());
    const [dateTo, setDateTo] = useState<Date>(new Date());
    const [pickStartDate, setPickStartDate] = useState(false);
    const [pickEndDate, setPickEndDate] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<string>();
    const [records, setRecords] = useState([] as WeatherRecord[]);


    return (
        <>

            <ScrollView>
                <View>
                    <Text style={styles.welcomeText}>Welcome, {verifiedLogin}!</Text>
                    <Text> Choose device to display data from: </Text>
                    <Picker style={styles.picker} selectedValue={selectedDevice} onValueChange={
                        (itemValue, itemIndex) => {
                            setSelectedDevice(itemValue);
                        }
                    }>
                        {devices?.length > 0 && devices.map((device, index) => {
                            return (device.activated &&
                                <Picker.Item key={index} label={`Device ${device.id} (${device.name})`} value={device.id} />
                            )
                        })}
                    </Picker>
                    <Text style={styles.grayText}>Can't see your devices? Try to refresh</Text>
                    <TouchableOpacity style={styles.refreshButton} onPress={() => {
                        getDevices(token).then((devices: DeviceProperties[]) => {
                            setDevices(() => devices);
                        });
                    }
                    }>
                        <Text style={styles.buttonText}>Refresh</Text>
                    </TouchableOpacity>
                </View>
                <View>
                    <View style={styles.intervalsContainer}>
                        <TouchableOpacity style={styles.button} onPress={() => {
                            setPickStartDate(true);
                        } }>
                            <Text style={styles.text}>From: {dateFrom.toLocaleDateString()}</Text>
                        </TouchableOpacity>
                        {pickStartDate && (
                            <DateTimePicker value={dateFrom} mode="date" display="default" onChange={
                                (event, selectedDate) => {
                                    const currentDate = selectedDate || dateFrom;
                                    setDateFrom(currentDate);
                                    setPickStartDate(false);
                                }
                            } />
                        )}
                        <TouchableOpacity style={styles.button} onPress={() => {
                            setPickEndDate(true);
                        } }>
                            <Text style={styles.text}>To: {dateTo.toLocaleDateString()}</Text>
                        </TouchableOpacity>
                        {pickEndDate && (
                            <DateTimePicker value={dateTo} mode="date" display="default" onChange={
                                (event, selectedDate) => {
                                    const currentDate = selectedDate || dateTo;
                                    setDateTo(currentDate);
                                    setPickEndDate(false);
                                }
                            } />
                        )}

                        <View style={styles.submitButtonContainer}>

                            <TouchableOpacity style={styles.submitButton} onPress={() => {
                                getRecords(token, selectedDevice, dateFrom, dateTo)
                                    .then((data:WeatherRecord[]) => {
                                        console.log(data);
                                        setRecords(data);
                                    })
                                    .catch((error) => {
                                        console.log(error)
                                    }
                                )
                            }
                            }>
                                <Text style={styles.submitText}>Show data</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
                <Text>Records: </Text>
                <View>
                    {records.length > 0 && records.map((record: WeatherRecord, index) => {
                        return (
                            <Record key={index} record={record} />
                        )
                    })}
                </View>
            </ScrollView>
            <Modal navigation={navigation} />
        </>
    )
}

export default Dashboard;

let styles = StyleSheet.create({
    welcomeText: {
        fontSize: 24,
        textAlign: "center",
        marginTop: 10,
        marginBottom: 20,
        fontFamily: "montserrat-bold"
    },
    container: {
        marginTop: 10,
        height: "20%",
        alignItems: "center",
    },
    text: {
        fontSize: 16,
        textAlign: "center"
    },
    connectionText: {
        fontSize: 14,
        paddingVertical: 10,
        fontFamily: "montserrat-bold",
        borderBottomColor: colors.gray,
        borderBottomWidth: 1
    },
    info: {
        marginVertical: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
    },
    button: {
        backgroundColor: colors.gray,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
        margin: 10,
        maxWidth: "50%",
    },
    picker: {
        width: "100%",
        height: 50,
        backgroundColor: colors.gray,
        borderRadius: 10,
        marginBottom: 10
    },
    infoText: {
        fontSize: 16,
        paddingVertical: 10,
    },
    intervalsContainer: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
        flexWrap: "wrap"
    },
    submitButtonContainer: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        width: "100%",
    },
    submitButton: {
        backgroundColor: colors.primary,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
        margin: 10,
        maxWidth: "50%",
    },
    submitText:{
        color: colors.white,
        fontSize: 14,
        fontFamily: "montserrat-bold",
        textAlign: "center"
    },
    numberInput: {
        height: 50,
        backgroundColor: colors.gray,
        borderRadius: 10,
        margin: 10,
        paddingHorizontal: 10,
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
    },
    buttonText: {
        fontSize: 14,
        color: "white",
        textAlign: "center"
    }
});
