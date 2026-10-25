# CouchDB-Movies

# Movie Shelf

An offline-first movie catalog built with Express and PouchDB. Movie documents are stored in the browser's IndexedDB database named `schema_a_movies`; `public/schema_a_movies.json` describes the document shape. Changes save locally immediately and replicate continuously to the CouchDB database `movies` when it is reachable.

## Run

Requirements: Node.js 20 or later and a CouchDB server reachable at `localhost:5984` with a database named `movies`.

```powershell
npm.cmd install
npm.cmd start
```

Open http://localhost:3000. The default CouchDB URL is `http://admin:mtu12345@localhost:5984/movies`. Override it without changing source using the `COUCHDB_URL` environment variable. The Express proxy keeps CouchDB credentials out of browser code and only forwards requests to the `movies` database.

The app can be used after its first load without a network connection. Create, edit, and delete operations update the local PouchDB database; its live retrying replication sends pending changes after connectivity returns. Use the **Cloud sync** button to pause or resume replication; the choice is remembered on this device. Deletions replicate as CouchDB tombstones when sync is enabled. Use **Import dataset** to bulk-import `public/schema_a_movies.json` into the local database; existing document IDs are skipped on subsequent imports.

## Movie document

Movie dataset documents contain `_id`, `title`, `actors`, and `genres`; the actor and genre values are arrays. New movies created in the app use the same fields. The dataset is in `public/schema_a_movies.json`, and PouchDB adds `_rev` for conflict tracking after import.