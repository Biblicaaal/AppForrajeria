using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class LaViejaEsquinaLauncher
{
    [STAThread]
    private static void Main()
    {
        try
        {
            string folder = AppDomain.CurrentDomain.BaseDirectory;
            string batch = Path.Combine(folder, "Abrir-AppCajaPana.bat");
            if (!File.Exists(batch))
            {
                MessageBox.Show(
                    "No se encontro Abrir-AppCajaPana.bat junto al ejecutable.",
                    "La Vieja Esquina",
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
                "No se pudo abrir La Vieja Esquina.\r\n\r\n" + error.Message,
                "La Vieja Esquina",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }
}
