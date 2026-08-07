const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const vehicleText = document.getElementById('vehicleText');
const deviceAddress = document.getElementById('deviceAddress');
const copyAddress = document.getElementById('copyAddress');
document.getElementById('currentHost').textContent = location.host;

function prettyVehicle(value) {
  if (!value) return '';
  return value.replace(/^.*?:/, '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function updateHealth() {
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    const health = await response.json();
    statusDot.classList.toggle('online', Boolean(health.war_thunder));
    statusText.textContent = health.war_thunder ? 'War Thunder telemetry connected' : 'Dashboard ready · War Thunder waiting';
    vehicleText.textContent = health.war_thunder
      ? (prettyVehicle(health.vehicle) || 'Live match data is available.')
      : 'Start a match or test flight to provide live data.';
  } catch {
    statusDot.classList.remove('online');
    statusText.textContent = 'Dashboard service unavailable';
    vehicleText.textContent = 'Restart ThunderScope and refresh this page.';
  }
}

async function loadServerInfo() {
  try {
    const response = await fetch('/api/server-info', { cache: 'no-store' });
    const info = await response.json();
    if (info.lan_addresses?.length) {
      const url = `${info.lan_addresses[0]}/map`;
      copyAddress.textContent = url;
      copyAddress.dataset.url = url;
      deviceAddress.hidden = false;
    }
  } catch { /* Address display is optional. */ }
}

copyAddress?.addEventListener('click', async () => {
  const url = copyAddress.dataset.url;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    const original = copyAddress.textContent;
    copyAddress.textContent = 'Copied to clipboard';
    setTimeout(() => { copyAddress.textContent = original; }, 1300);
  } catch {
    window.prompt('Copy the tablet address:', url);
  }
});

updateHealth();
loadServerInfo();
setInterval(updateHealth, 2000);
