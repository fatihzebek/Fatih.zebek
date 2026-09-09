Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d D:\Dh_Servis && node opc-bridge/bridge.js > opc_run.log 2>&1", 0, False
Set WshShell = Nothing
