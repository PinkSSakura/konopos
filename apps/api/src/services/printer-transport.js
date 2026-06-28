const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const net = require('net');
const {
  CONNECTION_USB,
  normalizeConnectionType,
  getPrinterTarget,
} = require('../utils/printer-config');

const execFileAsync = promisify(execFile);

const RAW_PRINTER_PS = `
param(
  [Parameter(Mandatory=$true)][string]$PrinterName,
  [Parameter(Mandatory=$true)][string]$FilePath
)
$bytes = [System.IO.File]::ReadAllBytes($FilePath)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class TouDevRawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFO {
        public string pDocName;
        public string pOutputFile;
        public string pDataType;
    }
    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, [In] DOCINFO di);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);
}
"@
$h = [IntPtr]::Zero
if (-not [TouDevRawPrinter]::OpenPrinter($PrinterName, [ref]$h, [IntPtr]::Zero)) {
    throw "Impossible d'ouvrir l'imprimante Windows : $PrinterName"
}
try {
    $di = New-Object TouDevRawPrinter+DOCINFO
    $di.pDocName = "TouDev"
    $di.pDataType = "RAW"
    if (-not [TouDevRawPrinter]::StartDocPrinter($h, 1, $di)) {
        throw "StartDocPrinter a echoue pour $PrinterName"
    }
    try {
        if (-not [TouDevRawPrinter]::StartPagePrinter($h)) {
            throw "StartPagePrinter a echoue pour $PrinterName"
        }
        try {
            $written = 0
            if (-not [TouDevRawPrinter]::WritePrinter($h, $bytes, $bytes.Length, [ref]$written)) {
                throw "WritePrinter a echoue pour $PrinterName"
            }
        } finally {
            [TouDevRawPrinter]::EndPagePrinter($h) | Out-Null
        }
    } finally {
        [TouDevRawPrinter]::EndDocPrinter($h) | Out-Null
    }
} finally {
    [TouDevRawPrinter]::ClosePrinter($h) | Out-Null
}
`;

function sendToTcpPrinter(host, port, data, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };

    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => finish(new Error(`Timeout imprimante ${host}:${port}`)));
    socket.on('error', (err) => finish(err));
    socket.connect(port, host, () => {
      socket.write(data, (err) => {
        if (err) return finish(err);
        socket.end();
        finish();
      });
    });
  });
}

async function writeTempPrintFile(data) {
  const tempFile = path.join(os.tmpdir(), `TouDev-print-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);
  await fs.promises.writeFile(tempFile, data);
  return tempFile;
}

async function removeTempPrintFile(tempFile) {
  await fs.promises.unlink(tempFile).catch(() => {});
}

async function sendRawToWindowsPrinter(printerName, data) {
  const tempFile = await writeTempPrintFile(data);
  const scriptFile = path.join(os.tmpdir(), `TouDev-print-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`);
  await fs.promises.writeFile(scriptFile, RAW_PRINTER_PS, 'utf8');
  try {
    await execFileAsync(
      'powershell',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptFile,
        '-PrinterName',
        printerName,
        '-FilePath',
        tempFile,
      ],
      { windowsHide: true, timeout: 20000, maxBuffer: 1024 * 1024 },
    );
  } finally {
    await removeTempPrintFile(tempFile);
    await fs.promises.unlink(scriptFile).catch(() => {});
  }
}

async function sendRawToCupsPrinter(printerName, data) {
  const tempFile = await writeTempPrintFile(data);
  try {
    await execFileAsync('lp', ['-d', printerName, '-o', 'raw', tempFile], {
      windowsHide: true,
      timeout: 20000,
      maxBuffer: 1024 * 1024,
    });
  } finally {
    await removeTempPrintFile(tempFile);
  }
}

async function sendToUsbPrinter(usbName, data) {
  const name = String(usbName || '').trim();
  if (!name) {
    throw new Error('Nom d\'imprimante USB requis.');
  }

  if (process.platform === 'win32') {
    await sendRawToWindowsPrinter(name, data);
    return;
  }

  if (process.platform === 'linux' || process.platform === 'darwin') {
    await sendRawToCupsPrinter(name, data);
    return;
  }

  throw new Error(`Impression USB non supportee sur ${process.platform}.`);
}

async function sendBufferToPrinter(printer, data) {
  const connection_type = normalizeConnectionType(printer?.connection_type);
  if (connection_type === CONNECTION_USB) {
    await sendToUsbPrinter(printer.usb_name, data);
    return { connection_type, target: getPrinterTarget(printer) };
  }

  const host = String(printer?.host || '').trim();
  const port = Number(printer?.port) || 9100;
  if (!host) {
    throw new Error('Adresse IP imprimante requise.');
  }
  await sendToTcpPrinter(host, port, data);
  return { connection_type, target: getPrinterTarget(printer) };
}

async function listWindowsPrinters() {
  const { stdout } = await execFileAsync(
    'powershell',
    ['-NoProfile', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name'],
    { windowsHide: true, maxBuffer: 1024 * 1024 },
  );
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function listCupsPrinters() {
  try {
    const { stdout } = await execFileAsync('lpstat', ['-a'], {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/)[0])
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function listSystemPrinters() {
  if (process.platform === 'win32') {
    return listWindowsPrinters();
  }
  if (process.platform === 'linux' || process.platform === 'darwin') {
    return listCupsPrinters();
  }
  return [];
}

module.exports = {
  sendToTcpPrinter,
  sendToUsbPrinter,
  sendBufferToPrinter,
  listSystemPrinters,
};
