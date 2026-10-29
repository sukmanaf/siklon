using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Ports;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

namespace PresenSeeScanner
{
    class Program
    {
        [DllImport("kernel32.dll")]
        static extern bool AllocConsole();

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern IntPtr GetStdHandle(int nStdHandle);

        [DllImport("kernel32.dll")]
        static extern bool GetConsoleMode(IntPtr hConsoleHandle, out uint lpMode);

        [DllImport("kernel32.dll")]
        static extern bool SetConsoleMode(IntPtr hConsoleHandle, uint dwMode);

        const int STD_INPUT_HANDLE = -10;
        const uint ENABLE_QUICK_EDIT = 0x0040;
        const uint ENABLE_EXTENDED_FLAGS = 0x0080;

        [STAThread]
        static void Main(string[] args)
        {
            // 1. Muat konfigurasi lebih awal untuk memeriksa opsi showConsole
            AgentConfig cfg = AgentConfig.Load();

            // 2. Proteksi Single Instance: Mencegah agen terbuka 2 kali secara bersamaan
            bool createdNew;
            using (Mutex mutex = new Mutex(true, "PresenSeeScannerAgent_SingleInstance_Mutex", out createdNew))
            {
                if (!createdNew)
                {
                    if (cfg.ShowConsole)
                    {
                        AllocConsole();
                        Console.ForegroundColor = ConsoleColor.Yellow;
                        Console.WriteLine("====================================================================");
                        Console.WriteLine("  [PERINGATAN] Agen Scanner sudah aktif berjalan di komputer ini!   ");
                        Console.WriteLine("====================================================================");
                        Console.ResetColor();
                        Console.WriteLine("Hanya boleh ada 1 agen yang berjalan agar pembacaan scanner tidak bentrok.");
                        Console.WriteLine("Jendela ini akan otomatis ditutup dalam 3 detik...");
                        Thread.Sleep(3000);
                    }
                    return;
                }

                // 3. Tampilkan jendela konsol HANYA jika showConsole bernilai true (Debug Mode)
                if (cfg.ShowConsole)
                {
                    AllocConsole();

                    // Nonaktifkan QuickEdit agar klik mouse pada jendela CMD tidak mem-pause program
                    try
                    {
                        IntPtr consoleHandle = GetStdHandle(STD_INPUT_HANDLE);
                        uint consoleMode;
                        if (GetConsoleMode(consoleHandle, out consoleMode))
                        {
                            consoleMode &= ~ENABLE_QUICK_EDIT;
                            consoleMode |= ENABLE_EXTENDED_FLAGS;
                            SetConsoleMode(consoleHandle, consoleMode);
                        }
                    }
                    catch { }

                    Console.Title = "PresenSee - Agen Scanner Presensi (Debug Mode)";
                    Console.ForegroundColor = ConsoleColor.Cyan;
                    Console.WriteLine("====================================================================");
                    Console.WriteLine("     PRESENSEE - AGEN SCANNER PRESENSI ALL-IN-ONE (DEBUG MODE)      ");
                    Console.WriteLine("====================================================================");
                    Console.ResetColor();
                    Console.WriteLine("Biarkan jendela ini tetap terbuka untuk melihat proses pembacaan scanner.");
                    Console.WriteLine("Tekan Ctrl+C untuk menutup aplikasi.");
                    Console.WriteLine();
                }

                AgentCore.Initialize(cfg);

                // Jalankan Windows message loop untuk Raw Input Keyboard dan Serial COM
                Application.Run(new ScannerForm());
            }
        }
    }

    public class AgentConfig
    {
        public string ApiUrl = "http://localhost:5050/api/v1";
        public string ApiKey = "presensee-scanner-api-key-2026";
        public string Gate = "";
        public string Mode = "AUTO"; // "AUTO", "KEYBOARD", atau "COM"
        public bool ShowConsole = false; // false = jalan di belakang layar, true = tampilkan jendela hitam
        public string Port = "AUTO"; // "AUTO" atau "COM3", dll.
        public int BaudRate = 9600;
        public int DebounceSeconds = 3;

        public static AgentConfig Load()
        {
            AgentConfig cfg = new AgentConfig();
            try
            {
                string configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
                if (File.Exists(configPath))
                {
                    string json = File.ReadAllText(configPath);

                    Match urlMatch = Regex.Match(json, @"""apiUrl""\s*:\s*""([^""]+)""");
                    if (urlMatch.Success) cfg.ApiUrl = urlMatch.Groups[1].Value.Trim().TrimEnd('/');

                    Match keyMatch = Regex.Match(json, @"""apiKey""\s*:\s*""([^""]+)""");
                    if (keyMatch.Success) cfg.ApiKey = keyMatch.Groups[1].Value.Trim();

                    Match gateMatch = Regex.Match(json, @"""gate""\s*:\s*""([^""]*)""");
                    if (gateMatch.Success) cfg.Gate = gateMatch.Groups[1].Value.Trim();

                    Match modeMatch = Regex.Match(json, @"""mode""\s*:\s*""([^""]+)""", RegexOptions.IgnoreCase);
                    if (modeMatch.Success) cfg.Mode = modeMatch.Groups[1].Value.Trim().ToUpperInvariant();

                    Match showMatch = Regex.Match(json, @"""showConsole""\s*:\s*(true|false)", RegexOptions.IgnoreCase);
                    if (showMatch.Success)
                    {
                        cfg.ShowConsole = (showMatch.Groups[1].Value.ToLower() == "true");
                    }
                    else
                    {
                        Match dbgMatch = Regex.Match(json, @"""debug""\s*:\s*(true|false)", RegexOptions.IgnoreCase);
                        if (dbgMatch.Success)
                        {
                            cfg.ShowConsole = (dbgMatch.Groups[1].Value.ToLower() == "true");
                        }
                    }

                    Match portMatch = Regex.Match(json, @"""port""\s*:\s*""([^""]+)""", RegexOptions.IgnoreCase);
                    if (portMatch.Success) cfg.Port = portMatch.Groups[1].Value.Trim().ToUpperInvariant();

                    Match baudMatch = Regex.Match(json, @"""baudRate""\s*:\s*(\d+)");
                    if (baudMatch.Success) int.TryParse(baudMatch.Groups[1].Value, out cfg.BaudRate);

                    Match debMatch = Regex.Match(json, @"""debounceSeconds""\s*:\s*(\d+)");
                    if (debMatch.Success) int.TryParse(debMatch.Groups[1].Value, out cfg.DebounceSeconds);
                }
            }
            catch (Exception ex)
            {
                AgentLog.Warn("Gagal membaca config.json, memakai setelan default: " + ex.Message);
            }

            // Normalisasi ApiUrl: pastikan berakhiran /api/v1
            if (!cfg.ApiUrl.EndsWith("/api/v1") && !cfg.ApiUrl.Contains("/api/v1"))
            {
                cfg.ApiUrl = cfg.ApiUrl + "/api/v1";
            }

            return cfg;
        }
    }

    public static class AgentLog
    {
        static readonly object fileLock = new object();
        static readonly string logFilePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "scanner.log");

        public static void Info(string message) { Write(message, ConsoleColor.Cyan, "[INFO] "); }
        public static void Ok(string message) { Write(message, ConsoleColor.Green, "[OK] "); }
        public static void Warn(string message) { Write(message, ConsoleColor.Yellow, "[PERINGATAN] "); }
        public static void Error(string message) { Write(message, ConsoleColor.Red, "[ERROR] "); }
        public static void Scan(string source, string nis) { Write(string.Format("[SCAN: {0}] Membaca NIS: {1}", source, nis), ConsoleColor.White, ""); }
        public static void Debounce(string nis, double elapsed) { Write(string.Format("[DEBOUNCE] NIS {0} diabaikan (sudah scan {1:0.0}s lalu)", nis, elapsed), ConsoleColor.DarkYellow, ""); }

        public static void Write(string message, ConsoleColor color, string prefix)
        {
            string timestamp = DateTime.Now.ToString("HH:mm:ss");
            string fullMessage = string.Format("[{0}] {1}{2}", timestamp, prefix, message);

            if (AgentCore.Config != null && AgentCore.Config.ShowConsole)
            {
                try
                {
                    Console.ForegroundColor = color;
                    Console.WriteLine(fullMessage);
                    Console.ResetColor();
                }
                catch { }
            }

            // Simpan ke scanner.log agar riwayat presensi / kendala tetap tercatat
            try
            {
                lock (fileLock)
                {
                    FileInfo fi = new FileInfo(logFilePath);
                    if (fi.Exists && fi.Length > 2 * 1024 * 1024) // Jika file > 2MB, arsipkan
                    {
                        string oldPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "scanner.old.log");
                        if (File.Exists(oldPath)) File.Delete(oldPath);
                        File.Move(logFilePath, oldPath);
                    }

                    string logLine = string.Format("[{0:yyyy-MM-dd HH:mm:ss}] {1}{2}{3}", DateTime.Now, prefix, message, Environment.NewLine);
                    File.AppendAllText(logFilePath, logLine, Encoding.UTF8);
                }
            }
            catch { }
        }
    }

    public static class AgentCore
    {
        public static AgentConfig Config { get; private set; }
        private static readonly Dictionary<string, DateTime> lastScanTimes = new Dictionary<string, DateTime>();
        private static readonly object scanLock = new object();

        public static void Initialize(AgentConfig cfg)
        {
            Config = cfg;

            // Aktifkan dukungan TLS 1.2 untuk koneksi HTTPS ke Cloud (Vercel/Render)
            try
            {
                ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | SecurityProtocolType.Tls;
            }
            catch { }

            AgentLog.Info(string.Format("Target API   : {0}", Config.ApiUrl));
            AgentLog.Info(string.Format("Mode Scanner : {0}", Config.Mode));
            if (!string.IsNullOrEmpty(Config.Gate))
            {
                AgentLog.Info(string.Format("Gerbang      : {0}", Config.Gate));
            }
            if (Config.Mode == "AUTO" || Config.Mode == "COM")
            {
                AgentLog.Info(string.Format("Serial Port  : {0} (Baud: {1})", Config.Port, Config.BaudRate));
            }
            AgentLog.Info(string.Format("Anti Double  : {0} detik", Config.DebounceSeconds));
            AgentLog.Info(string.Format("Mode Tampilan: {0}", Config.ShowConsole ? "Jendela Konsol (Debug)" : "Latar Belakang (Silent)"));
        }

        public static void DispatchScan(string rawNis, string source)
        {
            string nis = Regex.Replace(rawNis ?? "", @"[^\w\-]", "").Trim();
            if (string.IsNullOrEmpty(nis) || nis.Length < 3) return;

            DateTime now = DateTime.Now;
            lock (scanLock)
            {
                if (lastScanTimes.ContainsKey(nis))
                {
                    double elapsed = (now - lastScanTimes[nis]).TotalSeconds;
                    if (elapsed < Config.DebounceSeconds)
                    {
                        AgentLog.Debounce(nis, elapsed);
                        return;
                    }
                }
                lastScanTimes[nis] = now;
            }

            AgentLog.Scan(source, nis);

            ThreadPool.QueueUserWorkItem(delegate(object state)
            {
                SendToServer(nis, source);
            });
        }

        private static void SendToServer(string nis, string source)
        {
            try
            {
                string endpoint = Config.ApiUrl.TrimEnd('/') + "/scans";
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(endpoint);
                request.Method = "POST";
                request.ContentType = "application/json";
                request.Headers["X-Api-Key"] = Config.ApiKey;
                request.Timeout = 8000;

                string json;
                if (!string.IsNullOrEmpty(Config.Gate))
                {
                    json = string.Format("{{\"nis\":\"{0}\",\"portPath\":\"{1}\",\"gate\":\"{2}\"}}", nis, source, Config.Gate);
                }
                else
                {
                    json = string.Format("{{\"nis\":\"{0}\",\"portPath\":\"{1}\"}}", nis, source);
                }

                byte[] data = Encoding.UTF8.GetBytes(json);
                request.ContentLength = data.Length;

                using (Stream stream = request.GetRequestStream())
                {
                    stream.Write(data, 0, data.Length);
                }

                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                using (StreamReader reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
                {
                    string body = reader.ReadToEnd();
                    ParseAndDisplayResponse(nis, body);
                }
            }
            catch (WebException wex)
            {
                string errMsg = wex.Message;
                if (wex.Response != null)
                {
                    try
                    {
                        using (StreamReader reader = new StreamReader(wex.Response.GetResponseStream(), Encoding.UTF8))
                        {
                            string errBody = reader.ReadToEnd();
                            Match msgMatch = Regex.Match(errBody, @"""message""\s*:\s*""([^""]+)""");
                            if (msgMatch.Success) errMsg = msgMatch.Groups[1].Value;
                            else
                            {
                                Match errMatch = Regex.Match(errBody, @"""error""\s*:\s*""([^""]+)""");
                                if (errMatch.Success) errMsg = errMatch.Groups[1].Value;
                            }
                        }
                    }
                    catch { }
                }

                AgentLog.Error(string.Format("Server menolak: {0}", errMsg));
            }
            catch (Exception ex)
            {
                AgentLog.Error(string.Format("Gagal mengirim ke server: {0}", ex.Message));
            }
        }

        private static void ParseAndDisplayResponse(string nis, string responseBody)
        {
            try
            {
                Match okMatch = Regex.Match(responseBody, @"""ok""\s*:\s*(true|false)");
                bool ok = okMatch.Success && okMatch.Groups[1].Value.ToLower() == "true";

                Match msgMatch = Regex.Match(responseBody, @"""pesan""\s*:\s*""([^""]+)""");
                string pesan = msgMatch.Success ? msgMatch.Groups[1].Value : "Scan berhasil";

                Match namaMatch = Regex.Match(responseBody, @"""nama""\s*:\s*""([^""]+)""");
                string nama = namaMatch.Success ? namaMatch.Groups[1].Value : "";

                Match kelasMatch = Regex.Match(responseBody, @"""kelas""\s*:\s*""([^""]+)""");
                string kelas = kelasMatch.Success ? kelasMatch.Groups[1].Value : "";

                Match statusMatch = Regex.Match(responseBody, @"""status""\s*:\s*""([^""]+)""");
                string status = statusMatch.Success ? statusMatch.Groups[1].Value : "";

                StringBuilder sb = new StringBuilder();
                if (!string.IsNullOrEmpty(nama))
                {
                    sb.Append(nama);
                    if (!string.IsNullOrEmpty(kelas)) sb.Append(" (" + kelas + ")");
                    sb.Append(" — ");
                }
                sb.Append(pesan);
                if (!string.IsNullOrEmpty(status)) sb.Append(" [" + status + "]");

                if (ok)
                {
                    AgentLog.Ok(sb.ToString());
                }
                else
                {
                    AgentLog.Warn(sb.ToString());
                }
            }
            catch
            {
                AgentLog.Ok("Terkirim ke server.");
            }
        }
    }

    class ScannerForm : Form
    {
        [DllImport("user32.dll")]
        static extern bool RegisterRawInputDevices(RAWINPUTDEVICE[] pRawInputDevices, uint uiNumDevices, uint cbSize);

        [DllImport("user32.dll")]
        static extern uint GetRawInputData(IntPtr hRawInput, uint uiCommand, IntPtr pData, ref uint pcbSize, uint cbSizeHeader);

        [StructLayout(LayoutKind.Sequential)]
        struct RAWINPUTDEVICE
        {
            public ushort usUsagePage;
            public ushort usUsage;
            public uint dwFlags;
            public IntPtr hwndTarget;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct RAWINPUTHEADER
        {
            public uint dwType;
            public uint dwSize;
            public IntPtr hDevice;
            public IntPtr wParam;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct RAWKEYBOARD
        {
            public ushort MakeCode;
            public ushort Flags;
            public ushort Reserved;
            public ushort VKey;
            public uint Message;
            public uint ExtraInformation;
        }

        const int WM_INPUT = 0x00FF;
        const int RID_INPUT = 0x10000003;
        const int RIM_TYPEKEYBOARD = 1;
        const int WM_KEYDOWN = 0x0100;

        readonly Dictionary<IntPtr, StringBuilder> kbBuffers = new Dictionary<IntPtr, StringBuilder>();
        readonly Dictionary<IntPtr, DateTime> kbLastTimes = new Dictionary<IntPtr, DateTime>();

        ComScannerEngine comEngine;

        public ScannerForm()
        {
            this.ShowInTaskbar = false;
            this.WindowState = FormWindowState.Minimized;

            string mode = AgentCore.Config.Mode;

            // Inisialisasi Raw Input Keyboard jika mode AUTO atau KEYBOARD
            if (mode == "AUTO" || mode == "KEYBOARD")
            {
                RAWINPUTDEVICE[] rid = new RAWINPUTDEVICE[1];
                rid[0].usUsagePage = 0x01;
                rid[0].usUsage = 0x06;
                rid[0].dwFlags = 0x00000100; // RIDEV_INPUTSINK (menangkap input meski jendela di background)
                rid[0].hwndTarget = this.Handle;

                if (RegisterRawInputDevices(rid, (uint)rid.Length, (uint)Marshal.SizeOf(rid[0])))
                {
                    AgentLog.Ok("Raw Input Keyboard aktif (siap menerima scanner USB HID).");
                }
                else
                {
                    AgentLog.Error("Gagal mendaftarkan Raw Input Keyboard.");
                }
            }

            // Inisialisasi Serial / COM Listener jika mode AUTO atau COM
            if (mode == "AUTO" || mode == "COM")
            {
                comEngine = new ComScannerEngine();
                comEngine.Start();
            }

            AgentLog.Info("Menunggu pembacaan barcode/kartu...");
        }

        protected override void SetVisibleCore(bool value)
        {
            base.SetVisibleCore(false);
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_INPUT)
            {
                uint dataSize = 0;
                uint headerSize = (uint)Marshal.SizeOf(typeof(RAWINPUTHEADER));
                GetRawInputData(m.LParam, RID_INPUT, IntPtr.Zero, ref dataSize, headerSize);
                if (dataSize > 0)
                {
                    IntPtr outBuffer = Marshal.AllocHGlobal((int)dataSize);
                    try
                    {
                        if (GetRawInputData(m.LParam, RID_INPUT, outBuffer, ref dataSize, headerSize) == dataSize)
                        {
                            RAWINPUTHEADER header = (RAWINPUTHEADER)Marshal.PtrToStructure(outBuffer, typeof(RAWINPUTHEADER));
                            if (header.dwType == RIM_TYPEKEYBOARD)
                            {
                                IntPtr kbPtr = new IntPtr(outBuffer.ToInt64() + headerSize);
                                RAWKEYBOARD kb = (RAWKEYBOARD)Marshal.PtrToStructure(kbPtr, typeof(RAWKEYBOARD));
                                if (kb.Message == WM_KEYDOWN)
                                {
                                    ProcessRawKey(header.hDevice, kb.VKey);
                                }
                            }
                        }
                    }
                    finally
                    {
                        Marshal.FreeHGlobal(outBuffer);
                    }
                }
            }
            base.WndProc(ref m);
        }

        void ProcessRawKey(IntPtr deviceId, ushort vkey)
        {
            DateTime now = DateTime.Now;

            if (!kbBuffers.ContainsKey(deviceId))
            {
                kbBuffers[deviceId] = new StringBuilder();
                kbLastTimes[deviceId] = now;
            }

            // Filter ketikan manusia: Barcode scanner mengirim karakter sangat cepat (< 60ms).
            // Jika jeda > 60ms, reset buffer agar ketikan biasa di keyboard tidak tertangkap sebagai NIS.
            if ((now - kbLastTimes[deviceId]).TotalMilliseconds > 60)
            {
                kbBuffers[deviceId].Length = 0;
            }
            kbLastTimes[deviceId] = now;

            if (vkey == 13) // Enter
            {
                string nis = kbBuffers[deviceId].ToString().Trim();
                kbBuffers[deviceId].Length = 0;
                if (nis.Length >= 3)
                {
                    AgentCore.DispatchScan(nis, "KEYBOARD");
                }
            }
            else
            {
                // Karakter angka 0-9
                if (vkey >= 0x30 && vkey <= 0x39)
                {
                    kbBuffers[deviceId].Append((char)vkey);
                }
                // Numpad 0-9
                else if (vkey >= 0x60 && vkey <= 0x69)
                {
                    kbBuffers[deviceId].Append((char)('0' + (vkey - 0x60)));
                }
                // Karakter huruf A-Z
                else if (vkey >= 0x41 && vkey <= 0x5A)
                {
                    kbBuffers[deviceId].Append((char)vkey);
                }
                // Tanda minus / strip '-'
                else if (vkey == 0xBD || vkey == 0x6D)
                {
                    kbBuffers[deviceId].Append('-');
                }
            }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (comEngine != null)
            {
                comEngine.Stop();
            }
            base.OnFormClosing(e);
        }
    }

    class ComScannerEngine
    {
        readonly Dictionary<string, SerialPort> activePorts = new Dictionary<string, SerialPort>();
        readonly Dictionary<string, StringBuilder> portBuffers = new Dictionary<string, StringBuilder>();
        readonly Dictionary<string, DateTime> lastCharTimes = new Dictionary<string, DateTime>();
        readonly object lockObj = new object();

        System.Threading.Timer scanTimer;
        bool isRunning = false;

        public void Start()
        {
            isRunning = true;
            AgentLog.Info("Memindai port serial yang terhubung...");
            RefreshPorts();

            // Cek port baru setiap 4 detik (hotplug jika ada scanner yang baru dicolokkan)
            scanTimer = new System.Threading.Timer(new TimerCallback(OnTimerTick), null, 4000, 4000);
        }

        public void Stop()
        {
            isRunning = false;
            if (scanTimer != null)
            {
                scanTimer.Dispose();
                scanTimer = null;
            }

            lock (lockObj)
            {
                foreach (KeyValuePair<string, SerialPort> kvp in activePorts)
                {
                    try
                    {
                        if (kvp.Value.IsOpen) kvp.Value.Close();
                        kvp.Value.Dispose();
                    }
                    catch { }
                }
                activePorts.Clear();
            }
        }

        void OnTimerTick(object state)
        {
            if (!isRunning) return;
            RefreshPorts();
            CheckBufferIdleTimeouts();
        }

        void RefreshPorts()
        {
            string[] availablePorts;
            try
            {
                availablePorts = SerialPort.GetPortNames();
            }
            catch
            {
                return;
            }

            List<string> targetList = new List<string>();
            string configPort = AgentCore.Config.Port;

            if (configPort == "AUTO")
            {
                targetList.AddRange(availablePorts);
            }
            else
            {
                foreach (string p in availablePorts)
                {
                    if (string.Equals(p, configPort, StringComparison.OrdinalIgnoreCase))
                    {
                        targetList.Add(p);
                        break;
                    }
                }
            }

            lock (lockObj)
            {
                // Tutup port yang sudah dicabut
                List<string> disconnected = new List<string>();
                foreach (string openPort in activePorts.Keys)
                {
                    if (!targetList.Contains(openPort)) disconnected.Add(openPort);
                }

                foreach (string dis in disconnected)
                {
                    AgentLog.Warn(string.Format("Scanner serial {0} telah dilepas/terputus.", dis));

                    try
                    {
                        activePorts[dis].Close();
                        activePorts[dis].Dispose();
                    }
                    catch { }

                    activePorts.Remove(dis);
                    portBuffers.Remove(dis);
                    lastCharTimes.Remove(dis);
                }

                // Buka port yang baru terpasang
                foreach (string portName in targetList)
                {
                    if (!activePorts.ContainsKey(portName))
                    {
                        OpenPort(portName);
                    }
                }
            }
        }

        void OpenPort(string portName)
        {
            try
            {
                SerialPort port = new SerialPort(portName, AgentCore.Config.BaudRate, Parity.None, 8, StopBits.One);
                port.ReadTimeout = 500;
                port.WriteTimeout = 500;
                port.DataReceived += new SerialDataReceivedEventHandler(OnDataReceived);

                port.Open();

                activePorts[portName] = port;
                portBuffers[portName] = new StringBuilder();
                lastCharTimes[portName] = DateTime.Now;

                AgentLog.Ok(string.Format("Port serial terhubung: {0} (Baud: {1})", portName, AgentCore.Config.BaudRate));
            }
            catch
            {
                // Port mungkin sedang dipakai aplikasi lain atau belum siap
            }
        }

        void OnDataReceived(object sender, SerialDataReceivedEventArgs e)
        {
            SerialPort sp = sender as SerialPort;
            if (sp == null || !sp.IsOpen) return;

            string portName = sp.PortName;

            try
            {
                string incoming = sp.ReadExisting();
                if (string.IsNullOrEmpty(incoming)) return;

                lock (lockObj)
                {
                    if (!portBuffers.ContainsKey(portName))
                    {
                        portBuffers[portName] = new StringBuilder();
                    }

                    StringBuilder sb = portBuffers[portName];
                    sb.Append(incoming);
                    lastCharTimes[portName] = DateTime.Now;

                    string current = sb.ToString();
                    if (current.Contains("\r") || current.Contains("\n"))
                    {
                        sb.Length = 0;
                        string nis = CleanNis(current);
                        if (!string.IsNullOrEmpty(nis))
                        {
                            AgentCore.DispatchScan(nis, portName);
                        }
                    }
                }
            }
            catch { }
        }

        void CheckBufferIdleTimeouts()
        {
            lock (lockObj)
            {
                DateTime now = DateTime.Now;
                foreach (KeyValuePair<string, StringBuilder> kvp in portBuffers)
                {
                    if (kvp.Value.Length > 0 && lastCharTimes.ContainsKey(kvp.Key))
                    {
                        if ((now - lastCharTimes[kvp.Key]).TotalMilliseconds > 150)
                        {
                            string nis = CleanNis(kvp.Value.ToString());
                            kvp.Value.Length = 0;
                            if (!string.IsNullOrEmpty(nis))
                            {
                                AgentCore.DispatchScan(nis, kvp.Key);
                            }
                        }
                    }
                }
            }
        }

        string CleanNis(string raw)
        {
            if (string.IsNullOrEmpty(raw)) return "";
            return Regex.Replace(raw, @"[^\w\-]", "").Trim();
        }
    }
}
