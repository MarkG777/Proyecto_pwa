importScripts('/src/js/idb.js'); //importa la librería idb.js que permite usar indexedDB de manera más sencilla
importScripts('/src/js/utility.js'); //importa el indexedDB que se encuentra en utility.js

var CACHE_STATIC_NAME = 'static-v6'; // subió de v5 porque cambiaron utility.js y feed.js, que se sirven desde este caché
var CACHE_DYNAMIC_NAME = 'dynamic-v6';
var STATIC_FILES = [
    '/',
    '/index.html',
    '/offline.html', // página de respaldo cuando no hay red ni caché para lo que se pidió
    '/src/js/app.js',
    '/src/js/feed.js',
    '/src/js/idb.js',
    '/src/js/utility.js',
    '/src/js/material.min.js', // nombre real del archivo; sin el ".min" la ruta no existe y addAll falla completo
    '/src/css/app.css',
    '/src/css/feed.css',
    '/src/images/main-image.jpg',
    '/src/images/steep-street.jpg', // imagen de la tarjeta "Ir a San Francisco", para que se vea offline
    'https://fonts.googleapis.com/css?family=Roboto:400,700',
    'https://fonts.googleapis.com/icon?family=Material+Icons',
    'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css'
];

// Se dispara una sola vez, cuando el navegador detecta un sw.js nuevo o distinto al registrado
self.addEventListener('install', function(event) {
    console.log('[Service Worker] Installing Service Worker ...', event);
    // activa esta versión sin esperar a que se cierren las pestañas con la versión anterior
    self.skipWaiting();
    event.waitUntil(
        // usamos CACHE_STATIC_NAME (no el texto suelto 'static') para que coincida con los nombres que activate() conserva
        caches.open(CACHE_STATIC_NAME).then(function(cache) {
            console.log('[Service worker] precatching App Shell');

            // 1. AGREGADO: "return" antes de cache.addAll, así waitUntil espera a que el cacheo termine de verdad
            return cache.addAll(STATIC_FILES); // guarda en caché todos los archivos de la lista de arriba
        }).catch(function(err) {
            // 2. AGREGADO: esto te avisa si alguna ruta de la lista falló (404, typo, etc.)
            console.error('[Service Worker] Error precaching (revisa tus rutas):', err);
        })
    );
});

// Se dispara cuando este Service Worker queda listo para tomar el control
self.addEventListener('activate', function(event) {
    console.log('[Service Worker] Activating Service Worker ....', event);
    event.waitUntil(
        caches.keys().then(function(keyList) {
            return Promise.all(keyList.map(function(key) {
                // borra cualquier caché que no sea la versión actual (CACHE_STATIC_NAME / CACHE_DYNAMIC_NAME)
                if (key !== CACHE_STATIC_NAME && key !== CACHE_DYNAMIC_NAME) {
                    console.log('[Service Worker] Deleting old cache:', key);
                    return caches.delete(key);
                }
            }))
                // encadenado aquí adentro (no afuera) para que corra después de limpiar los cachés viejos,
                // y para que waitUntil espere a que termine antes de dar la activación por completa
                .then(function() {
                    return self.clients.claim();
                });
        })
    );
});

// Revisa si una URL es uno de los archivos de STATIC_FILES (los que se guardaron en el install)
function isInArray(string, array) {
    var cachePath;
    if (string.indexOf(self.origin) === 0) { // la petición es a nuestro propio dominio
        console.log('matched ', string);
        cachePath = string.substring(self.origin.length); // se toma solo la ruta, sin el dominio (ej. /src/js/app.js)
    } else {
        cachePath = string; // fuentes o CDN: se compara la URL completa
    }
    return array.indexOf(cachePath) > -1;
}

// Se dispara en cada petición (html, css, js, imágenes, fuentes) que hace la página

self.addEventListener('fetch', function (event) {
    // URL que queremos tratar distinto al resto (estrategia network-first)
    var url = 'https://uteqgram-319a7-default-rtdb.firebaseio.com/post.json';

    // ¿Esta petición es la de la base de datos de Firebase? Entonces no usamos cache-first, va directo a la red
    if (event.request.url.indexOf(url) > -1) { // si la petición es a la base de datos de Firebase, se hace network-first
        event.respondWith( // se responde con la respuesta de la red
            fetch(event.request)
                .then(function (res) {
                    var clonedRes = res.clone(); //clonamos la respuesta de la red para poder usarla en indexedDB
                    clearAllData('posts') //limpiamos los datos viejos de indexedDB
                        .then(function () {
                            return clonedRes.json(); //convertimos la respuesta de la red en json
                        })
                        .then(function (data) { //recibimos el json de la red
                            for (var key in data) { //recorremos el objeto de Firebase
                                writeData('posts', data[key]); //guardamos cada post en indexedDB
                            }
                        });
                    return res; //regresamos la respuesta de la red para que se muestre en pantalla
                })
        );
    } else if (isInArray(event.request.url, STATIC_FILES)) {
        // archivos que se guardaron en el install: se sirven del caché (si faltara alguno, se pide a la red)
        event.respondWith(
            caches.match(event.request)
                .then(function (response) {
                    return response || fetch(event.request);
                })
        );
    } else {
        // para todo lo demás, seguimos con cache-first
        event.respondWith(
            caches.match(event.request)
                .then(function (response) {
                    if (response) {
                        return response; // ya está en caché, se sirve de ahí sin pedir nada a la red
                    } else {
                        // no está en caché: se pide a la red...
                        return fetch(event.request)
                            .then(function (res) {
                                // ...y se guarda en el caché dinámico para que la próxima vez sí esté en caché
                                return caches.open(CACHE_DYNAMIC_NAME)
                                    .then(function (cache) {
                                        cache.put(event.request.url, res.clone());
                                        return res;
                                    })
                            })
                            .catch(function (err) {
                                // ni caché ni red funcionaron (ej. sin conexión): se intenta mostrar una página de respaldo
                                return caches.open(CACHE_STATIC_NAME)
                                    .then(function (cache) {
                                        if (event.request.headers.get('accept').includes('text/html')) {
                                            return cache.match('/offline.html');
                                        }
                                    });
                            });
                    }
                })
        );
    }
});

// Se dispara cuando regresa la conexión y hay un registro de sync pendiente (se registra en feed.js con 'sync-new-posts')
self.addEventListener('sync', function(event) {
    console.log('[Service Worker] Background syncing', event);
    if (event.tag === 'sync-new-posts') {
        console.log('[Service Worker] Syncing new Posts');
        event.waitUntil(
            readAllData('sync-posts') // lee las publicaciones que se guardaron sin conexión
                .then(function(data) {
                    for (var dt of data) {
                        fetch('https://uteqgram-319a7-default-rtdb.firebaseio.com/post.json', { // dirección de la Realtime Database
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify({
                                id: dt.id,
                                title: dt.title,
                                location: dt.location,
                                image: '/src/images/steep-street.jpg'
                            })
                        })
                            .then(function(res) {
                                console.log('Sent data', res);
                                if (res.ok) {
                                    deleteItemFromData('sync-posts', dt.id); // Isn't working correctly!
                                }
                            })
                            .catch(function(err) {
                                console.log('Error while sending data', err);
                            });
                    }
                })
        );
    }
});
