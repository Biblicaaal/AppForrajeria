using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class LaNuevaFePanaderiaLauncher
{
    [STAThread]
    private static void Main()
    {
        try
        {
            string folder = AppDomain.CurrentDomain.BaseDirectory;
            string batch = Path.Combine(folder, "Abrir-LaNuevaFePanaderia.bat");
            if (!File.Exists(batch))
            {
                MessageBox.Show(
                    "No se encontro Abrir-LaNuevaFePanaderia.bat junto al ejecutable.",
                    "La Nueva Fe Panaderia",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return;
            }

            string commandProcessor = Environment.GetEnvironmentVariable("ComSpec");
            if (String.IsNullOrEmpty(commandProcessor)) commandProcessor = "cmd.exe";
            ProcessStartInfo start = new ProcessStartInfo();
            start.FileName = commandProcessor;
            start.Arguments = "/d /s /c \"\"" + batch + "\"\"";
            start.WorkingDirectory = folder;
            start.UseShellExecute = false;
            start.CreateNoWindow = true;
            start.WindowStyle = ProcessWindowStyle.Hidden;
            Process.Start(start);
        }
        catch (Exception error)
        {
            MessageBox.Show(
                "No se pudo abrir La Nueva Fe Panaderia.\r\n\r\n" + error.Message,
                "La Nueva Fe Panaderia",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }
}
