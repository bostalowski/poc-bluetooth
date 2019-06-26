import React, { Component } from 'react'
import {
  StyleSheet,
  Text,
  View,
  TouchableHighlight,
  NativeEventEmitter,
  NativeModules,
  Platform,
  PermissionsAndroid,
  ListView,
  ScrollView,
  AppState,
  Dimensions,
} from 'react-native'
import BleManager from 'react-native-ble-manager'

const window = Dimensions.get('window')
const ds = new ListView.DataSource({ rowHasChanged: (r1, r2) => r1 !== r2 })

const BleManagerModule = NativeModules.BleManager
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule)

export default class App extends Component {
  constructor () {
    super()

    this.state = {
      scanning: false,
      peripherals: [],
      appState: '',
    }

    this.handleDiscoverPeripheral = this.handleDiscoverPeripheral.bind(this)
    this.handleStopScan = this.handleStopScan.bind(this)
    this.handleUpdateValueForCharacteristic = this.handleUpdateValueForCharacteristic.bind(
      this)
    this.handleDisconnectedPeripheral = this.handleDisconnectedPeripheral.bind(
      this)
    this.handleAppStateChange = this.handleAppStateChange.bind(this)
    this.handleDidUpdateState = this.handleDidUpdateState.bind(this)
    this.getPeripheralFromState = this.getPeripheralFromState.bind(this)
    this.setPeripheralFromState = this.setPeripheralFromState.bind(this)
    this.getBondedPeripherals = this.getBondedPeripherals.bind(this)
  }

  async componentDidMount () {
    AppState.addEventListener('change', this.handleAppStateChange)

    BleManager.start({ showAlert: false })

    this.handlerDiscover = bleManagerEmitter.addListener(
      'BleManagerDiscoverPeripheral', this.handleDiscoverPeripheral)
    this.handlerStop = bleManagerEmitter.addListener('BleManagerStopScan',
      this.handleStopScan)
    this.handlerDisconnect = bleManagerEmitter.addListener(
      'BleManagerDisconnectPeripheral', this.handleDisconnectedPeripheral)
    this.handlerUpdate = bleManagerEmitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      this.handleUpdateValueForCharacteristic)
    this.handleDidUpdateState = bleManagerEmitter.addListener(
      'BleManagerDidUpdateState',
      this.handleDidUpdateState)

    if (Platform.OS === 'android' && Platform.Version >= 23) {
      PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).
        then((result) => {
          if (result) {
            console.log('Permission is OK')
          }
          else {
            PermissionsAndroid.requestPermission(
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

  async handleAppStateChange (nextAppState) {
    console.log('handleAppStateChange')
    if (this.state.appState.match(/inactive|background/) && nextAppState ===
      'active') {
      console.log('App has come to the foreground!')
      const peripheralsArray = await BleManager.getConnectedPeripherals([])
      console.log('Connected peripherals: ' + peripheralsArray.length)
    }
    this.setState({ appState: nextAppState })
  }

  componentWillUnmount () {
    this.handlerDiscover.remove()
    this.handlerStop.remove()
    this.handlerDisconnect.remove()
    this.handlerUpdate.remove()
  }

  handleDisconnectedPeripheral (data) {
    console.log('handleDisconnectedPeripheral')
    data.peripheral.connected = false
    const peripherals = this.setPerihericalFromState(data.peripheral)
    this.setState({ peripherals })
    console.log('Disconnected from ' + data.peripheral)
  }

  handleUpdateValueForCharacteristic (data) {
    console.log('Received data from ' + data.peripheral + ' characteristic ' +
      data.characteristic, data.value)
  }

  handleStopScan () {
    console.log('Scan is stopped')
    this.setState({ scanning: false })
  }

  async startScan () {
    if (!this.state.scanning) {
      this.setState({ peripherals: [] })
      await BleManager.scan([], 3, true)
      console.log('Scanning...')
      this.setState({ scanning: true })
    }
  }

  async retrieveConnected () {
    const connectedPeripherals = await BleManager.getConnectedPeripherals([])
    if (connectedPeripherals.length === 0) {
      console.log('No connected peripherals')
    }
    console.log(connectedPeripherals)
    connectedPeripherals.forEach(connectedPeripheral => {
      connectedPeripheral.connected = true
      const peripherals = this.setPeripheralFromState(connectedPeripheral)

      this.setState({ peripherals })
    })
  }

  async getBondedPeripherals(peripheralId) {
    try {
      const services = await BleManager.retrieveServices(peripheralId)
      console.log(services)
    } catch (error) {
      console.error(error, error.stack)
    }
  }

  handleDiscoverPeripheral (discoveredPeripheral) {
    if (discoveredPeripheral.name === 'KMS01') {
      console.log('Got ble peripheral', discoveredPeripheral)
      const peripherals = this.setPeripheralFromState(discoveredPeripheral)
      console.log(peripherals)
      this.setState({ peripherals })
    }
  }

  handleDidUpdateState (data) {
    console.log('handleDidUpdateState')
  }

  async test (peripheral) {
    if (peripheral.connected) {
      try {
        await BleManager.disconnect(peripheral.id, true)
      } catch (error) {
        console.error(error, error.stack)
      }
    }
    else {
      try {
        await BleManager.connect(peripheral.id)
        peripheral.connected = true
        const peripherals = this.setPeripheralFromState(peripheral)
        this.setState({ peripherals })
        console.log('Connected to ' + peripheral.id)
        console.log(peripheral)
      } catch (error) {
        console.error(error, error.stack)
      }

          // setTimeout(() => {
          //
          //   /* Test read current RSSI value
          //   BleManager.retrieveServices(peripheral.id).then((peripheralData) => {
          //     console.log('Retrieved peripheral services', peripheralData)
          //
          //     BleManager.readRSSI(peripheral.id).then((rssi) => {
          //       console.log('Retrieved actual RSSI value', rssi)
          //     })
          //   })*/
          //
          //   // Test using bleno's pizza example
          //   // https://github.com/sandeepmistry/bleno/tree/master/examples/pizza
          //   // BleManager.retrieveServices(peripheral.id).then((peripheralInfo)
          //   // => { console.log(peripheralInfo) let service =
          //   // '13333333-3333-3333-3333-333333333337' let bakeCharacteristic =
          //   // '13333333-3333-3333-3333-333333330003' let crustCharacteristic =
          //   // '13333333-3333-3333-3333-333333330001'  setTimeout(() => {
          //   // BleManager.startNotification(peripheral.id, service,
          //   // bakeCharacteristic).then(() => { console.log('Started
          //   // notification on ' + peripheral.id) setTimeout(() => {
          //   // BleManager.write(peripheral.id, service, crustCharacteristic,
          //   // [0]).then(() => { console.log('Writed NORMAL crust')
          //   // BleManager.write(peripheral.id, service, bakeCharacteristic,
          //   // [1,95]).then(() => { console.log('Writed 351 temperature, the
          //   // pizza should be BAKED') /* let PizzaBakeResult = { HALF_BAKED:
          //   // 0, BAKED:      1, CRISPY:     2, BURNT:      3, ON_FIRE:    4
          //   // }*/ }) })  }, 500) }).catch((error) => {
          //   // console.log('Notification error', error) }) }, 200) })
          //
          // }, 900)
    }
  }

  getPeripheralFromState(peripheralId) {
    return this.state.peripherals.find(peripheral => {
      return peripheral.id === peripheralId
    })
  }

  setPeripheralFromState(peripheral) {
    return this.state.peripherals.reduce((accumulator, currentValue) => {
      if (currentValue.id !== peripheral.id) {
        accumulator.push(currentValue)
      }
      return accumulator
    }, [peripheral])
  }

  render () {
    const list = Array.from(this.state.peripherals.values())
    const dataSource = ds.cloneWithRows(list)

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
        }} onPress={() => this.retrieveConnected()}>
          <Text>Retrieve connected peripherals</Text>
        </TouchableHighlight>
        <ScrollView style={styles.scroll}>
          {(list.length === 0) &&
          <View style={{ flex: 1, margin: 20 }}>
            <Text style={{ textAlign: 'center' }}>No peripherals</Text>
          </View>
          }
          <ListView
            enableEmptySections={true}
            dataSource={dataSource}
            renderRow={(item) => {
              const color = item.connected ? 'green' : '#fff'
              return (
                <>
                  <TouchableHighlight onPress={() => this.test(item)}>
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
                  <TouchableHighlight onPress={() => this.getBondedPeripherals(item.id)}>
                    <View style={[styles.row, { backgroundColor: color }]}>
                      <Text style={{
                        fontSize: 12,
                        textAlign: 'center',
                        color: '#333333',
                        padding: 10,
                      }}>Click</Text>
                    </View>
                  </TouchableHighlight>
                </>
              )
            }}
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