const CACHE_NAME = 'controle-de-ponto-cache-v12';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Evento de Instalação: Salva os novos arquivos no cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto, adicionando novos arquivos.');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento de Ativação: Limpa todos os caches antigos
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME]; // Lista de caches para MANTER
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Se o cache não estiver na lista de permissões, APAGUE-O
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Apagando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Evento de Fetch: Responde com os arquivos do cache
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se o arquivo existir no cache, retorna ele
        if (response) {
          return response;
        }
        // Se não, busca na rede
        return fetch(event.request);
      }
    )
  );
});