using System;
using System.Collections.Generic;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using System.Net;
using System.Text;
using System.IO;
using System.Text.RegularExpressions;

namespace ScannerAgent
{
    class Program
    {
        [DllImport("kernel32.dll")]
        static extern bool AllocConsole();

        [STAThread]
        static void Main()
        {
            AllocConsole();
            Console.WriteLine("========================================");
            Console.WriteLine(" PRESENSEE MULTI-SCANNER AGENT (ACTIVE) ");
            Console.WriteLine("========================================");
            Console.WriteLine("Biarkan jendela ini tetap terbuka (boleh di-minimize).");
            Console.WriteLine("Menunggu input dari scanner...");
            
            Application.Run(new RawInputReceiver());
        }
    }

    class RawInputReceiver : Form
    {
        [DllImport("user32.dll")]
        static extern bool RegisterRawInputDevices(RAWINPUTDEVICE[] pRawInputDevices, uint uiNumDevices, uint cbSize);
        [DllImport("user32.dll")]
        static extern uint GetRawInputData(IntPtr hRawInput, uint uiCommand, IntPtr pData, ref uint pcbSize, uint cbSizeHeader);

        [StructLayout(LayoutKind.Sequential)]
        struct RAWINPUTDEVICE { public ushort usUsagePage; public ushort usUsage; public uint dwFlags; public IntPtr hwndTarget; }

        [StructLayout(LayoutKind.Sequential)]
        struct RAWINPUTHEADER { public uint dwType; public uint dwSize; public IntPtr hDevice; public IntPtr wParam; }

        [StructLayout(LayoutKind.Sequential)]
        struct RAWKEYBOARD { public ushort MakeCode; public ushort Flags; public ushort Reserved; public ushort VKey; public uint Message; public uint ExtraInformation; }

        Dictionary<IntPtr, string> buffers = new Dictionary<IntPtr, string>();
        string apiUrl = "http://localhost:5000";
        string apiKey = "presensee-scanner-api-key-2026";

        public RawInputReceiver()
        {
            LoadConfig();
            Console.WriteLine("[INFO] Target API: " + apiUrl);

            RAWINPUTDEVICE[] rid = new RAWINPUTDEVICE[1];
            rid[0].usUsagePage = 0x01;
            rid[0].usUsage = 0x06;
            rid[0].dwFlags = 0x00000100; // RIDEV_INPUTSINK
            rid[0].hwndTarget = this.Handle;

            if (!RegisterRawInputDevices(rid, (uint)rid.Length, (uint)Marshal.SizeOf(rid[0])))
            {
                Console.WriteLine("[ERROR] Gagal mendaftarkan Raw Input.");
            }
            else 
            {
                Console.WriteLine("[OK] Raw Input aktif. Siap menerima scan dari berbagai port.");
            }
        }

        void LoadConfig()
        {
            try
            {
                string configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
                if (File.Exists(configPath))
                {
                    string json = File.ReadAllText(configPath);
                    Match urlMatch = Regex.Match(json, @"""apiUrl""\s*:\s*""([^""]+)""");
                    if (urlMatch.Success) apiUrl = urlMatch.Groups[1].Value.TrimEnd('/');
                    
                    Match keyMatch = Regex.Match(json, @"""apiKey""\s*:\s*""([^""]+)""");
                    if (keyMatch.Success) apiKey = keyMatch.Groups[1].Value;
                }
            }
            catch {}
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == 0x00FF) // WM_INPUT
            {
                uint dataSize = 0;
                uint headerSize = (uint)Marshal.SizeOf(typeof(RAWINPUTHEADER));
                GetRawInputData(m.LParam, 0x10000003, IntPtr.Zero, ref dataSize, headerSize);
                if (dataSize > 0)
                {
                    IntPtr outBuffer = Marshal.AllocHGlobal((int)dataSize);
                    if (GetRawInputData(m.LParam, 0x10000003, outBuffer, ref dataSize, headerSize) == dataSize)
                    {
                        RAWINPUTHEADER header = (RAWINPUTHEADER)Marshal.PtrToStructure(outBuffer, typeof(RAWINPUTHEADER));
                        if (header.dwType == 1) // RIM_TYPEKEYBOARD
                        {
                            IntPtr kbPtr = new IntPtr(outBuffer.ToInt64() + headerSize);
                            RAWKEYBOARD kb = (RAWKEYBOARD)Marshal.PtrToStructure(kbPtr, typeof(RAWKEYBOARD));
                            
                            if (kb.Message == 0x0100) // WM_KEYDOWN
                            {
                                ProcessKey(header.hDevice, kb.VKey);
                            }
                        }
                    }
                    Marshal.FreeHGlobal(outBuffer);
                }
            }
            base.WndProc(ref m);
        }

        void ProcessKey(IntPtr deviceId, ushort vkey)
        {
            if (!buffers.ContainsKey(deviceId)) buffers[deviceId] = "";
            if (vkey == 13) // Enter
            { 
                string nis = buffers[deviceId];
                buffers[deviceId] = "";
                if (nis.Length >= 3) 
                {
                    Console.WriteLine(string.Format("[{2}] [SCAN] NIS: {0} dari Perangkat: {1:X}", nis, deviceId.ToInt64(), DateTime.Now.ToString("HH:mm:ss.fff")));
                    SendToServer(nis);
                }
            } 
            else 
            {
                if (vkey >= 0x30 && vkey <= 0x39) buffers[deviceId] += (char)vkey;
                if (vkey >= 0x41 && vkey <= 0x5A) buffers[deviceId] += (char)vkey;
            }
        }

        void SendToServer(string nis)
        {
            try
            {
                var request = (HttpWebRequest)WebRequest.Create(apiUrl + "/scans");
                request.Method = "POST";
                request.ContentType = "application/json";
                request.Headers["X-Api-Key"] = apiKey;
                string json = "{\"nis\":\"" + nis + "\"}";
                byte[] data = Encoding.UTF8.GetBytes(json);
                request.ContentLength = data.Length;
                using (var stream = request.GetRequestStream()) stream.Write(data, 0, data.Length);
                var response = (HttpWebResponse)request.GetResponse();
                if ((int)response.StatusCode >= 200 && (int)response.StatusCode < 300)
                {
                    Console.WriteLine("  -> Berhasil dikirim ke server!");
                }
                response.Close();
            }
            catch (Exception ex)
            {
                Console.WriteLine("  -> [ERROR] Gagal mengirim: " + ex.Message);
            }
        }
    }
}
