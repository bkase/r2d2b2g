const AdbOpenAccessType = ctypes.int;
const AdbOpenSharingMode = ctypes.int;
const AdbInterfaceInfo =
  new ctypes.StructType("AdbInterfaceInfo");
const GUID =
  new ctypes.StructType("GUID", [
    { "Data1": ctypes.uint64_t },
    { "Data2": ctypes.uint16_t },
    { "Data3": ctypes.uint16_t },
    { "Data4": ctypes.ArrayType(ctypes.uint8_t, 8) }
  ]);
const ADBAPIHANDLE = ctypes.void_t.ptr;
const wchar_t = ctypes.jschar;
const bool = ctypes.int;
const USB_DEVICE_DESCRIPTOR =
  new ctypes.StructType("USB_DEVICE_DESCRIPTOR");
const USB_CONFIGURATION_DESCRIPTOR =
  new ctypes.StructType("USB_CONFIGURATION_DESCRIPTOR");
const USB_INTERFACE_DESCRIPTOR =
  new ctypes.StructType("USB_INTERFACE_DESCRIPTOR");
const AdbEndpointInformation =
  new ctypes.StructType("AdbEndpointInformation");
const HANDLE = ctypes.void_t.ptr;
const LPOVERLAPPED = ctypes.void_t.ptr;

const AdbReadEndpointAsyncType =
  ctypes.FunctionType(ctypes.default_abi, ADBAPIHANDLE, [ ctypes.void_t.ptr, ctypes.uint64_t, ctypes.uint64_t.ptr, ctypes.uint64_t, HANDLE ]);
const AdbWriteEndpointAsyncType =
  ctypes.FunctionType(ctypes.default_abi, ADBAPIHANDLE, [ ADBAPIHANDLE, ctypes.void_t.ptr, ctypes.uint64_t, ctypes.uint64_t.ptr, ctypes.uint64_t, HANDLE ]);
const AdbReadEndpointSyncType =
  ctypes.FunctionType(ctypes.default_abi, bool, [ ADBAPIHANDLE, ctypes.void_t.ptr, ctypes.uint64_t, ctypes.uint64_t.ptr, ctypes.uint64_t ]);
const AdbWriteEndpointSyncType =
  ctypes.FunctionType(ctypes.default_abi, bool, [ ADBAPIHANDLE, ctypes.void_t.ptr, ctypes.uint64_t, ctypes.uint64_t.ptr, ctypes.uint64_t ]);

const AdbEnumInterfacesType =
  ctypes.FunctionType(ctypes.default_abi, ADBAPIHANDLE, [ GUID, bool, bool, bool ]);
const AdbCreateInterfaceByNameType = 
  ctypes.FunctionType(ctypes.default_abi, ADBAPIHANDLE, [ wchar_t.ptr ]);
const AdbCreateInterfaceType = 
  ctypes.FunctionType(ctypes.default_abi, ADBAPIHANDLE, [ GUID, ctypes.uint16_t, ctypes.uint16_t, ctypes.uint8_t ]);
const AdbGetInterfaceNameType =
  ctypes.FunctionType(ctypes.default_abi, bool, [ ADBAPIHANDLE, ctypes.void_t.ptr, ctypes.uint64_t.ptr, bool ]);
const AdbGetSerialNumberType =
  ctypes.FunctionType(ctypes.default_abi, bool, [ ADBAPIHANDLE, ctypes.void_t.ptr, ctypes.uint64_t.ptr, bool ]);
const AdbGetUsbDeviceDescriptorType = 
  ctypes.FunctionType(ctypes.default_abi, bool, [ ADBAPIHANDLE, USB_DEVICE_DESCRIPTOR.ptr ]);
const AdbGetUsbConfigurationDescriptorType =
  ctypes.FunctionType(ctypes.default_abi, bool, [ ADBAPIHANDLE, USB_CONFIGURATION_DESCRIPTOR.ptr ]);
const AdbGetUsbInterfaceDescriptorType =
  ctypes.FunctionType(ctypes.default_abi, bool, [ ADBAPIHANDLE, USB_INTERFACE_DESCRIPTOR.ptr ]);
const AdbGetEndpointInformationType =
  ctypes.FunctionType(ctypes.default_abi, bool, [ ADBAPIHANDLE, ctypes.uint8_t, AdbEndpointInformation.ptr ]);
const AdbGetDefaultBulkReadEndpointInformationType =
  ctypes.FunctionType(ctypes.default_abi, bool, [ ADBAPIHANDLE, AdbEndpointInformation.ptr ]);
const AdbGetDefaultBulkWriteEndpointInformationType =
  ctypes.FunctionType(ctypes.default_abi, bool, [ ADBAPIHANDLE, AdbEndpointInformation.ptr ]);
const AdbOpenEndpointType =
  ctypes.FunctionType(ctypes.default_abi, ADBAPIHANDLE, [ ADBAPIHANDLE, ctypes.uint8_t, AdbOpenAccessType, AdbOpenSharingMode ]);
const AdbOpenDefaultBulkReadEndpointType =
  ctypes.FunctionType(ctypes.default_abi, ADBAPIHANDLE, [ ADBAPIHANDLE, AdbOpenAccessType, AdbOpenSharingMode ]);
const AdbOpenDefaultBulkWriteEndpointType =
  ctypes.FunctionType(ctypes.default_abi, ADBAPIHANDLE, [ ADBAPIHANDLE, AdbOpenAccessType, AdbOpenSharingMode ]);
const AdbGetEndpointInterfaceType =
  ctypes.FunctionType(ctypes.default_abi, ADBAPIHANDLE, [ ADBAPIHANDLE ]);
const AdbQueryInformationEndpointType =
  ctypes.FunctionType(ctypes.default_abi, bool, [ ADBAPIHANDLE, AdbEndpointInformation.ptr ]);
const AdbGetOvelappedIoResultType =
  ctypes.FunctionType(ctypes.default_abi, bool, [ ADBAPIHANDLE, LPOVERLAPPED, ctypes.uint64_t.ptr, bool ]);
const AdbHasOvelappedIoComplatedType =
  ctypes.FunctionType(ctypes.default_abi, bool, [ ADBAPIHANDLE ]);
const AdbCloseHandleType =
  ctypes.FunctionType(ctypes.default_abi, bool, [ ADBAPIHANDLE ]);
const AdbNextInterfaceType =
  ctypes.FunctionType(ctypes.default_abi, bool, [ ADBAPIHANDLE, AdbInterfaceInfo.ptr, ctypes.uint64_t.ptr ]);

const atransport = 
  new ctypes.StructType("atransport");

const struct_adb_main_input =
  new ctypes.StructType("adb_main_input", [
    { is_daemon: ctypes.int },
    { server_port: ctypes.int },
    { is_lib_call: ctypes.int },

    { exit_fd: ctypes.int },

    { spawnIO: ctypes.FunctionType(ctypes.default_abi, ctypes.int, [ atransport.ptr ]).ptr },
    { spawnD: ctypes.FunctionType(ctypes.default_abi, ctypes.int).ptr }
  ]);
