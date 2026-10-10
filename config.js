/* Configuração do Souza Motion Studio.
   Edite aqui sem mexer no resto do código. Nenhuma URL absoluta é necessária:
   todos os arquivos são carregados por caminho relativo, então o editor funciona
   na raiz de um domínio, em subdomínio ou em subdiretório (ex.: /apps/motion/). */
window.SMS_CONFIG = {
  appName: 'Souza Motion Studio',
  version: '3.0.0',
  dbName: 'souza-motion-studio',
  autosaveMs: 1500,
  registerServiceWorker: true,   // PWA/offline (exige HTTPS ou localhost)
  defaultFps: 30,
  maxImportMB: { image: 30, audio: 120, video: 300, font: 15 },
  undoLimit: 80
};
