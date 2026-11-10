


// la versión subió de 1 a 2 para que el navegador vuelva a ejecutar esta función y cree el almacén nuevo
var dbpromise = idb.open('posts-store', 2, function (db) {
    if (!db.objectStoreNames.contains('posts')) { //revissa si se encuentra el post
        db.createObjectStore('posts', { keyPath: 'id' }); //si no se encuentra, lo crea con la llave primaria "id"
    }
    if (!db.objectStoreNames.contains('sync-posts')) { //almacén de las publicaciones que esperan a tener conexión para enviarse
        db.createObjectStore('sync-posts', { keyPath: 'id' });
    }
}); 
//la función anterior abre la base de datos en firebase

function writeData(st, data) { //st = nombre del objectStore (almacenamiento de objetos) y data = datos que se van a guardar
    return dbpromise //abre la base de datos
        .then(function (db) {
            var tx = db.transaction(st, 'readwrite'); //abre la transacción de lectura y escritura
            var store = tx.objectStore(st); //abre el objectStore (almacenamiento de objetos) que se encuentra en la base de datos
            store.put(data);
            return tx.complete; //regresa la transacción completa
        });  }

//la función anterior guarda los datos en el objectStore



function readAllData(st) { //st = nombre del objectStore (almacenamiento de objetos)
    return dbpromise //abre la base de datos
        .then(function (db) { //abre la base de datos
            var tx = db.transaction(st, 'readonly'); //abre la transacción de solo lectura
            var store = tx.objectStore(st); //abre el objectStore (almacenamiento de objetos) que se encuentra en la base de datos
            return store.getAll(); //regresa todos los datos del objectStore
        })}
//la función anterior lee todos los datos del objectStore y los regresa en un array

function clearAllData(st) { //st = nombre del objectStore (almacenamiento de objetos)
    return dbpromise
        .then(function (db) {
            var tx = db.transaction(st, 'readwrite'); //abre la transacción de lectura y escritura
            var store = tx.objectStore(st); //abre el objectStore (almacenamiento de objetos) que se encuentra en la base de datos
            store.clear(); //limpia todos los datos del objectStore
            return tx.complete; //regresa la transacción completa
        })} 
//la función anterior limpia todos los datos del objectStore

function deleteItemFromData(st, id) { //st = nombre del objectStore (almacenamiento de objetos) y id = id del objeto que se va a eliminar
    return dbpromise
        .then(function (db) {
            var tx = db.transaction(st, 'readwrite'); //abre la transacción de lectura y escritura
            var store = tx.objectStore(st); //abre el objectStore (almacenamiento de objetos) que se encuentra en la base de datos
            store.delete(id); //elimina el objeto con el id especificado
            return tx.complete; //regresa la transacción completa
        })
        .then(function () {
            console.log('Item deleted!');
        });
}

