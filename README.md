# MB Consulting — Universe 3D

Sito statico (HTML, CSS, JavaScript; Three.js incluso in `vendor/`). Nessuna installazione né build: si apre con doppio clic su `index.html` e si pubblica così com'è.

## Pubblicazione su GitHub Pages
1. Carica il contenuto di questa cartella nella radice del repository (con GitHub Desktop vengono inclusi anche i file nascosti `.nojekyll` e `.well-known/`).
2. Repository → **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main`, cartella `/ (root)`.
3. Dominio: in **Settings → Pages → Custom domain** scrivi il dominio (GitHub crea il file `CNAME`), poi attiva **Enforce HTTPS**.
4. DNS del dominio (dal tuo provider):
   - dominio principale: record **A** → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
     (facoltativi **AAAA** → `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`)
   - `www`: record **CNAME** → `<tuo-utente>.github.io`
   - **Non toccare i record MX**: servono all'email info@….

Nota: con l'account GitHub gratuito il repository deve essere **pubblico** (chiunque può vedere e scaricare il codice e le immagini). Per un repository privato con Pages serve GitHub Pro.

## Protezione anti-scraping
- `robots.txt`: motori di ricerca ammessi, crawler di AI e raccoglitori di contenuti esclusi.
- Metadati `noai, noimageai` e riserva TDM (art. 4 Direttiva UE 2019/790): `index.html` e `/.well-known/tdmrep.json`.
- Email mai scritta in chiaro (`protect.js` la ricompone nel browser).
- Modulo di contatto: campo trappola + blocco invii troppo rapidi.
- `.nojekyll`: fa servire a GitHub Pages anche la cartella `.well-known`.

## File da modificare
- Testi IT/EN: `i18n.js` · Progetti: `projects-data.js` · Stile: `style.css` · Modulo di contatto: `config.js`
