import React, { Component } from 'react'
import {
  AppState,
  Dimensions,
  FlatList,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} from 'react-native'
import {
  BleManager,
  Device,
  State,
  Service,
  Characteristic,
} from 'react-native-ble-plx'

const window = Dimensions.get('window')

const SCAN_TIMEOUT = 5000
const SERVICE_ID = 'ff21b22a-3544-e19b-fc4e-1908ef7e5c89'
const CHARACTERISTICS_ID = '64bd0651-5cbc-56a7-5d48-2672fe1abb37'

interface AppProps {}

interface AppState {
  scanning: boolean
  devices: Array<Device>
  connectedDevices: Array<string>
  appState: string
}

export default class App extends Component<AppProps, AppState> {

  public bleManager = new BleManager()

  public state = {
    scanning: false,
    devices: new Array<Device>(),
    connectedDevices: new Array<string>(),
    appState: '',
  }

  constructor (props) {
    super(props)

    this.handleDiscoverDevice = this.handleDiscoverDevice.bind(this)
    this.handleDisconnectedDevice = this.handleDisconnectedDevice.bind(
      this)
    this.handleAppStateChange = this.handleAppStateChange.bind(this)
    this.setDeviceFromState = this.setDeviceFromState.bind(this)
    this.deleteDeviceFromState = this.deleteDeviceFromState.bind(this)
    this.stopScan = this.stopScan.bind(this)
    this.test = this.test.bind(this)
    this.renderItem = this.renderItem.bind(this)
  }

  static HexToBase64 (str) {
    return btoa(String.fromCharCode.apply(null,
      str.replace(/\r|\n/g, '').
        replace(/([\da-fA-F]{2}) ?/g, '0x$1 ').
        replace(/ +$/, '').
        split(' ')),
    )
  }

  static Base64ToHex (base64) {
    const bin = atob(base64.replace(/[ \r\n]+$/, ''))
    let hex = []
    for (let i = 0; i < bin.length; ++i) {
      let tmp = bin.charCodeAt(i).toString(16)
      if (tmp.length === 1) {
        tmp = '0' + tmp
      }
      hex[hex.length] = tmp
    }
    return hex.join(' ')
  }

  async handleAppStateChange (nextAppState) {
    if (this.state.appState.match(/inactive|background/) && nextAppState ===
      'active') {
      console.log('App has come to the foreground!')
      const peripheralsArray = await this.bleManager.devices([])
      console.log('Connected peripherals: ' + peripheralsArray.length)
    }
    this.setState({ appState: nextAppState })
  }

  async componentDidMount () {
    AppState.addEventListener('change', this.handleAppStateChange)

    if (Platform.OS === 'android' && Platform.Version >= 23) {
      PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).
        then((result) => {
          if (result) {
            console.log('Permission is OK')
          }
          else {
            PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).
              then((result) => {
                if (result) {
                  console.log('User accept')
                }
                else {
                  console.log('User refuse')
                }
              })
          }
        })
    }
  }

  componentWillUnmount () {}

  handleDisconnectedDevice (device: Device): void {
    console.log('handleDisconnectedPeripheral')
    // const devices = this.deleteDeviceFromState(device)
    const connectedDevices = this.state.connectedDevices.filter(
      currentValue => currentValue !== device.id)
    this.setState({ connectedDevices })
    console.log(`Disconnected from ${device.id}`)
  }

  async startScan () {
    // check if ble is enabled
    const state = await this.bleManager.state()
    if (state !== State.PoweredOn) {
      alert('You must turn on your ble')
      return
    }
    if (!this.state.scanning) {
      this.bleManager.startDeviceScan(null, {
        allowDuplicates: false,
      }, this.handleDiscoverDevice)
      setTimeout(this.stopScan, SCAN_TIMEOUT)
      // await BleManager.scan([], 3, true)
      console.log('Scanning...')
      this.setState({ scanning: true })
    }
  }

  stopScan () {
    console.log('Scan is stopped')
    this.bleManager.stopDeviceScan()
    this.setState({ scanning: false })
  }

  handleDiscoverDevice (error, discoveredDevice: Device) {
    if (error) {
      console.error(error, error.stack)
      return
    }
    if (discoveredDevice && discoveredDevice.name === 'KMS01') {
      const devices = this.setDeviceFromState(discoveredDevice)
      this.setState({ devices })
    }
  }

  async connect (device: Device) {
    if (await this.bleManager.isDeviceConnected(device.id)) {
      try {
        await this.bleManager.cancelDeviceConnection(device.id)
        this.handleDisconnectedDevice(device)
      } catch (error) {
        console.error(error, error.stack)
      }
    }
    else {
      try {
        const connectedDevice = await this.bleManager.connectToDevice(device.id)
        await connectedDevice.discoverAllServicesAndCharacteristics()

        console.log(`Connected to device ${connectedDevice.id}`,
          connectedDevice)
        const devices = this.setDeviceFromState(connectedDevice)
        const connectedDevices = this.state.connectedDevices
        connectedDevices.push(connectedDevice.id)
        this.setState({ devices, connectedDevices })
      } catch (error) {
        console.error(error, error.stack)
      }
    }
  }

  setDeviceFromState (device: Device): Array<Device> {
    return this.state.devices.reduce((accumulator, currentValue) => {
      if (currentValue.id !== device.id) {
        accumulator.push(currentValue)
      }
      return accumulator
    }, [device])
  }

  deleteDeviceFromState (device: Device): Array<Device> {
    return this.state.devices.reduce((accumulator, currentValue) => {
      if (currentValue.id !== device.id) {
        accumulator.push(currentValue)
      }
      return accumulator
    }, [])
  }

  async test (device: Device): Promise<void> {
    const encodedValue = App.HexToBase64('13')
    console.log(encodedValue)
    const charac = await device.writeCharacteristicWithResponseForService(
      SERVICE_ID,
      CHARACTERISTICS_ID, encodedValue)
    const readCharac = await device.readCharacteristicForService(SERVICE_ID,
      CHARACTERISTICS_ID)
    console.log(readCharac, readCharac.value)
    // device.monitorCharacteristicForService(SERVICE_ID, CHARACTERISTICS_ID,
    // (error, characteristic) => { if (error) { console.error(error) return }
    // console.log(characteristic) })
  }

  renderItem ({ item }) {
    const isConnected = this.state.connectedDevices.includes(item.id)
    const color = isConnected ? 'green' : '#fff'
    return (
      <>
        <TouchableHighlight onPress={() => this.connect(item)}>
          <View style={[styles.row, { backgroundColor: color }]}>
            <Text style={{
              fontSize: 12,
              textAlign: 'center',
              color: '#333333',
              padding: 10,
            }}>{item.name}</Text>
            <Text style={{
              fontSize: 8,
              textAlign: 'center',
              color: '#333333',
              padding: 10,
            }}>{item.id}</Text>
          </View>
        </TouchableHighlight>
        {(isConnected) &&
        <TouchableHighlight onPress={() => this.test(item)}>
          <View style={[styles.row, { backgroundColor: color }]}>
            <Text style={{
              fontSize: 12,
              textAlign: 'center',
              color: '#333333',
              padding: 10,
            }}>Click</Text>
          </View>
        </TouchableHighlight>
        }
      </>
    )
  }

  render () {
    return (
      <View style={styles.container}>
        <TouchableHighlight style={{
          marginTop: 40,
          margin: 20,
          padding: 20,
          backgroundColor: '#ccc',
        }} onPress={() => this.startScan()}>
          <Text>Scan Bluetooth ({this.state.scanning ? 'on' : 'off'})</Text>
        </TouchableHighlight>
        <TouchableHighlight style={{
          marginTop: 0,
          margin: 20,
          padding: 20,
          backgroundColor: '#ccc',
        }} onPress={() => console.log('Make function')}>
          <Text>Retrieve connected peripherals</Text>
        </TouchableHighlight>
        <ScrollView style={styles.scroll}>
          {(this.state.devices.length === 0) &&
          <View style={{ flex: 1, margin: 20 }}>
            <Text style={{ textAlign: 'center' }}>No peripherals</Text>
          </View>
          }
          <FlatList
            keyExtractor={item => item.id}
            data={this.state.devices}
            extraData={this.state}
            renderItem={this.renderItem}
          />
        </ScrollView>
      </View>
    )
  }
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    width: window.width,
    height: window.height,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    margin: 10,
  },
  row: {
    margin: 10,
  },
})