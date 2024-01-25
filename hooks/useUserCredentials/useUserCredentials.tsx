import {createContext, useContext, useState, useEffect} from "react";
import {DeviceProperties} from "../../types/types";
import {getDevices} from "../Endpoints";

const UserCredentialsContext = createContext({
    verifiedLogin: '',
    setVerifiedLogin: (login: string) => {},
    verifiedPassword: '',
    setVerifiedPassword: (password: string) => {},
    token: '',
    setToken: (token: string) => {},
    devices: [] as DeviceProperties[],
    setDevices: (devices: (prev: DeviceProperties[]) => DeviceProperties[]) => {}
});

export function useUserCredentials () {
    return useContext(UserCredentialsContext);
}

export default function UserCredentialsProvider({children}: any) {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [token, setToken] = useState('');
    const [devicesArray, setDevicesArray] = useState([] as DeviceProperties[]);

    useEffect(() => {
        getDevices(token)
            .then((devices: DeviceProperties[]) => {
                setDevicesArray(devices);
                console.log(devices)
            })
            .catch((error) => {
                console.log(error);
            })
    }, [token]);

    return (
        <UserCredentialsContext.Provider value={{
            verifiedLogin: login,
            setVerifiedLogin: setLogin,
            verifiedPassword: password,
            setVerifiedPassword: setPassword,
            token: token,
            setToken: setToken,
            devices: devicesArray,
            setDevices: setDevicesArray,
        }}>
            {children}
        </UserCredentialsContext.Provider>
    )
}