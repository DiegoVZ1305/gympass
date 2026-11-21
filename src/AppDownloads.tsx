import { Download, Monitor, Smartphone } from 'lucide-react';
import './styles/app-downloads.css';

const installerBase = 'https://github.com/DiegoVZ1305/gympass/raw/refs/heads/main/instaladores/5.7.0/';
const androidApk = installerBase + 'GymPASS-Android-5.7.0.apk';

export default function AppDownloads() {
  if (
    /GymPASSConnection\/|GymPASS-(?:Android|iOS)\/|Electron\//.test(navigator.userAgent) ||
    'ReactNativeWebView' in window
  )
    return null;

  return (
    <section className="app-downloads" aria-labelledby="app-downloads-title">
      <h3 id="app-downloads-title">
        <Download size={18} aria-hidden="true" /> Descargas actuales
      </h3>
      <p>Elige una de estas dos versiones actualizadas de GymPASS.</p>
      <div className="app-download-options">
        <a className="app-download" href={androidApk} target="_blank" rel="noopener noreferrer">
          <Smartphone size={24} aria-hidden="true" />
          <span>
            <strong>Móvil Android</strong>
            <small>Descargar APK · v5.7.0</small>
          </span>
          <Download size={16} aria-hidden="true" />
        </a>
        <a
          className="app-download"
          href={installerBase + 'GymPASS-Setup-5.7.0.exe'}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Monitor size={24} aria-hidden="true" />
          <span>
            <strong>Escritorio Windows</strong>
            <small>Descargar instalador · v5.7.0</small>
          </span>
          <Download size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
