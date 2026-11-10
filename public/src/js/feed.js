// ===== Referencias a elementos del DOM (los ids vienen de index.html) =====
var shareImageButton = document.querySelector('#share-image-button');               // botón flotante "+"
var createPostArea = document.querySelector('#create-post');                        // panel para crear una publicación
var closeCreatePostModalButton = document.querySelector('#close-create-post-modal-btn'); // botón "x" que cierra el panel
var sharedMomentsArea = document.querySelector('#shared-moments');                  // contenedor donde se muestran las tarjetas
var form=document.querySelector('form');
var titleInput=document.querySelector('#title');
var locationInput=document.querySelector('#location');
// ===== Abrir el panel de crear post =====
// En feed.css el panel empieza con display: none; aquí se muestra
function openCreatePostModal() {
// createPostArea.style.display = 'block';

createPostArea.style.transform = 'translateY(0)';
if (deferredPrompt) {
deferredPrompt.prompt();

deferredPrompt.userChoice.then(function(choiceResult) {
console.log(choiceResult.outcome);

if (choiceResult.outcome === 'dismissed') {
console.log('User cancelled installation');
} else {
console.log('User added to home screen');
}
});

deferredPrompt = null;
}
}

function closeCreatePostModal() {
//createPostArea.style.display = 'none';
createPostArea.style.transform = 'translateY(100vh)';
}
// ===== Eventos: conectan los botones con las funciones de arriba =====
shareImageButton.addEventListener('click', openCreatePostModal);
closeCreatePostModalButton.addEventListener('click', closeCreatePostModal);


fetch('https://httpbin.org/get')
    .then(function(response) {
        return response.json();
    })
    .catch(function() {
        // sin red no hay respuesta de httpbin, pero la tarjeta se muestra igual
    })
    .then(function() {
        var sfCard = document.createElement('div');
        sfCard.className = 'mdl-card mdl-shadow--4dp';
        sfCard.style.cssText = 'width: 600px; max-width: calc(100% - 32px); margin: 16px;';
        var smallImage = document.createElement('img');
        smallImage.src = '/src/images/steep-street.jpg';
        smallImage.style.cssText = 'display: block; width: 100%; height: auto;';
        sfCard.appendChild(smallImage);
        var sfText = document.createElement('h5');
        sfText.className = 'mdl-color-text--primary';
        sfText.style.cssText = 'margin: 0; padding: 16px; background: white; text-align: center;';
        sfText.textContent = 'Ir a San Francisco';
        sfCard.appendChild(sfText);
        sharedMomentsArea.parentNode.appendChild(sfCard);
    });

// Borra las tarjetas que ya estén en pantalla, para no duplicarlas al recibir datos nuevos
function clearCards() {
  while (sharedMomentsArea.hasChildNodes()) {
    sharedMomentsArea.removeChild(sharedMomentsArea.lastChild);
  }
}

// Crea una tarjeta con los datos de un post de Firebase (image, title, location)
function createCard(data) {
  var cardWrapper = document.createElement('div');
  cardWrapper.className = 'shared-moment-card mdl-card mdl-shadow--2dp';
  var cardTitle = document.createElement('div');
  cardTitle.className = 'mdl-card__title';
  cardTitle.style.backgroundImage = 'url("' + data.image + '")';
  cardTitle.style.backgroundSize = 'cover';
  cardTitle.style.height = '180px';
  cardWrapper.appendChild(cardTitle);
  var cardTitleTextElement = document.createElement('h2');
  cardTitleTextElement.style.color = 'white';
  cardTitleTextElement.className = 'mdl-card__title-text';
  cardTitleTextElement.textContent = data.title;
  cardTitle.appendChild(cardTitleTextElement);
  var cardSupportingText = document.createElement('div');
  cardSupportingText.className = 'mdl-card__supporting-text';
  cardSupportingText.textContent = data.location;
  cardSupportingText.style.textAlign = 'center';
  cardWrapper.appendChild(cardSupportingText);
  componentHandler.upgradeElement(cardWrapper);
  sharedMomentsArea.appendChild(cardWrapper);
}

// Recibe el objeto de Firebase ({ "first-post": {...}, ... }) y dibuja una tarjeta por cada post
function updateUI(data) {
  clearCards();
  for (var key in data) {
    createCard(data[key]);
  }
}

// Dirección de la Realtime Database de Firebase (nodo "post"); debe ser la misma que usa sw.js
var url = 'https://uteqgram-319a7-default-rtdb.firebaseio.com/post.json';
var networkDataReceived = false;



if ('caches' in window) { // si el navegador soporta cache, se busca la respuesta en cache
    caches.match(url) // busca la respuesta en cache
        .then(function(response) {// si la encuentra, la regresa
            if (response) {
                return response.json();
            }
        })
        .then(function(data) {
            console.log('From cache', data);
            if (!networkDataReceived) {
                updateUI(data);
            }
        });
}

fetch(url)
    .then(function(res) {
        return res.json(); //se transfroma la respuesta en json

    })
    .then(function(data) {
        networkDataReceived = true;
        console.log('From web', data); //imprime en consola la respuesta de la red
        var dataArray = []; //arreglo donde se guardarán los posts
        for (var key in data) {//recorre el objeto de Firebase
            dataArray.push(data[key]); //convierte el objeto de Firebase en un arreglo de posts
        }
        updateUI(dataArray); //llama a la función que dibuja las tarjetas con los datos de la red
    });

if ('indexedDB' in window) { // si el navegador soporta indexedDB, se busca la respuesta en indexedDB
    readAllData('posts') // lee todos los datos de la tabla "posts" de indexedDB
        .then(function(data) { // si encuentra datos, los regresa
            if (!networkDataReceived) { // si no se recibió respuesta de la red, se dibujan las tarjetas con los datos de indexedDB
                console.log('From cache', data);
                updateUI(data); //llama a la función que dibuja las tarjetas con los datos de indexedDB
            }
        });
}



function sendData() {
fetch(url, {
method: 'POST',
headers: {
'Content-Type': 'application/json',
'Accept': 'application/json'
},
body: JSON.stringify({
id: new Date().toISOString(),
title: titleInput.value,
location: locationInput.value,
image: '/src/images/steep-street.jpg'
})
})
.then(function(res) {
console.log('Sent data', res);
updateUI();
})
}

form.addEventListener('submit', function(event) {
event.preventDefault();

if (titleInput.value.trim() === '' || locationInput.value.trim() === '') {
alert('Please enter valid data!');
return;
}

closeCreatePostModal();

if ('serviceWorker' in navigator && 'SyncManager' in window) {
navigator.serviceWorker.ready
.then(function(sw) {
var post = {
id: new Date().toISOString(),
title: titleInput.value,
location: locationInput.value
};
writeData('sync-posts', post) //se activa cuando no hay internet manda datos a la colección sync-posts
.then(function() {
return sw.sync.register('sync-new-posts'); //se activa cuando regresa la conexión y hay un registro de sync pendiente (se registra en sw.js con 'sync-new-posts')
})
.then(function() {
var snackbarContainer = document.querySelector('#confirmation-toast');
var data = {message: 'Your Post was saved for syncing!'};
snackbarContainer.MaterialSnackbar.showSnackbar(data);
})
.catch(function(err) {
console.log(err);
});
});
} else {
sendData();
}
});

